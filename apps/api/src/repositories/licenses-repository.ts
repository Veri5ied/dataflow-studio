import { and, desc, eq, isNull } from "drizzle-orm";
import {
  enterpriseLicenses,
  licenseActivations,
  licenseAuditEvents,
} from "../db/schema";
import type { DbExecutor } from "./db-executor";

export type LicenseStatus = "active" | "expired" | "revoked";
export type LicenseEventType =
  | "activated"
  | "deactivated"
  | "refreshed"
  | "revoked"
  | "sync_failed";

export async function findEnterpriseLicenseByWorkspaceId(
  executor: DbExecutor,
  workspaceId: string,
) {
  const [license] = await executor
    .select()
    .from(enterpriseLicenses)
    .where(eq(enterpriseLicenses.workspaceId, workspaceId))
    .limit(1);

  return license ?? null;
}

export async function upsertEnterpriseLicenseByWorkspace(
  executor: DbExecutor,
  values: {
    workspaceId: string;
    licenseId: string;
    licenseKeyHash: string;
    planCode: string;
    status: LicenseStatus;
    seatsMax: number;
    aiEnabled: boolean;
    expiresAt: Date;
    lastValidatedAt: Date;
    metadata?: Record<string, unknown>;
  },
) {
  const [license] = await executor
    .insert(enterpriseLicenses)
    .values({
      workspaceId: values.workspaceId,
      licenseId: values.licenseId,
      licenseKeyHash: values.licenseKeyHash,
      planCode: values.planCode,
      status: values.status,
      seatsMax: values.seatsMax,
      aiEnabled: values.aiEnabled,
      expiresAt: values.expiresAt,
      lastValidatedAt: values.lastValidatedAt,
      metadata: values.metadata ?? {},
    })
    .onConflictDoUpdate({
      target: enterpriseLicenses.workspaceId,
      set: {
        licenseId: values.licenseId,
        licenseKeyHash: values.licenseKeyHash,
        planCode: values.planCode,
        status: values.status,
        seatsMax: values.seatsMax,
        aiEnabled: values.aiEnabled,
        expiresAt: values.expiresAt,
        lastValidatedAt: values.lastValidatedAt,
        metadata: values.metadata ?? {},
        updatedAt: new Date(),
      },
    })
    .returning();

  return license;
}

export async function listActiveLicenseActivations(
  executor: DbExecutor,
  licenseId: string,
) {
  return executor
    .select()
    .from(licenseActivations)
    .where(
      and(
        eq(licenseActivations.licenseId, licenseId),
        isNull(licenseActivations.deactivatedAt),
      ),
    )
    .orderBy(desc(licenseActivations.activatedAt));
}

export async function findLicenseActivationByFingerprint(
  executor: DbExecutor,
  licenseId: string,
  instanceFingerprint: string,
) {
  const [activation] = await executor
    .select()
    .from(licenseActivations)
    .where(
      and(
        eq(licenseActivations.licenseId, licenseId),
        eq(licenseActivations.instanceFingerprint, instanceFingerprint),
      ),
    )
    .orderBy(desc(licenseActivations.createdAt))
    .limit(1);

  return activation ?? null;
}

export async function upsertLicenseActivation(
  executor: DbExecutor,
  values: {
    licenseId: string;
    instanceFingerprint: string;
    activatedByUserId: string;
    metadata?: Record<string, unknown>;
  },
) {
  const [activation] = await executor
    .insert(licenseActivations)
    .values({
      licenseId: values.licenseId,
      instanceFingerprint: values.instanceFingerprint,
      activatedByUserId: values.activatedByUserId,
      activatedAt: new Date(),
      deactivatedAt: null,
      lastSeenAt: new Date(),
      metadata: values.metadata ?? {},
    })
    .onConflictDoUpdate({
      target: [licenseActivations.licenseId, licenseActivations.instanceFingerprint],
      set: {
        activatedByUserId: values.activatedByUserId,
        activatedAt: new Date(),
        deactivatedAt: null,
        lastSeenAt: new Date(),
        metadata: values.metadata ?? {},
        updatedAt: new Date(),
      },
    })
    .returning();

  return activation;
}

export async function deactivateLicenseActivation(
  executor: DbExecutor,
  licenseId: string,
  instanceFingerprint: string,
) {
  const [activation] = await executor
    .update(licenseActivations)
    .set({
      deactivatedAt: new Date(),
      lastSeenAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(licenseActivations.licenseId, licenseId),
        eq(licenseActivations.instanceFingerprint, instanceFingerprint),
        isNull(licenseActivations.deactivatedAt),
      ),
    )
    .returning();

  return activation ?? null;
}

export async function insertLicenseAuditEvent(
  executor: DbExecutor,
  values: {
    workspaceId: string;
    licenseId: string | null;
    actorUserId: string | null;
    eventType: LicenseEventType;
    payload?: Record<string, unknown>;
  },
) {
  const [event] = await executor
    .insert(licenseAuditEvents)
    .values({
      workspaceId: values.workspaceId,
      licenseId: values.licenseId,
      actorUserId: values.actorUserId,
      eventType: values.eventType,
      payload: values.payload ?? {},
    })
    .returning();

  return event;
}
