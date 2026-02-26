import { ApiError } from "../lib/api-error";
import { countActiveWorkspaceSeats, findMembership } from "../repositories/memberships-repository";
import type { DbExecutor } from "../repositories/db-executor";

type MembershipRole = "owner" | "admin" | "editor" | "viewer";

export async function requireWorkspaceAccess(
  database: DbExecutor,
  workspaceId: string,
  userId: string,
  allowedRoles: MembershipRole[] = ["owner", "admin", "editor", "viewer"]
) {
  const membership = await findMembership(database, workspaceId, userId);

  if (!membership) {
    throw new ApiError(403, "You do not have access to this workspace.", "forbidden_workspace");
  }

  if (!allowedRoles.includes(membership.role)) {
    throw new ApiError(403, "Insufficient workspace role.", "insufficient_workspace_role");
  }

  return membership;
}

export async function getWorkspaceSeatCount(database: DbExecutor, workspaceId: string) {
  return countActiveWorkspaceSeats(database, workspaceId);
}
