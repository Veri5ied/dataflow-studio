import "dotenv/config";
import { z } from "zod";

const emptyStringToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalUrl = z.preprocess(emptyStringToUndefined, z.string().url().optional());
const optionalNonEmptyString = z.preprocess(emptyStringToUndefined, z.string().min(1).optional());
const optionalBillingProvider = z.preprocess(
  emptyStringToUndefined,
  z.enum(["stripe", "polar"]).optional()
);
const optionalPositiveInt = z.preprocess(
  emptyStringToUndefined,
  z.coerce.number().int().positive().optional()
);

const envSchema = z.object({
  OAUTH_GITHUB_CLIENT_ID: optionalNonEmptyString,
  OAUTH_GITHUB_CLIENT_SECRET: optionalNonEmptyString,
  OAUTH_GOOGLE_CLIENT_ID: optionalNonEmptyString,
  OAUTH_GOOGLE_CLIENT_SECRET: optionalNonEmptyString,
  OAUTH_GITHUB_REDIRECT_URI: optionalUrl,
  OAUTH_GOOGLE_REDIRECT_URI: optionalUrl,
  GUI_AUTH_SUCCESS_URL: optionalUrl,
  APP_URL: optionalUrl,
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  PORT: optionalPositiveInt,
  APP_DATABASE_URL: optionalUrl,
  REDIS_URL: optionalUrl,
  JWT_SECRET: optionalNonEmptyString,
  ENCRYPTION_SECRET: optionalNonEmptyString,
  AI_PROVIDER_KEY: optionalNonEmptyString,
  BILLING_PROVIDER: optionalBillingProvider,
  STRIPE_SECRET_KEY: optionalNonEmptyString,
  STRIPE_WEBHOOK_SECRET: optionalNonEmptyString,
  POLAR_ACCESS_TOKEN: optionalNonEmptyString,
  POLAR_ORGANIZATION_ID: optionalNonEmptyString,
  POLAR_WEBHOOK_SECRET: optionalNonEmptyString,
  TRIAL_DAYS: optionalPositiveInt
});

export const env = envSchema.parse(process.env);
