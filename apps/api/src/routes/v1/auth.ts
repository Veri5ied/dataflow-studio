import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../../lib/auth";
import { handleRouteError } from "../../lib/handle-route-error";
import { requireDb } from "../../lib/require-db";
import { requireRequestUserId } from "../../lib/request-user";
import {
  completeOAuthSignIn,
  createDevSessionForUser,
  createOAuthState,
  getOAuthAuthorizationUrl
} from "../../services/auth-service";
import { findUserById } from "../../repositories/users-repository";

const callbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1)
});

const devSessionSchema = z.object({
  userId: z.string().uuid()
});

function getRequestOrigin(rawUrl: string) {
  return new URL(rawUrl).origin;
}

export const authRoutes = new Hono()
  .get("/oauth/github", async (c) => {
    try {
      const stateToken = await createOAuthState("github");
      const authorizeUrl = await getOAuthAuthorizationUrl("github", getRequestOrigin(c.req.url), stateToken);
      return c.redirect(authorizeUrl, 302);
    } catch (error) {
      return handleRouteError(c, error);
    }
  })
  .get("/oauth/google", async (c) => {
    try {
      const stateToken = await createOAuthState("google");
      const authorizeUrl = await getOAuthAuthorizationUrl("google", getRequestOrigin(c.req.url), stateToken);
      return c.redirect(authorizeUrl, 302);
    } catch (error) {
      return handleRouteError(c, error);
    }
  })
  .get("/oauth/callback", async (c) => {
    try {
      const database = requireDb();
      const query = callbackQuerySchema.parse(c.req.query());
      const session = await completeOAuthSignIn(database, {
        code: query.code,
        stateToken: query.state,
        requestOrigin: getRequestOrigin(c.req.url)
      });
      return c.json(session);
    } catch (error) {
      return handleRouteError(c, error);
    }
  })
  .post("/dev/session", async (c) => {
    try {
      const database = requireDb();
      const payload = devSessionSchema.parse(await c.req.json());
      const session = await createDevSessionForUser(database, payload.userId);
      return c.json(session, 201);
    } catch (error) {
      return handleRouteError(c, error);
    }
  })
  .get("/me", requireAuth, async (c) => {
    try {
      const database = requireDb();
      const userId = requireRequestUserId(c);
      const user = await findUserById(database, userId);

      if (!user) {
        return c.json({ error: "Authenticated user was not found.", code: "user_not_found" }, 404);
      }

      return c.json({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        provider: user.oauthProvider
      });
    } catch (error) {
      return handleRouteError(c, error);
    }
  });
