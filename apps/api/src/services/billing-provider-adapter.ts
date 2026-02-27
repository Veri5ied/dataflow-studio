import { createHmac, timingSafeEqual } from "node:crypto";
import type { BillingProvider } from "../repositories/billing-repository";

export type BillingProviderAdapter = {
  provider: BillingProvider;
  getCheckoutUrl: (workspaceId: string) => string;
  getPortalUrl: (workspaceId: string) => string;
  verifySignature: (
    rawBody: string,
    signatureHeader: string | null,
    webhookSecret: string | null | undefined,
  ) => boolean;
};

function parseSignatureCandidates(signatureHeader: string) {
  return signatureHeader
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((part) => {
      const index = part.indexOf("=");
      return index >= 0 ? part.slice(index + 1) : part;
    });
}

function verifyHmacSha256(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string | null | undefined,
) {
  if (!webhookSecret) {
    return true;
  }

  if (!signatureHeader) {
    return false;
  }

  const expected = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  const expectedBuffer = Buffer.from(expected);

  return parseSignatureCandidates(signatureHeader).some((candidate) => {
    const candidateBuffer = Buffer.from(candidate);
    return (
      candidateBuffer.length === expectedBuffer.length &&
      timingSafeEqual(candidateBuffer, expectedBuffer)
    );
  });
}

const adapters: Record<BillingProvider, BillingProviderAdapter> = {
  polar: {
    provider: "polar",
    getCheckoutUrl: (workspaceId) => `https://polar.sh/checkout/mock/${workspaceId}`,
    getPortalUrl: (workspaceId) => `https://polar.sh/portal/mock/${workspaceId}`,
    verifySignature: verifyHmacSha256,
  },
  stripe: {
    provider: "stripe",
    getCheckoutUrl: (workspaceId) => `https://dashboard.stripe.com/payments/mock/${workspaceId}`,
    getPortalUrl: (workspaceId) => `https://dashboard.stripe.com/customers/mock/${workspaceId}`,
    verifySignature: verifyHmacSha256,
  },
};

export function getBillingProviderAdapter(provider: BillingProvider) {
  return adapters[provider];
}
