import { createHmac, timingSafeEqual } from "node:crypto";
import type { BillingProvider } from "../repositories/billing-repository";
import { env } from "../lib/env";

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

function joinPath(baseUrl: string, path: string) {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const normalizedPath = path.replace(/^\/+/, "");
  return `${normalizedBase}/${normalizedPath}`;
}

function requireEnvUrl(
  value: string | undefined,
  envVarName: "POLAR_CHECKOUT_BASE_URL" | "POLAR_PORTAL_BASE_URL",
) {
  if (!value) {
    throw new Error(`${envVarName} is required for Polar billing URLs.`);
  }

  return value;
}

const adapters: Record<BillingProvider, BillingProviderAdapter> = {
  polar: {
    provider: "polar",
    getCheckoutUrl: (workspaceId) =>
      joinPath(
        requireEnvUrl(env.POLAR_CHECKOUT_BASE_URL, "POLAR_CHECKOUT_BASE_URL"),
        workspaceId,
      ),
    getPortalUrl: (workspaceId) =>
      joinPath(
        requireEnvUrl(env.POLAR_PORTAL_BASE_URL, "POLAR_PORTAL_BASE_URL"),
        workspaceId,
      ),
    verifySignature: verifyHmacSha256,
  },
};

export function getBillingProviderAdapter(provider: BillingProvider) {
  return adapters[provider];
}
