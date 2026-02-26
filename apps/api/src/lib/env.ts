import { z } from "zod";

const envSchema = z.object({
  REDIS_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(1).optional(),
  ENCRYPTION_SECRET: z.string().min(1).optional(),
  AI_PROVIDER_KEY: z.string().min(1).optional(),
  BILLING_PROVIDER: z.enum(["stripe", "polar"]).optional(),
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  POLAR_ACCESS_TOKEN: z.string().min(1).optional(),
  POLAR_ORGANIZATION_ID: z.string().min(1).optional(),
  POLAR_WEBHOOK_SECRET: z.string().min(1).optional(),
  TRIAL_DAYS: z.coerce.number().int().positive().optional()
});

export const env = envSchema.parse(process.env);
