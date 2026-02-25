import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info"
});

export function encryptAtRest(value: string) {
  // Placeholder only. Replace with proper encryption implementation.
  return `encrypted:${value}`;
}

export function decryptAtRest(value: string) {
  return value.replace(/^encrypted:/, "");
}

const cache = new Map<string, unknown>();

export function setCache<T>(key: string, value: T) {
  cache.set(key, value);
}

export function getCache<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}
