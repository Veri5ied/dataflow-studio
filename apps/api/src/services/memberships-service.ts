import { ApiError } from "../lib/api-error";
import { isSelfHostedEnterprise } from "../lib/commercial-mode";
import type { Database } from "../lib/db";
import { findEnterpriseLicenseByWorkspaceId } from "../repositories/licenses-repository";
import { findUserByEmail, findUserById } from "../repositories/users-repository";
import {
  countActiveWorkspaceSeats,
  createWorkspaceInvite,
  findMembership,
  findPendingInviteByToken,
  findPendingInviteByWorkspaceAndEmail,
  listPendingWorkspaceInvites,
  listWorkspaceMembers,
  markInviteAccepted,
  markInviteExpired,
  updateWorkspaceInvite,
  upsertWorkspaceMembership,
} from "../repositories/memberships-repository";
import type { DbExecutor } from "../repositories/db-executor";
import { getWorkspaceCurrentUsage } from "./usage-service";
import { randomBytes } from "node:crypto";

export type MembershipRole = "owner" | "admin" | "editor" | "viewer";
export type InvitableMembershipRole = Exclude<MembershipRole, "owner">;

type InviteWorkspaceMemberInput = {
  email: string;
  role: InvitableMembershipRole;
  expiresInDays?: number;
};

type AcceptWorkspaceInviteInput = {
  inviteToken: string;
};

const DEFAULT_INVITE_EXPIRY_DAYS = 7;
const MAX_INVITE_EXPIRY_DAYS = 30;

function normalizeInviteEmail(value: string) {
  return value.trim().toLowerCase();
}

function buildInviteToken() {
  return randomBytes(24).toString("hex");
}

function getInviteExpiryDate(expiresInDays = DEFAULT_INVITE_EXPIRY_DAYS) {
  const safeDays = Math.max(1, Math.min(MAX_INVITE_EXPIRY_DAYS, expiresInDays));
  return new Date(Date.now() + safeDays * 24 * 60 * 60 * 1000);
}

function isExpired(date: Date) {
  return date.getTime() <= Date.now();
}

export async function requireWorkspaceAccess(
  database: DbExecutor,
  workspaceId: string,
  userId: string,
  allowedRoles: MembershipRole[] = ["owner", "admin", "editor", "viewer"],
) {
  const membership = await findMembership(database, workspaceId, userId);

  if (!membership) {
    throw new ApiError(
      403,
      "You do not have access to this workspace.",
      "forbidden_workspace",
    );
  }

  if (!allowedRoles.includes(membership.role)) {
    throw new ApiError(
      403,
      "Insufficient workspace role.",
      "insufficient_workspace_role",
    );
  }

  return membership;
}

export async function getWorkspaceSeatCount(
  database: DbExecutor,
  workspaceId: string,
) {
  return countActiveWorkspaceSeats(database, workspaceId);
}

export async function getWorkspaceSeatLimit(
  database: DbExecutor,
  workspaceId: string,
) {
  const usage = await getWorkspaceCurrentUsage(database, workspaceId);
  const seatsUsage = usage.find((item) => item.metricCode === "seats");
  return seatsUsage?.limitQuantity ?? null;
}

export async function enforceWorkspaceSeatCapacity(
  database: DbExecutor,
  workspaceId: string,
  additionalSeats: number,
) {
  if (additionalSeats <= 0) {
    return {
      seatsUsed: await countActiveWorkspaceSeats(database, workspaceId),
      seatLimit: await getWorkspaceSeatLimit(database, workspaceId),
    };
  }

  const [seatsUsed, seatLimit] = await Promise.all([
    countActiveWorkspaceSeats(database, workspaceId),
    getWorkspaceSeatLimit(database, workspaceId),
  ]);

  let effectiveSeatLimit = seatLimit;
  if (isSelfHostedEnterprise() && effectiveSeatLimit === null) {
    const license = await findEnterpriseLicenseByWorkspaceId(database, workspaceId);
    if (!license || license.status !== "active" || license.expiresAt.getTime() <= Date.now()) {
      throw new ApiError(
        402,
        "Enterprise license is required to add seats in self-host enterprise mode.",
        "enterprise_license_required_for_seats",
      );
    }

    effectiveSeatLimit = license.seatsMax;
  }

  if (effectiveSeatLimit !== null && seatsUsed + additionalSeats > effectiveSeatLimit) {
    throw new ApiError(
      409,
      "Seat limit reached for workspace subscription.",
      "workspace_seat_limit_reached",
    );
  }

  return { seatsUsed, seatLimit: effectiveSeatLimit };
}

