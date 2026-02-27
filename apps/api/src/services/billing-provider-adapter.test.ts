import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { getBillingProviderAdapter } from "./billing-provider-adapter";

test("billing adapter accepts valid hmac signature", () => {
  const adapter = getBillingProviderAdapter("polar");
  const payload = JSON.stringify({ id: "evt_1", type: "subscription.updated" });
  const secret = "test-secret";
  const signature = createHmac("sha256", secret).update(payload).digest("hex");

  const isValid = adapter.verifySignature(payload, `v1=${signature}`, secret);
  assert.equal(isValid, true);
});

test("billing adapter rejects invalid hmac signature", () => {
  const adapter = getBillingProviderAdapter("polar");
  const payload = JSON.stringify({ id: "evt_2", type: "subscription.updated" });
  const secret = "test-secret";

  const isValid = adapter.verifySignature(payload, "v1=deadbeef", secret);
  assert.equal(isValid, false);
});

test("billing adapter allows missing secret for local mode", () => {
  const adapter = getBillingProviderAdapter("polar");
  const payload = JSON.stringify({ id: "evt_local", type: "local" });

  const isValid = adapter.verifySignature(payload, null, null);
  assert.equal(isValid, true);
});
