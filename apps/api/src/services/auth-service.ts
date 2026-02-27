import { logger } from "@dataflow/utils";
import { sign, verify } from "hono/jwt";
import * as oidc from "openid-client";
import { Octokit } from "@octokit/rest";
import { z } from "zod";
import type { Database } from "../lib/db";
import { ApiError } from "../lib/api-error";
import { env } from "../lib/env";
import {
  createOAuthUser,
  findUserByEmail,
  findUserById,
  findUserByOAuthIdentity,
  type OAuthProvider,
  updateOAuthUserProfile,
} from "../repositories/users-repository";

const oauthStatePayloadSchema = z.object({
  typ: z.literal("oauth_state"),
  provider: z.enum(["github", "google"]),
  iat: z.number().int(),
  exp: z.number().int(),
});

const authTokenPayloadSchema = z.object({
  sub: z.string().uuid(),
  email: z.string().email().nullable().optional(),
  name: z.string().nullable().optional(),
  provider: z.enum(["github", "google"]).optional(),
  iat: z.number().int().optional(),
  exp: z.number().int().optional(),
  iss: z.string().optional(),
  aud: z.union([z.string(), z.array(z.string())]).optional(),
});

const googleUserSchema = z.object({
  sub: z.string().min(1),
  email: z.string().email().optional(),
  name: z.string().nullable().optional(),
  picture: z.string().url().nullable().optional(),
});