export async function listWorkspaceMembersForUser(
  database: DbExecutor,
  workspaceId: string,
  userId: string,
) {
  await requireWorkspaceAccess(database, workspaceId, userId);
  return listWorkspaceMembers(database, workspaceId);
}

export async function listWorkspacePendingInvitesForUser(
  database: DbExecutor,
  workspaceId: string,
  userId: string,
) {
  await requireWorkspaceAccess(database, workspaceId, userId, ["owner", "admin"]);
  return listPendingWorkspaceInvites(database, workspaceId);
}

export async function inviteWorkspaceMemberForUser(
  database: DbExecutor,
  workspaceId: string,
  userId: string,
  input: InviteWorkspaceMemberInput,
) {
  await requireWorkspaceAccess(database, workspaceId, userId, ["owner", "admin"]);

  const email = normalizeInviteEmail(input.email);
  const existingUser = await findUserByEmail(database, email);

  if (existingUser) {
    const existingMembership = await findMembership(
      database,
      workspaceId,
      existingUser.id,
    );
    if (existingMembership) {
      throw new ApiError(
        409,
        "User is already an active workspace member.",
        "workspace_member_exists",
      );
    }
  }

  const inviteToken = buildInviteToken();
  const expiresAt = getInviteExpiryDate(input.expiresInDays);
  const existingInvite = await findPendingInviteByWorkspaceAndEmail(
    database,
    workspaceId,
    email,
  );

  const invite = existingInvite
    ? await updateWorkspaceInvite(database, existingInvite.id, {
        invitedByUserId: userId,
        role: input.role,
        inviteToken,
        expiresAt,
      })
    : await createWorkspaceInvite(database, {
        workspaceId,
        invitedByUserId: userId,
        email,
        role: input.role,
        inviteToken,
        expiresAt,
      });

  if (!invite) {
    throw new ApiError(
      500,
      "Failed to persist workspace invite.",
      "invite_persist_failed",
    );
  }

  return {
    invite,
    acceptance: {
      inviteToken,
      expiresAt,
      workspaceId,
    },
  };
}

export async function acceptWorkspaceInviteForUser(
  database: Database,
  userId: string,
  input: AcceptWorkspaceInviteInput,
) {
  const user = await findUserById(database, userId);
  if (!user) {
    throw new ApiError(
      404,
      "Authenticated user does not exist.",
      "user_not_found",
    );
  }

  const userEmail = user.email ? normalizeInviteEmail(user.email) : null;
  if (!userEmail) {
    throw new ApiError(
      400,
      "Authenticated user must have an email to accept invites.",
      "user_email_required",
    );
  }

  const invite = await findPendingInviteByToken(database, input.inviteToken);
  if (!invite) {
    throw new ApiError(404, "Invite not found.", "invite_not_found");
  }

  if (isExpired(invite.expiresAt)) {
    await markInviteExpired(database, invite.id);
    throw new ApiError(410, "Invite has expired.", "invite_expired");
  }

  if (normalizeInviteEmail(invite.email) !== userEmail) {
    throw new ApiError(
      403,
      "Invite email does not match authenticated user.",
      "invite_email_mismatch",
    );
  }

  const existingMembership = await findMembership(database, invite.workspaceId, userId);
  if (existingMembership) {
    await markInviteAccepted(database, invite.id, userId);
    return {
      workspaceId: invite.workspaceId,
      membership: existingMembership,
      inviteAccepted: true,
      alreadyMember: true,
    };
  }

  await enforceWorkspaceSeatCapacity(database, invite.workspaceId, 1);

  return database.transaction(async (tx) => {
    const membership = await upsertWorkspaceMembership(tx, {
      workspaceId: invite.workspaceId,
      userId,
      role: invite.role,
      status: "active",
    });

    await markInviteAccepted(tx, invite.id, userId);

    return {
      workspaceId: invite.workspaceId,
      membership,
      inviteAccepted: true,
      alreadyMember: false,
    };
  });
}
