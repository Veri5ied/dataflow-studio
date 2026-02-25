import { z } from "zod";

const appEnvSchema = z.object({
  OAUTH_GITHUB_CLIENT_ID: z.string().optional(),
  OAUTH_GITHUB_CLIENT_SECRET: z.string().optional(),
  OAUTH_GOOGLE_CLIENT_ID: z.string().optional(),
  OAUTH_GOOGLE_CLIENT_SECRET: z.string().optional(),
  REDIS_URL: z.string().optional(),
  JWT_SECRET: z.string().optional(),
  ENCRYPTION_SECRET: z.string().optional(),
  AI_PROVIDER_KEY: z.string().optional(),
  BILLING_PROVIDER: z.enum(["stripe"]).optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  TRIAL_DAYS: z.coerce.number().int().positive().optional()
});

export type AppEnv = z.infer<typeof appEnvSchema>;

export function readAppEnv(input: unknown = process.env): AppEnv {
  return appEnvSchema.parse(input);
}
