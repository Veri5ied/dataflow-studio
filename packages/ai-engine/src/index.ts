import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, type LanguageModel, type LanguageModelUsage } from "ai";
export type { LanguageModelUsage } from "ai";

export const supportedAiProviders = [
  "openai",
  "anthropic",
  "google",
  "openai-compatible",
] as const;

export type SupportedAiProvider = (typeof supportedAiProviders)[number];

export type AiModelConfig = {
  provider: SupportedAiProvider;
  model: string;
  apiKey: string;
  baseUrl?: string;
  temperature?: number;
};

export type SqlGenerationRequest = {
  instruction: string;
  schemaContext: string;
  modelConfig: AiModelConfig;
};

export type SqlGenerationResponse = {
  sql: string;
  provider: SupportedAiProvider;
  model: string;
  usage: LanguageModelUsage;
};

export type SqlExplanationRequest = {
  sqlText: string;
  modelConfig: AiModelConfig;
};

export type SqlExplanationResponse = {
  explanation: string;
  provider: SupportedAiProvider;
  model: string;
  usage: LanguageModelUsage;
};

function resolveModel(config: AiModelConfig): LanguageModel {
  const modelId = config.model;

  switch (config.provider) {
    case "openai": {
      const provider = createOpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
      });
      return provider(modelId);
    }
    case "anthropic": {
      const provider = createAnthropic({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
      });
      return provider(modelId as never);
    }
    case "google": {
      const provider = createGoogleGenerativeAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
      });
      return provider(modelId as never);
    }
    case "openai-compatible": {
      const provider = createOpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
        name: "openai-compatible",
      });
      return provider(modelId);
    }
  }
}

function unwrapSqlResponse(value: string) {
  const fencedBlockMatch = value.match(/```(?:sql)?\s*([\s\S]*?)```/i);
  if (!fencedBlockMatch) {
    return value.trim();
  }

  return fencedBlockMatch[1]?.trim() ?? value.trim();
}

function aiCallSettings(modelConfig: AiModelConfig) {
  return typeof modelConfig.temperature === "number"
    ? { temperature: modelConfig.temperature }
    : {};
}

export async function generateSql(
  request: SqlGenerationRequest,
): Promise<SqlGenerationResponse> {
  const result = await generateText({
    model: resolveModel(request.modelConfig),
    system:
      "You are a SQL assistant. Generate a single valid SQL query that matches the user request. Return only SQL.",
    prompt: [
      "Instruction:",
      request.instruction,
      "",
      "Schema context:",
      request.schemaContext || "(not provided)",
      "",
      "Return only SQL without markdown explanations.",
    ].join("\n"),
    ...aiCallSettings(request.modelConfig),
  });

  return {
    sql: unwrapSqlResponse(result.text),
    provider: request.modelConfig.provider,
    model: request.modelConfig.model,
    usage: result.usage,
  };
}

export async function explainSql(
  request: SqlExplanationRequest,
): Promise<SqlExplanationResponse> {
  const result = await generateText({
    model: resolveModel(request.modelConfig),
    system:
      "You are a SQL reviewer. Explain what the query does, performance implications, and optimization ideas in concise plain language.",
    prompt: request.sqlText,
    ...aiCallSettings(request.modelConfig),
  });

  return {
    explanation: result.text.trim(),
    provider: request.modelConfig.provider,
    model: request.modelConfig.model,
    usage: result.usage,
  };
}
