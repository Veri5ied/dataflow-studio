import { z } from "zod";

const appEnvSchema = z.object({
  OAUTH_GITHUB_CLIENT_ID: z.string().optional(),
  OAUTH_GITHUB_CLIENT_SECRET: z.string().optional(),
  OAUTH_GOOGLE_CLIENT_ID: z.string().optional(),
  OAUTH_GOOGLE_CLIENT_SECRET: z.string().optional(),
  REDIS_URL: z.string().optional(),
  JWT_SECRET: z.string().optional(),
  ENCRYPTION_SECRET: z.string().optional(),
  AI_PROVIDER_KEY: z.string().optional()
});

export type AppEnv = z.infer<typeof appEnvSchema>;

export function readAppEnv(input: unknown = process.env): AppEnv {
  return appEnvSchema.parse(input);
}
