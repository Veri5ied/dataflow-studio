import { aiLogs } from "../db/schema";
import type { DbExecutor } from "./db-executor";

export async function insertAiLog(
  executor: DbExecutor,
  values: {
    workspaceId: string;
    userId: string;
    action: "generate_sql" | "explain_query";
    instruction: string | null;
    sqlText: string | null;
    responseText: string;
    provider: string;
    model: string;
    tokensUsed: number;
    metadata?: Record<string, unknown>;
  },
) {
  const [log] = await executor
    .insert(aiLogs)
    .values({
      workspaceId: values.workspaceId,
      userId: values.userId,
      action: values.action,
      instruction: values.instruction,
      sqlText: values.sqlText,
      responseText: values.responseText,
      provider: values.provider,
      model: values.model,
      tokensUsed: values.tokensUsed,
      metadata: values.metadata ?? {},
    })
    .returning();

  return log;
}
