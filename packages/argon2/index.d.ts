/// <reference types="node" />

export type Argon2Type = 0 | 1 | 2;

export interface HashOptions {
  type?: Argon2Type;
  memoryCost?: number;
  timeCost?: number;
  parallelism?: number;
  hashLength?: number;
  saltLength?: number;
  salt?: string | Buffer;
  raw?: boolean;
}

export const argon2d: Argon2Type;
export const argon2i: Argon2Type;
export const argon2id: Argon2Type;

export function hash(plain: string | Buffer, options?: HashOptions & { raw: true }): Promise<Buffer>;
export function hash(plain: string | Buffer, options?: HashOptions): Promise<string>;
export function verify(encoded: string, plain: string | Buffer, options?: HashOptions): Promise<boolean>;
export function needsRehash(encoded: string, options?: HashOptions): boolean;

declare const argon2: {
  argon2d: Argon2Type;
  argon2i: Argon2Type;
  argon2id: Argon2Type;
  hash: typeof hash;
  verify: typeof verify;
  needsRehash: typeof needsRehash;
};

export default argon2;
