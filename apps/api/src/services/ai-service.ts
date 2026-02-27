import { explainSql, generateSql } from "@dataflow/ai-engine";
import type { Database } from "../lib/db";
import { ApiError } from "../lib/api-error";
import { insertAiLog } from "../repositories/ai-repository";
import { requireWorkspaceAccess } from "./memberships-service";
import {
  assertWorkspaceUsageCapacity,
  consumeWorkspaceUsage,
} from "./usage-service";

const DEFAULT_AI_PROVIDER = "configured-provider";
const DEFAULT_AI_MODEL = "sql-assistant-v1";

export type GenerateSqlInput = {
  workspaceId: string;
  instruction: string;
  schemaContext?: string;
};

export type ExplainSqlInput = {
  workspaceId: string;
  sqlText: string;
};

function estimateTokens(value: string) {
  return Math.max(1, Math.ceil(value.length / 4));
}

function assertNonEmpty(value: string, field: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ApiError(400, `${field} is required.`, "validation_error");
  }

  return trimmed;
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

  const generated = generateSql({
    instruction,
    schemaContext,
  });

  const tokensUsed = estimateTokens(
    `${instruction}\n${schemaContext}\n${generated.sql}`,
  );

  await meterAiUsage(database, input.workspaceId, tokensUsed);

  const log = await insertAiLog(database, {
    workspaceId: input.workspaceId,
    userId,
    action: "generate_sql",
    instruction,
    sqlText: null,
    responseText: generated.sql,
    provider: generated.provider ?? DEFAULT_AI_PROVIDER,
    model: DEFAULT_AI_MODEL,
    tokensUsed,
    metadata: {
      schemaContextLength: schemaContext.length,
    },
  });

  return {
    sql: generated.sql,
    provider: generated.provider ?? DEFAULT_AI_PROVIDER,
    model: DEFAULT_AI_MODEL,
    usage: {
      requests: 1,
      tokens: tokensUsed,
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

  const explanation = explainSql(sqlText);
  const tokensUsed = estimateTokens(`${sqlText}\n${explanation.explanation}`);

  await meterAiUsage(database, input.workspaceId, tokensUsed);

  const log = await insertAiLog(database, {
    workspaceId: input.workspaceId,
    userId,
    action: "explain_query",
    instruction: null,
    sqlText,
    responseText: explanation.explanation,
    provider: DEFAULT_AI_PROVIDER,
    model: DEFAULT_AI_MODEL,
    tokensUsed,
  });

  return {
    explanation: explanation.explanation,
    provider: DEFAULT_AI_PROVIDER,
    model: DEFAULT_AI_MODEL,
    usage: {
      requests: 1,
      tokens: tokensUsed,
    },
    logId: log.id,
  };
}
