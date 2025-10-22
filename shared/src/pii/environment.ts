import {
  type EncryptionKey,
  type KeyManagementService,
  type SaltMaterial,
  type TokenSaltProvider,
} from "./types";

const KEY_ENV = "PII_ENCRYPTION_KEYS";
const ACTIVE_KEY_ENV = "PII_ENCRYPTION_ACTIVE_KID";
const SALT_ENV = "PII_TOKEN_SALTS";
const ACTIVE_SALT_ENV = "PII_TOKEN_ACTIVE_SID";
const KMS_REGION_ENV = "PII_KMS_REGION";

type RawKeyRecord = {
  kid: string;
  material?: string;
  ciphertext?: string;
};

type RawSaltRecord = {
  sid: string;
  secret?: string;
  ciphertext?: string;
};

type KmsClientConstructor = typeof import("@aws-sdk/client-kms").KMSClient;
type DecryptCommandConstructor = typeof import("@aws-sdk/client-kms").DecryptCommand;

type KmsModuleShape = {
  KMSClient: KmsClientConstructor;
  DecryptCommand: DecryptCommandConstructor;
};

let kmsModule: KmsModuleShape | undefined;
let kmsClient: InstanceType<KmsClientConstructor> | undefined;

function parseJsonEnv<T>(envName: string): T {
  const raw = process.env[envName];
  if (!raw) {
    throw new Error(`${envName} is not configured`);
  }

  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    throw new Error(`${envName} is not valid JSON: ${(error as Error).message}`);
  }
}

function decodeBase64(value: string, label: string): Buffer {
  try {
    const decoded = Buffer.from(value, "base64");
    if (decoded.length === 0) {
      throw new Error(`${label} decoded to an empty buffer`);
    }
    return decoded;
  } catch (error) {
    throw new Error(`${label} is not valid base64: ${(error as Error).message}`);
  }
}

async function loadKmsModule(): Promise<KmsModuleShape> {
  if (!kmsModule) {
    try {
      const mod = await import("@aws-sdk/client-kms");
      kmsModule = { KMSClient: mod.KMSClient, DecryptCommand: mod.DecryptCommand };
    } catch (error) {
      throw new Error(
        "@aws-sdk/client-kms is not available. Install the dependency to use ciphertext entries.",
      );
    }
  }
  return kmsModule;
}

async function decryptWithKMS(ciphertext: string): Promise<Buffer> {
  const module = await loadKmsModule();
  if (!kmsClient) {
    const region = process.env[KMS_REGION_ENV] ?? process.env.AWS_REGION;
    if (!region) {
      throw new Error("PII_KMS_REGION or AWS_REGION must be set to use ciphertext entries");
    }
    kmsClient = new module.KMSClient({ region });
  }

  const command = new module.DecryptCommand({ CiphertextBlob: Buffer.from(ciphertext, "base64") });
  const { Plaintext } = await kmsClient.send(command);
  if (!Plaintext) {
    throw new Error("KMS decrypt returned an empty payload");
  }
  return Buffer.isBuffer(Plaintext) ? Buffer.from(Plaintext) : Buffer.from(Plaintext as Uint8Array);
}

async function loadKeyMaterial(record: RawKeyRecord): Promise<Buffer> {
  if (record.material) {
    return decodeBase64(record.material, `encryption key ${record.kid}`);
  }
  if (record.ciphertext) {
    return decryptWithKMS(record.ciphertext);
  }
  throw new Error(`encryption key ${record.kid} must define material or ciphertext`);
}

async function loadSaltMaterial(record: RawSaltRecord): Promise<Buffer> {
  if (record.secret) {
    return decodeBase64(record.secret, `salt ${record.sid}`);
  }
  if (record.ciphertext) {
    return decryptWithKMS(record.ciphertext);
  }
  throw new Error(`salt ${record.sid} must define secret or ciphertext`);
}

function cloneKey(key: EncryptionKey): EncryptionKey {
  return { kid: key.kid, material: Buffer.from(key.material) };
}

function cloneSalt(salt: SaltMaterial): SaltMaterial {
  return { sid: salt.sid, secret: Buffer.from(salt.secret) };
}

export interface EnvironmentPIIProviders {
  kms: KeyManagementService;
  saltProvider: TokenSaltProvider;
}

export async function loadEnvironmentPIIProviders(): Promise<EnvironmentPIIProviders> {
  const rawKeys = parseJsonEnv<RawKeyRecord[]>(KEY_ENV);
  const activeKid = process.env[ACTIVE_KEY_ENV];
  if (!activeKid) {
    throw new Error(`${ACTIVE_KEY_ENV} is not configured`);
  }
  if (!Array.isArray(rawKeys) || rawKeys.length === 0) {
    throw new Error(`${KEY_ENV} must be a non-empty JSON array`);
  }

  const keyEntries = await Promise.all(
    rawKeys.map(async (record) => ({ kid: record.kid, material: await loadKeyMaterial(record) })),
  );

  const keyMap = new Map<string, EncryptionKey>();
  for (const entry of keyEntries) {
    if (!entry.kid) {
      throw new Error("encryption key entries must include a kid");
    }
    if (entry.material.length !== 32) {
      throw new Error(`encryption key ${entry.kid} must be 32 bytes for AES-256`);
    }
    keyMap.set(entry.kid, entry);
  }

  if (!keyMap.has(activeKid)) {
    throw new Error(`active encryption kid ${activeKid} is not present in ${KEY_ENV}`);
  }

  const kms: KeyManagementService = {
    getActiveKey: () => {
      const key = keyMap.get(activeKid);
      if (!key) {
        throw new Error("Active encryption key is unavailable");
      }
      return cloneKey(key);
    },
    getKeyById: (kid: string) => {
      const key = keyMap.get(kid);
      return key ? cloneKey(key) : undefined;
    },
  };

  const rawSalts = parseJsonEnv<RawSaltRecord[]>(SALT_ENV);
  const activeSid = process.env[ACTIVE_SALT_ENV];
  if (!activeSid) {
    throw new Error(`${ACTIVE_SALT_ENV} is not configured`);
  }
  if (!Array.isArray(rawSalts) || rawSalts.length === 0) {
    throw new Error(`${SALT_ENV} must be a non-empty JSON array`);
  }

  const saltEntries = await Promise.all(
    rawSalts.map(async (record) => ({ sid: record.sid, secret: await loadSaltMaterial(record) })),
  );

  const saltMap = new Map<string, SaltMaterial>();
  for (const entry of saltEntries) {
    if (!entry.sid) {
      throw new Error("salt entries must include a sid");
    }
    if (entry.secret.length < 16) {
      throw new Error(`salt ${entry.sid} must be at least 16 bytes`);
    }
    saltMap.set(entry.sid, entry);
  }

  if (!saltMap.has(activeSid)) {
    throw new Error(`active salt sid ${activeSid} is not present in ${SALT_ENV}`);
  }

  const saltProvider: TokenSaltProvider = {
    getActiveSalt: () => {
      const salt = saltMap.get(activeSid);
      if (!salt) {
        throw new Error("Active token salt is unavailable");
      }
      return cloneSalt(salt);
    },
    getSaltById: (sid: string) => {
      const salt = saltMap.get(sid);
      return salt ? cloneSalt(salt) : undefined;
    },
  };

  return { kms, saltProvider };
}
