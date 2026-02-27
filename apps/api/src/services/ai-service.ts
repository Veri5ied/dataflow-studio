import {
  explainSql,
  generateSql,
  type AiModelConfig,
  type LanguageModelUsage,
  type SupportedAiProvider,
} from "@dataflow/ai-engine";
import type { Database } from "../lib/db";
import { ApiError } from "../lib/api-error";
import { env } from "../lib/env";
import { insertAiLog } from "../repositories/ai-repository";
import { requireWorkspaceAccess } from "./memberships-service";
import {
  assertWorkspaceUsageCapacity,
  consumeWorkspaceUsage,
} from "./usage-service";

type AiRuntimeInput = {
  provider?: SupportedAiProvider;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
};

export type GenerateSqlInput = {
  workspaceId: string;
  instruction: string;
  schemaContext?: string;
} & AiRuntimeInput;

export type ExplainSqlInput = {
  workspaceId: string;
  sqlText: string;
} & AiRuntimeInput;

function estimateTokens(value: string) {
  return Math.max(1, Math.ceil(value.length / 4));
}

function assertNonEmpty(value: string | undefined, field: string) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    throw new ApiError(400, `${field} is required.`, "validation_error");
  }

  return trimmed;
}

function optionalTrimmed(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function resolveApiKey(provider: SupportedAiProvider, overrideApiKey?: string) {
  const requestApiKey = optionalTrimmed(overrideApiKey);
  if (requestApiKey) {
    return requestApiKey;
  }

  switch (provider) {
    case "openai":
      return (
        optionalTrimmed(env.OPENAI_API_KEY) ?? optionalTrimmed(env.AI_PROVIDER_KEY)
      );
    case "anthropic":
      return optionalTrimmed(env.ANTHROPIC_API_KEY);
    case "google":
      return optionalTrimmed(env.GOOGLE_GENERATIVE_AI_API_KEY);
    case "openai-compatible":
      return (
        optionalTrimmed(env.AI_OPENAI_COMPATIBLE_API_KEY) ??
        optionalTrimmed(env.OPENAI_API_KEY) ??
        optionalTrimmed(env.AI_PROVIDER_KEY)
      );
  }
}

function resolveAiModelConfig(input: AiRuntimeInput): AiModelConfig {
  const provider = input.provider ?? env.AI_DEFAULT_PROVIDER;
  if (!provider) {
    throw new ApiError(
      400,
      "AI provider is required. Pass `provider` in the request or set AI_DEFAULT_PROVIDER.",
      "ai_provider_required",
    );
  }

  const model = assertNonEmpty(
    optionalTrimmed(input.model) ?? optionalTrimmed(env.AI_DEFAULT_MODEL),
    "model",
  );

  const apiKey = resolveApiKey(provider, input.apiKey);
  if (!apiKey) {
    throw new ApiError(
      400,
      `API key for provider "${provider}" is not configured.`,
      "ai_provider_config_missing",
    );
  }

  const baseUrl =
    optionalTrimmed(input.baseUrl) ??
    optionalTrimmed(env.AI_OPENAI_COMPATIBLE_BASE_URL);

  if (provider === "openai-compatible" && !baseUrl) {
    throw new ApiError(
      400,
      "baseUrl is required for provider `openai-compatible`.",
      "ai_provider_config_missing",
    );
  }

  const temperature =
    input.temperature !== undefined
      ? input.temperature
      : env.AI_DEFAULT_TEMPERATURE;

  return {
    provider,
    model,
    apiKey,
    baseUrl,
    temperature,
  };
}

function resolveTokensUsed(
  usage: LanguageModelUsage,
  fallbackEstimate: number,
) {
  if (typeof usage.totalTokens === "number" && usage.totalTokens > 0) {
    return usage.totalTokens;
  }

  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;
  const combined = inputTokens + outputTokens;
  return combined > 0 ? combined : fallbackEstimate;
}

function providerUsageMetadata(usage: LanguageModelUsage) {
  return {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
  };
}

async function enforceAiGuardrails(
  database: Database,
  workspaceId: string,
  estimatedTokens: number,
) {
  await assertWorkspaceUsageCapacity(database, workspaceId, "ai_requests", 1);
  await assertWorkspaceUsageCapacity(
    database,
    workspaceId,
    "ai_tokens",
    estimatedTokens,
  );
}

async function meterAiUsage(
  database: Database,
  workspaceId: string,
  tokensUsed: number,
) {
  await consumeWorkspaceUsage(database, workspaceId, "ai_requests", 1);
  await consumeWorkspaceUsage(database, workspaceId, "ai_tokens", tokensUsed);
}

export async function generateSqlForUser(
  database: Database,
  userId: string,
  input: GenerateSqlInput,
) {
  const instruction = assertNonEmpty(input.instruction, "instruction");
  const schemaContext = input.schemaContext?.trim() ?? "";
  const modelConfig = resolveAiModelConfig(input);

  await requireWorkspaceAccess(database, input.workspaceId, userId, [
    "owner",
    "admin",
    "editor",
    "viewer",
  ]);

  await enforceAiGuardrails(
    database,
    input.workspaceId,
    estimateTokens(`${instruction}\n${schemaContext}`) + 256,
  );

  let generated: Awaited<ReturnType<typeof generateSql>>;
  try {
    generated = await generateSql({
      instruction,
      schemaContext,
      modelConfig,
    });
  } catch {
    throw new ApiError(502, "AI provider request failed.", "ai_provider_error");
  }

  const tokensUsed = resolveTokensUsed(
    generated.usage,
    estimateTokens(`${instruction}\n${schemaContext}\n${generated.sql}`),
  );

  await meterAiUsage(database, input.workspaceId, tokensUsed);

  const log = await insertAiLog(database, {
    workspaceId: input.workspaceId,
    userId,
    action: "generate_sql",
    instruction,
    sqlText: null,
    responseText: generated.sql,
    provider: generated.provider,
    model: generated.model,
    tokensUsed,
    metadata: {
      schemaContextLength: schemaContext.length,
      usage: providerUsageMetadata(generated.usage),
    },
  });

  return {
    sql: generated.sql,
    provider: generated.provider,
    model: generated.model,
    usage: {
      requests: 1,
      tokens: tokensUsed,
      provider: providerUsageMetadata(generated.usage),
    },
    logId: log.id,
  };
}

export async function explainSqlForUser(
  database: Database,
  userId: string,
  input: ExplainSqlInput,
) {
  const sqlText = assertNonEmpty(input.sqlText, "sqlText");
  const modelConfig = resolveAiModelConfig(input);

  await requireWorkspaceAccess(database, input.workspaceId, userId, [
    "owner",
    "admin",
    "editor",
    "viewer",
  ]);

  await enforceAiGuardrails(
    database,
    input.workspaceId,
    estimateTokens(sqlText) + 256,
  );

  let explanation: Awaited<ReturnType<typeof explainSql>>;
  try {
    explanation = await explainSql({ sqlText, modelConfig });
  } catch {
    throw new ApiError(502, "AI provider request failed.", "ai_provider_error");
  }

  const tokensUsed = resolveTokensUsed(
    explanation.usage,
    estimateTokens(`${sqlText}\n${explanation.explanation}`),
  );

  await meterAiUsage(database, input.workspaceId, tokensUsed);

  const log = await insertAiLog(database, {
    workspaceId: input.workspaceId,
    userId,
    action: "explain_query",
    instruction: null,
    sqlText,
    responseText: explanation.explanation,
    provider: explanation.provider,
    model: explanation.model,
    tokensUsed,
    metadata: {
      usage: providerUsageMetadata(explanation.usage),
    },
  });

  return {
    explanation: explanation.explanation,
    provider: explanation.provider,
    model: explanation.model,
    usage: {
      requests: 1,
      tokens: tokensUsed,
      provider: providerUsageMetadata(explanation.usage),
    },
    logId: log.id,
  };
}
