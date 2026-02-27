import { z } from "zod";

const emptyStringToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalString = z.preprocess(emptyStringToUndefined, z.string().optional());
const optionalUrl = z.preprocess(emptyStringToUndefined, z.string().url().optional());
const optionalAiProvider = z.preprocess(
  emptyStringToUndefined,
  z.enum(["openai", "anthropic", "google", "openai-compatible"]).optional()
);
const optionalPositiveInt = z.preprocess(
  emptyStringToUndefined,
  z.coerce.number().int().positive().optional()
);
const optionalAiTemperature = z.preprocess(
  emptyStringToUndefined,
  z.coerce.number().min(0).max(2).optional()
);

const appEnvSchema = z.object({
  DEPLOYMENT_MODE: z.enum(["cloud", "self-host"]).optional(),
  SELF_HOST_EDITION: z.enum(["community", "enterprise"]).optional(),
  OAUTH_GITHUB_CLIENT_ID: optionalString,
  OAUTH_GITHUB_CLIENT_SECRET: optionalString,
  OAUTH_GOOGLE_CLIENT_ID: optionalString,
  OAUTH_GOOGLE_CLIENT_SECRET: optionalString,
  OAUTH_GITHUB_REDIRECT_URI: optionalUrl,
  OAUTH_GOOGLE_REDIRECT_URI: optionalUrl,
  GUI_AUTH_SUCCESS_URL: optionalUrl,
  APP_URL: optionalUrl,
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  PORT: optionalPositiveInt,
  APP_DATABASE_URL: optionalUrl,
  REDIS_URL: optionalUrl,
  JWT_SECRET: optionalString,
  ENCRYPTION_SECRET: optionalString,
  AI_PROVIDER_KEY: optionalString,
  AI_DEFAULT_PROVIDER: optionalAiProvider,
  AI_DEFAULT_MODEL: optionalString,
  AI_DEFAULT_TEMPERATURE: optionalAiTemperature,
  OPENAI_API_KEY: optionalString,
  ANTHROPIC_API_KEY: optionalString,
  GOOGLE_GENERATIVE_AI_API_KEY: optionalString,
  AI_OPENAI_COMPATIBLE_API_KEY: optionalString,
  AI_OPENAI_COMPATIBLE_BASE_URL: optionalUrl,
  POLAR_ACCESS_TOKEN: optionalString,
  POLAR_ORGANIZATION_ID: optionalString,
  POLAR_WEBHOOK_SECRET: optionalString,
  POLAR_CHECKOUT_BASE_URL: optionalUrl,
  POLAR_PORTAL_BASE_URL: optionalUrl,
  TRIAL_DAYS: optionalPositiveInt,
  CLOUD_TRIAL_SEAT_LIMIT: optionalPositiveInt,
  CLOUD_TRIAL_AI_REQUESTS_LIMIT: optionalPositiveInt,
  CLOUD_TRIAL_AI_TOKENS_LIMIT: optionalPositiveInt,
  CLOUD_PRO_SEAT_PRICE_CENTS: optionalPositiveInt,
  CLOUD_PRO_AI_REQUESTS_LIMIT: optionalPositiveInt,
  CLOUD_PRO_AI_TOKENS_LIMIT: optionalPositiveInt,
  LICENSE_VERIFICATION_SECRET: optionalString,
  LICENSE_SYNC_GRACE_HOURS: optionalPositiveInt
});

export type AppEnv = z.infer<typeof appEnvSchema>;

export function readAppEnv(input: unknown = process.env): AppEnv {
  return appEnvSchema.parse(input);
}
