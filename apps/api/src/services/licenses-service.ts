import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { ApiError } from "../lib/api-error";
import type { Database } from "../lib/db";
import { assertEnterpriseLicensingEnabled } from "../lib/commercial-mode";
import { env } from "../lib/env";
import {
  deactivateLicenseActivation,
  findEnterpriseLicenseByWorkspaceId,
  findLicenseActivationByFingerprint,
  insertLicenseAuditEvent,
  listActiveLicenseActivations,
  upsertEnterpriseLicenseByWorkspace,
  upsertLicenseActivation,
} from "../repositories/licenses-repository";
import { upsertUsageCounter } from "../repositories/usage-repository";
import { requireWorkspaceAccess } from "./memberships-service";
import { getCurrentMonthlyPeriod } from "./usage-service";

type LicenseClaims = {
  licenseId: string;
  workspaceId: string;
  planCode: string;
  seatsMax: number;
  aiEnabled: boolean;
  features?: string[];
  activationLimit?: number;
  issuedAt: string;
  expiresAt: string;
  metadata?: Record<string, unknown>;
};

export type ActivateLicenseInput = {
  workspaceId: string;
  licenseKey: string;
  instanceFingerprint: string;
};

export type DeactivateLicenseInput = {
  workspaceId: string;
  instanceFingerprint: string;
};

function hashLicenseKey(licenseKey: string) {
  return createHash("sha256").update(licenseKey).digest("hex");
}

function decodeLicensePayload(encodedPayload: string): LicenseClaims {
  try {
    const payloadJson = Buffer.from(encodedPayload, "base64url").toString(
      "utf8",
    );
    return JSON.parse(payloadJson) as LicenseClaims;
  } catch {
    throw new ApiError(400, "Invalid license payload.", "invalid_license_key");
  }
}

function parseIsoDate(value: string, field: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ApiError(
      400,
      `Invalid ${field} in license payload.`,
      "invalid_license_key",
    );
  }

  return parsed;
}

function assertLicenseSecretConfigured() {
  const secret = env.LICENSE_VERIFICATION_SECRET;
  if (!secret) {
    throw new ApiError(
      503,
      "License verification secret is not configured.",
      "license_verification_unavailable",
    );
  }

  return secret;
}

function verifyLicenseSignature(
  payloadSegment: string,
  signatureSegment: string,
  secret: string,
) {
  const expected = createHmac("sha256", secret)
    .update(payloadSegment)
    .digest("base64url");

  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(signatureSegment, "utf8");
  return (
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer)
  );
}

function parseLicenseKey(licenseKey: string) {
  const raw = licenseKey.trim();
  const normalized = raw.startsWith("dfls_") ? raw.slice(5) : raw;
  const [payloadSegment, signatureSegment] = normalized.split(".");
  if (!payloadSegment || !signatureSegment) {
    throw new ApiError(
      400,
      "License key format is invalid.",
      "invalid_license_key",
    );
  }

  return { payloadSegment, signatureSegment };
}

function verifyAndDecodeLicenseKey(licenseKey: string) {
  const secret = assertLicenseSecretConfigured();
  const { payloadSegment, signatureSegment } = parseLicenseKey(licenseKey);

  if (!verifyLicenseSignature(payloadSegment, signatureSegment, secret)) {
    throw new ApiError(
      401,
      "License signature is invalid.",
      "invalid_license_signature",
    );
  }

  const claims = decodeLicensePayload(payloadSegment);
  if (
    !claims.licenseId ||
    !claims.workspaceId ||
    !claims.planCode ||
    !claims.issuedAt ||
    !claims.expiresAt ||
    typeof claims.seatsMax !== "number"
  ) {
    throw new ApiError(
      400,
      "License claims are incomplete.",
      "invalid_license_key",
    );
  }

  const issuedAt = parseIsoDate(claims.issuedAt, "issuedAt");
  const expiresAt = parseIsoDate(claims.expiresAt, "expiresAt");
  if (expiresAt.getTime() <= issuedAt.getTime()) {
    throw new ApiError(
      400,
      "License expiry must be after issue date.",
      "invalid_license_key",
    );
  }

  return {
    claims: {
      ...claims,
      features: claims.features ?? [],
      activationLimit:
        typeof claims.activationLimit === "number" && claims.activationLimit > 0
          ? Math.floor(claims.activationLimit)
          : 1,
      aiEnabled: Boolean(claims.aiEnabled),
      seatsMax: Math.max(1, Math.floor(claims.seatsMax)),
    },
    issuedAt,
    expiresAt,
  };
}

function assertFingerprint(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length < 8) {
    throw new ApiError(
      400,
      "instanceFingerprint must be at least 8 characters.",
      "invalid_instance_fingerprint",
    );
  }

  return trimmed;
}

