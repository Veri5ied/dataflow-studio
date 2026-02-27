import { and, eq } from "drizzle-orm";
import { oauthProviderEnum, users } from "../db/schema";
import type { DbExecutor } from "./db-executor";

export async function findUserById(executor: DbExecutor, userId: string) {
  const [user] = await executor.select().from(users).where(eq(users.id, userId)).limit(1);
  return user ?? null;
}

export type OAuthProvider = (typeof oauthProviderEnum.enumValues)[number];

export async function findUserByOAuthIdentity(
  executor: DbExecutor,
  provider: OAuthProvider,
  subject: string
) {
  const [user] = await executor
    .select()
    .from(users)
    .where(and(eq(users.oauthProvider, provider), eq(users.oauthSubject, subject)))
    .limit(1);
  return user ?? null;
}

export async function findUserByEmail(executor: DbExecutor, email: string) {
  const [user] = await executor.select().from(users).where(eq(users.email, email)).limit(1);
  return user ?? null;
}

export type UpsertOAuthUserInput = {
  provider: OAuthProvider;
  subject: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

export async function createOAuthUser(executor: DbExecutor, input: UpsertOAuthUserInput) {
  const [user] = await executor
    .insert(users)
    .values({
      oauthProvider: input.provider,
      oauthSubject: input.subject,
      email: input.email,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl
    })
    .returning();

  return user;
}

export async function updateOAuthUserProfile(
  executor: DbExecutor,
  userId: string,
  input: Pick<UpsertOAuthUserInput, "email" | "displayName" | "avatarUrl">
) {
  const [user] = await executor
    .update(users)
    .set({
      email: input.email,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl,
      updatedAt: new Date()
    })
    .where(eq(users.id, userId))
    .returning();

  return user ?? null;
}
