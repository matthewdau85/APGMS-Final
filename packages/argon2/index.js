import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb);

const ARGON2_VERSION = 19;
export const argon2d = 0;
export const argon2i = 1;
export const argon2id = 2;

const DEFAULT_OPTIONS = {
  type: argon2id,
  memoryCost: 1 << 14,
  timeCost: 3,
  parallelism: 1,
  hashLength: 32,
  saltLength: 16,
};

const MIN_SALT_LENGTH = 8;

function toBuffer(value) {
  if (Buffer.isBuffer(value)) {
    return value;
  }
  if (typeof value === "string") {
    return Buffer.from(value, "utf8");
  }
  throw new TypeError("password must be a string or Buffer");
}

function encode(buf) {
  return buf.toString("base64");
}

function decode(str) {
  return Buffer.from(str, "base64");
}

function normaliseOptions(options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  if (opts.type !== argon2id) {
    throw new Error("argon2 polyfill only supports argon2id");
  }
  if (opts.salt && opts.saltLength && opts.salt.length !== opts.saltLength) {
    throw new Error("saltLength must match provided salt length");
  }
  if (!opts.saltLength || opts.saltLength < MIN_SALT_LENGTH) {
    throw new Error("saltLength must be at least 8 bytes");
  }
  return opts;
}

function deriveScryptParams(memoryCost, parallelism) {
  // memoryCost is expressed in kibibytes in the argon2 api. We map that onto scrypt's N parameter.
  // Ensure that the value is a power of two as required by scrypt and keep it within sane bounds.
  let target = Math.max(1 << 12, Math.min(memoryCost, 1 << 18));
  let N = 1;
  while (N < target) {
    N <<= 1;
  }
  return { N, r: 8, p: Math.max(1, parallelism) };
}

async function computeHash(material, salt, opts) {
  const params = deriveScryptParams(opts.memoryCost, opts.parallelism);
  let input = material;
  let result = await scrypt(input, salt, opts.hashLength, params);
  for (let i = 1; i < opts.timeCost; i += 1) {
    input = Buffer.concat([material, Buffer.from([i])]);
    result = await scrypt(input, salt, opts.hashLength, params);
  }
  return result;
}

function formatHash(opts, salt, hash) {
  const params = `m=${opts.memoryCost},t=${opts.timeCost},p=${opts.parallelism}`;
  return `$argon2id$v=${ARGON2_VERSION}$${params}$${encode(salt)}$${encode(hash)}`;
}

function parseHash(encoded) {
  if (typeof encoded !== "string" || !encoded.startsWith("$argon2")) {
    throw new Error("invalid argon2 hash");
  }
  const [, typeTag, versionTag, paramTag, saltB64, hashB64] = encoded.split("$");
  const versionMatch = /^v=(\d+)$/.exec(versionTag ?? "");
  if (!versionMatch) {
    throw new Error("invalid argon2 hash version");
  }
  const paramsMatch = /^m=(\d+),t=(\d+),p=(\d+)$/.exec(paramTag ?? "");
  if (!paramsMatch) {
    throw new Error("invalid argon2 hash params");
  }
  const [, memoryStr, timeStr, parallelStr] = paramsMatch;
  const opts = {
    type: typeTag === "argon2id" ? argon2id : typeTag === "argon2i" ? argon2i : argon2d,
    memoryCost: Number(memoryStr),
    timeCost: Number(timeStr),
    parallelism: Number(parallelStr),
  };
  return {
    options: opts,
    salt: decode(saltB64 ?? ""),
    hash: decode(hashB64 ?? ""),
  };
}

export async function hash(plain, options = {}) {
  const opts = normaliseOptions(options);
  const password = toBuffer(plain);
  const salt = options.salt ? toBuffer(options.salt) : randomBytes(opts.saltLength);
  if (!options.salt) {
    opts.saltLength = salt.length;
  }
  const computed = await computeHash(password, salt, opts);
  if (options.raw) {
    return computed;
  }
  return formatHash(opts, salt, computed);
}

export async function verify(encoded, plain, options = {}) {
  const { options: encodedOpts, salt, hash: stored } = parseHash(encoded);
  const opts = normaliseOptions({ ...encodedOpts, ...options, saltLength: salt.length });
  const password = toBuffer(plain);
  const computed = await computeHash(password, salt, opts);
  if (stored.length !== computed.length) {
    return false;
  }
  return timingSafeEqual(stored, computed);
}

export function needsRehash(encoded, options = {}) {
  const { options: encodedOpts } = parseHash(encoded);
  const normalised = normaliseOptions({ ...options });
  if (encodedOpts.type !== normalised.type) {
    return true;
  }
  return (
    encodedOpts.memoryCost !== normalised.memoryCost ||
    encodedOpts.timeCost !== normalised.timeCost ||
    encodedOpts.parallelism !== normalised.parallelism
  );
}

export default {
  argon2d,
  argon2i,
  argon2id,
  hash,
  verify,
  needsRehash,
};
