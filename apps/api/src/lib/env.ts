import { z } from "zod";

const envSchema = z.object({
  REDIS_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(1).optional(),
  ENCRYPTION_SECRET: z.string().min(1).optional(),
  AI_PROVIDER_KEY: z.string().min(1).optional()
});

export const env = envSchema.parse(process.env);
