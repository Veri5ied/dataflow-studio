import test from "node:test";
import assert from "node:assert/strict";
import { decryptAtRest, encryptAtRest } from "@dataflow/utils";

test("encrypt/decrypt roundtrip with ENCRYPTION_SECRET", () => {
  process.env.ENCRYPTION_SECRET = "super-secret-value";
  const ciphertext = encryptAtRest("db-password");
  const plaintext = decryptAtRest(ciphertext);
  assert.equal(plaintext, "db-password");
});

test("legacy encrypted prefix remains backward compatible", () => {
  delete process.env.ENCRYPTION_SECRET;
  const plaintext = decryptAtRest("encrypted:legacy-value");
  assert.equal(plaintext, "legacy-value");
});