type OAuthProfile = {
  provider: OAuthProvider;
  subject: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

type AuthSession = {
  accessToken: string;
  tokenType: "Bearer";
  expiresInSeconds: number;
  user: {
    id: string;
    email: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    provider: OAuthProvider;
  };
};

export type AuthTokenPayload = z.infer<typeof authTokenPayloadSchema>;

const githubServerMetadata: oidc.ServerMetadata = {
  issuer: "https://github.com",
  authorization_endpoint: "https://github.com/login/oauth/authorize",
  token_endpoint: "https://github.com/login/oauth/access_token",
  userinfo_endpoint: "https://api.github.com/user",
};

let githubConfig: oidc.Configuration | null = null;
let googleConfigPromise: Promise<oidc.Configuration> | null = null;

function requireJwtSecret() {
  if (!env.JWT_SECRET) {
    throw new ApiError(
      500,
      "JWT_SECRET must be configured for auth.",
      "auth_misconfigured",
    );
  }

  return env.JWT_SECRET;
}

function getOAuthClient(provider: OAuthProvider) {
  if (provider === "github") {
    if (!env.OAUTH_GITHUB_CLIENT_ID || !env.OAUTH_GITHUB_CLIENT_SECRET) {
      throw new ApiError(
        503,
        "GitHub OAuth is not configured. Set OAUTH_GITHUB_CLIENT_ID and OAUTH_GITHUB_CLIENT_SECRET.",
        "oauth_provider_not_configured",
      );
    }

    return {
      clientId: env.OAUTH_GITHUB_CLIENT_ID,
      clientSecret: env.OAUTH_GITHUB_CLIENT_SECRET,
    };
  }

  if (!env.OAUTH_GOOGLE_CLIENT_ID || !env.OAUTH_GOOGLE_CLIENT_SECRET) {
    throw new ApiError(
      503,
      "Google OAuth is not configured. Set OAUTH_GOOGLE_CLIENT_ID and OAUTH_GOOGLE_CLIENT_SECRET.",
      "oauth_provider_not_configured",
    );
  }

  return {
    clientId: env.OAUTH_GOOGLE_CLIENT_ID,
    clientSecret: env.OAUTH_GOOGLE_CLIENT_SECRET,
  };
}

function resolveOAuthCallbackUrl(
  provider: OAuthProvider,
  requestOrigin: string,
) {
  if (provider === "github" && env.OAUTH_GITHUB_REDIRECT_URI) {
    return env.OAUTH_GITHUB_REDIRECT_URI;
  }

  if (provider === "google" && env.OAUTH_GOOGLE_REDIRECT_URI) {
    return env.OAUTH_GOOGLE_REDIRECT_URI;
  }

  return new URL("/api/v1/auth/oauth/callback", requestOrigin).toString();
}

function getOAuthScope(provider: OAuthProvider) {
  return provider === "github"
    ? "read:user user:email"
    : "openid email profile";
}

function toRecord(value: unknown) {
  if (!value || typeof value !== "object") {
    return {};
  }

  return value as Record<string, unknown>;
}

async function getGitHubConfiguration() {
  const { clientId, clientSecret } = getOAuthClient("github");

  if (!githubConfig) {
    githubConfig = new oidc.Configuration(
      githubServerMetadata,
      clientId,
      clientSecret,
      oidc.ClientSecretPost(clientSecret),
    );
  }

  return githubConfig;
}

async function getGoogleConfiguration() {
  const { clientId, clientSecret } = getOAuthClient("google");

  googleConfigPromise ??= oidc.discovery(
    new URL("https://accounts.google.com"),
    clientId,
    clientSecret,
    oidc.ClientSecretPost(clientSecret),
  );

  return googleConfigPromise;
}

async function getOAuthConfiguration(provider: OAuthProvider) {
  return provider === "github"
    ? getGitHubConfiguration()
    : getGoogleConfiguration();
}

async function exchangeCodeForTokens(
  config: oidc.Configuration,
  callbackUrl: string,
  stateToken: string,
  code: string,
) {
  const currentUrl = new URL(callbackUrl);
  currentUrl.searchParams.set("code", code);
  currentUrl.searchParams.set("state", stateToken);

  try {
    return await oidc.authorizationCodeGrant(
      config,
      currentUrl,
      {
        expectedState: stateToken,
      },
      {
        redirect_uri: callbackUrl,
      },
    );
  } catch (error) {
    logger.warn({ error }, "OAuth token exchange failed");
    throw new ApiError(
      502,
      "OAuth token exchange failed.",
      "oauth_token_exchange_failed",
    );
  }
}

async function fetchGitHubProfile(
  config: oidc.Configuration,
  accessToken: string,
): Promise<OAuthProfile> {
  // Keep openid-client for OAuth grant handling and use Octokit for GitHub API profile operations.
  if (!config.serverMetadata().userinfo_endpoint) {
    throw new ApiError(
      502,
      "GitHub userinfo endpoint is not configured.",
      "oauth_profile_fetch_failed",
    );
  }

  const octokit = new Octokit({
    auth: accessToken,
    userAgent: "dataflow-studio",
  });

  let profile;
  try {
    const { data } = await octokit.rest.users.getAuthenticated();
    profile = data;
  } catch (error) {
    logger.warn({ error }, "GitHub profile fetch failed");
    throw new ApiError(
      502,
      "GitHub user profile fetch failed.",
      "oauth_profile_fetch_failed",
    );
  }

  let email = profile.email ?? null;
  if (!email) {
    try {
      const { data: emails } =
        await octokit.rest.users.listEmailsForAuthenticatedUser();
      const preferred =
        emails.find((item) => item.primary && item.verified) ??
        emails.find((item) => item.verified);
      email = preferred?.email ?? emails[0]?.email ?? null;
    } catch (error) {
      logger.warn({ error }, "GitHub email fetch failed");
    }
  }

  return {
    provider: "github",
    subject: String(profile.id),
    email,
    displayName: profile.name ?? profile.login ?? null,
    avatarUrl: profile.avatar_url ?? null,
  };
}

async function fetchGoogleProfile(
  config: oidc.Configuration,
  accessToken: string,
): Promise<OAuthProfile> {
  let userInfo: oidc.UserInfoResponse;

  try {
    userInfo = await oidc.fetchUserInfo(
      config,
      accessToken,
      oidc.skipSubjectCheck,
    );
  } catch (error) {
    logger.warn({ error }, "Google userinfo fetch failed");
    throw new ApiError(
      502,
      "Google user profile fetch failed.",
      "oauth_profile_fetch_failed",
    );
  }

  const profile = googleUserSchema.parse(userInfo);

  return {
    provider: "google",
    subject: profile.sub,
    email: profile.email ?? null,
    displayName: profile.name ?? null,
    avatarUrl: profile.picture ?? null,
  };
}

async function resolveOAuthProfile(
  provider: OAuthProvider,
  config: oidc.Configuration,
  tokenResponse: oidc.TokenEndpointResponse,
) {
  const tokenData = toRecord(tokenResponse);
  const accessToken =
    typeof tokenData.access_token === "string"
      ? tokenData.access_token
      : undefined;

  if (!accessToken) {
    throw new ApiError(
      502,
      "OAuth provider did not return an access token.",
      "oauth_token_exchange_failed",
    );
  }

  return provider === "github"
    ? fetchGitHubProfile(config, accessToken)
    : fetchGoogleProfile(config, accessToken);
}

async function upsertOAuthUser(database: Database, profile: OAuthProfile) {
  const existingByIdentity = await findUserByOAuthIdentity(
    database,
    profile.provider,
    profile.subject,
  );
  if (existingByIdentity) {
    const updated = await updateOAuthUserProfile(
      database,
      existingByIdentity.id,
      {
        email: profile.email,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
      },
    );

    return updated ?? existingByIdentity;
  }

  if (profile.email) {
    const existingByEmail = await findUserByEmail(database, profile.email);
    if (existingByEmail) {
      throw new ApiError(
        409,
        "An account with this email already exists on another OAuth provider.",
        "oauth_email_conflict",
      );
    }
  }

  return createOAuthUser(database, {
    provider: profile.provider,
    subject: profile.subject,
    email: profile.email,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
  });
}

async function createAuthSessionForUser(user: {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  oauthProvider: OAuthProvider;
}): Promise<AuthSession> {
  const now = Math.floor(Date.now() / 1000);
  const expiresInSeconds = 60 * 60 * 24 * 7;

  const token = await sign(
    {
      sub: user.id,
      email: user.email,
      name: user.displayName,
      provider: user.oauthProvider,
      iss: "dataflow-studio-api",
      aud: "dataflow-studio",
      iat: now,
      exp: now + expiresInSeconds,
    },
    requireJwtSecret(),
    "HS256",
  );

  return {
    accessToken: token,
    tokenType: "Bearer",
    expiresInSeconds,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      provider: user.oauthProvider,
    },
  };
}

