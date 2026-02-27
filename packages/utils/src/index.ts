import pino from "pino";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
});

const LEGACY_PREFIX = "encrypted:";
const V1_PREFIX = "enc:v1:";

function getEncryptionKey() {
  const secret = process.env.ENCRYPTION_SECRET?.trim();
  if (!secret) {
    return null;
  }

  return createHash("sha256").update(secret).digest();
}

export function encryptAtRest(value: string) {
  const key = getEncryptionKey();
  if (!key) {
    return `${LEGACY_PREFIX}${value}`;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${V1_PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptAtRest(value: string) {
  if (value.startsWith(V1_PREFIX)) {
    const key = getEncryptionKey();
    if (!key) {
      throw new Error("ENCRYPTION_SECRET is required to decrypt credentials.");
    }

    const payload = value.slice(V1_PREFIX.length);
    const [ivBase64, tagBase64, ciphertextBase64] = payload.split(":");
    if (!ivBase64 || !tagBase64 || !ciphertextBase64) {
      throw new Error("Invalid encrypted payload format.");
    }

    const iv = Buffer.from(ivBase64, "base64");
    const tag = Buffer.from(tagBase64, "base64");
    const ciphertext = Buffer.from(ciphertextBase64, "base64");

    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  }

  if (value.startsWith(LEGACY_PREFIX)) {
    return value.slice(LEGACY_PREFIX.length);
  }

  return value;
}

const cache = new Map<string, unknown>();

export function setCache<T>(key: string, value: T) {
  cache.set(key, value);
}

export function getCache<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}
