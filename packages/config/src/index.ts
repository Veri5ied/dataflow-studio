import { z } from "zod";

const emptyStringToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalString = z.preprocess(emptyStringToUndefined, z.string().optional());
const optionalUrl = z.preprocess(emptyStringToUndefined, z.string().url().optional());
const optionalBillingProvider = z.preprocess(
  emptyStringToUndefined,
  z.enum(["stripe", "polar"]).optional()
);
const optionalPositiveInt = z.preprocess(
  emptyStringToUndefined,
  z.coerce.number().int().positive().optional()
);

const appEnvSchema = z.object({
  OAUTH_GITHUB_CLIENT_ID: optionalString,
  OAUTH_GITHUB_CLIENT_SECRET: optionalString,
  OAUTH_GOOGLE_CLIENT_ID: optionalString,
  OAUTH_GOOGLE_CLIENT_SECRET: optionalString,
  APP_DATABASE_URL: optionalUrl,
  REDIS_URL: optionalUrl,
  JWT_SECRET: optionalString,
  ENCRYPTION_SECRET: optionalString,
  AI_PROVIDER_KEY: optionalString,
  BILLING_PROVIDER: optionalBillingProvider,
  STRIPE_SECRET_KEY: optionalString,
  STRIPE_WEBHOOK_SECRET: optionalString,
  POLAR_ACCESS_TOKEN: optionalString,
  POLAR_ORGANIZATION_ID: optionalString,
  POLAR_WEBHOOK_SECRET: optionalString,
  TRIAL_DAYS: optionalPositiveInt
});

export type AppEnv = z.infer<typeof appEnvSchema>;

export function readAppEnv(input: unknown = process.env): AppEnv {
  return appEnvSchema.parse(input);
}