export async function createOAuthState(provider: OAuthProvider) {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    {
      typ: "oauth_state",
      provider,
      iat: now,
      exp: now + 60 * 10,
    },
    requireJwtSecret(),
    "HS256",
  );
}

export async function readOAuthState(stateToken: string) {
  try {
    const payload = await verify(stateToken, requireJwtSecret(), "HS256");
    return oauthStatePayloadSchema.parse(payload);
  } catch (error) {
    logger.warn({ error }, "OAuth state validation failed");
    throw new ApiError(
      400,
      "Invalid OAuth state token.",
      "invalid_oauth_state",
    );
  }
}

export async function getOAuthAuthorizationUrl(
  provider: OAuthProvider,
  requestOrigin: string,
  stateToken: string,
) {
  const callbackUrl = resolveOAuthCallbackUrl(provider, requestOrigin);
  const config = await getOAuthConfiguration(provider);

  return oidc
    .buildAuthorizationUrl(config, {
      redirect_uri: callbackUrl,
      scope: getOAuthScope(provider),
      state: stateToken,
    })
    .toString();
}

export async function completeOAuthSignIn(
  database: Database,
  input: {
    code: string;
    stateToken: string;
    requestOrigin: string;
  },
) {
  const state = await readOAuthState(input.stateToken);
  const callbackUrl = resolveOAuthCallbackUrl(
    state.provider,
    input.requestOrigin,
  );
  const config = await getOAuthConfiguration(state.provider);
  const tokenResponse = await exchangeCodeForTokens(
    config,
    callbackUrl,
    input.stateToken,
    input.code,
  );
  const profile = await resolveOAuthProfile(
    state.provider,
    config,
    tokenResponse,
  );
  const user = await upsertOAuthUser(database, profile);

  return createAuthSessionForUser(user);
}

export async function createDevSessionForUser(
  database: Database,
  userId: string,
) {
  if (env.NODE_ENV === "production") {
    throw new ApiError(
      403,
      "Dev session endpoint is disabled in production.",
      "forbidden",
    );
  }

  const user = await findUserById(database, userId);
  if (!user) {
    throw new ApiError(404, "User not found.", "user_not_found");
  }

  return createAuthSessionForUser(user);
}

export async function verifyAuthToken(token: string) {
  try {
    const payload = await verify(token, requireJwtSecret(), "HS256");
    return authTokenPayloadSchema.parse(payload);
  } catch (error) {
    logger.warn({ error }, "JWT verification failed");
    throw new ApiError(401, "Invalid or expired auth token.", "invalid_token");
  }
}