export async function activateEnterpriseLicenseForUser(
  database: Database,
  userId: string,
  input: ActivateLicenseInput,
) {
  assertEnterpriseLicensingEnabled();
  await requireWorkspaceAccess(database, input.workspaceId, userId, [
    "owner",
    "admin",
  ]);

  const fingerprint = assertFingerprint(input.instanceFingerprint);
  const { claims, expiresAt } = verifyAndDecodeLicenseKey(input.licenseKey);

  if (claims.workspaceId !== input.workspaceId) {
    throw new ApiError(
      400,
      "License does not match target workspace.",
      "license_workspace_mismatch",
    );
  }

  if (expiresAt.getTime() <= Date.now()) {
    throw new ApiError(402, "License has expired.", "license_expired");
  }

  return database.transaction(async (tx) => {
    const license = await upsertEnterpriseLicenseByWorkspace(tx, {
      workspaceId: input.workspaceId,
      licenseId: claims.licenseId,
      licenseKeyHash: hashLicenseKey(input.licenseKey),
      planCode: claims.planCode,
      status: "active",
      seatsMax: claims.seatsMax,
      aiEnabled: claims.aiEnabled,
      expiresAt,
      lastValidatedAt: new Date(),
      metadata: {
        features: claims.features,
        activationLimit: claims.activationLimit,
        source: "license_key",
        ...(claims.metadata ?? {}),
      },
    });

    const existingActivation = await findLicenseActivationByFingerprint(
      tx,
      license.id,
      fingerprint,
    );
    const activeActivations = await listActiveLicenseActivations(
      tx,
      license.id,
    );
    const activeCountExcludingCurrent =
      existingActivation && !existingActivation.deactivatedAt
        ? Math.max(0, activeActivations.length - 1)
        : activeActivations.length;

    if (activeCountExcludingCurrent >= claims.activationLimit) {
      throw new ApiError(
        409,
        `Activation limit reached (${claims.activationLimit}).`,
        "license_activation_limit_reached",
      );
    }

    const activation = await upsertLicenseActivation(tx, {
      licenseId: license.id,
      instanceFingerprint: fingerprint,
      activatedByUserId: userId,
      metadata: {
        activationLimit: claims.activationLimit,
      },
    });

    const { periodStart, periodEnd } = getCurrentMonthlyPeriod();
    await upsertUsageCounter(tx, {
      workspaceId: input.workspaceId,
      metricCode: "seats",
      periodStart,
      periodEnd,
      quantity: 0,
      limitQuantity: claims.seatsMax,
    });

    await insertLicenseAuditEvent(tx, {
      workspaceId: input.workspaceId,
      licenseId: license.id,
      actorUserId: userId,
      eventType: "activated",
      payload: {
        instanceFingerprint: fingerprint,
        seatsMax: claims.seatsMax,
        aiEnabled: claims.aiEnabled,
      },
    });

    return {
      license,
      activation,
      entitlements: {
        seatsMax: claims.seatsMax,
        aiEnabled: claims.aiEnabled,
        features: claims.features,
        activationLimit: claims.activationLimit,
        expiresAt,
      },
    };
  });
}

export async function getWorkspaceLicenseStatusForUser(
  database: Database,
  userId: string,
  workspaceId: string,
) {
  assertEnterpriseLicensingEnabled();
  await requireWorkspaceAccess(database, workspaceId, userId, [
    "owner",
    "admin",
    "editor",
    "viewer",
  ]);

  const license = await findEnterpriseLicenseByWorkspaceId(
    database,
    workspaceId,
  );
  if (!license) {
    return {
      configured: false,
      license: null,
      activeActivations: [],
      graceHours: env.LICENSE_SYNC_GRACE_HOURS ?? 72,
    };
  }

  const activeActivations = await listActiveLicenseActivations(
    database,
    license.id,
  );
  const now = Date.now();
  const expiresAtMs = license.expiresAt.getTime();
  const isExpired = expiresAtMs <= now;
  const graceHours = env.LICENSE_SYNC_GRACE_HOURS ?? 72;
  const lastValidatedAtMs = license.lastValidatedAt?.getTime() ?? 0;
  const graceDeadlineMs = lastValidatedAtMs + graceHours * 60 * 60 * 1000;

  return {
    configured: true,
    license: {
      ...license,
      status: isExpired ? "expired" : license.status,
      withinGraceWindow: !isExpired && graceDeadlineMs >= now,
      graceDeadlineAt: license.lastValidatedAt
        ? new Date(graceDeadlineMs)
        : null,
    },
    activeActivations,
    graceHours,
  };
}

export async function deactivateEnterpriseLicenseForUser(
  database: Database,
  userId: string,
  input: DeactivateLicenseInput,
) {
  assertEnterpriseLicensingEnabled();
  await requireWorkspaceAccess(database, input.workspaceId, userId, [
    "owner",
    "admin",
  ]);

  const fingerprint = assertFingerprint(input.instanceFingerprint);
  const license = await findEnterpriseLicenseByWorkspaceId(
    database,
    input.workspaceId,
  );
  if (!license) {
    throw new ApiError(
      404,
      "No enterprise license is configured.",
      "license_not_found",
    );
  }

  const activation = await deactivateLicenseActivation(
    database,
    license.id,
    fingerprint,
  );
  if (!activation) {
    throw new ApiError(
      404,
      "Activation not found for fingerprint.",
      "activation_not_found",
    );
  }

  await insertLicenseAuditEvent(database, {
    workspaceId: input.workspaceId,
    licenseId: license.id,
    actorUserId: userId,
    eventType: "deactivated",
    payload: {
      instanceFingerprint: fingerprint,
    },
  });

  return {
    deactivated: true,
    activation,
  };
}
