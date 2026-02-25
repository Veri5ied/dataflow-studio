export type SqlGenerationRequest = {
  instruction: string;
  schemaContext: string;
};

export function generateSql(request: SqlGenerationRequest) {
  return {
    sql: `-- Scaffold SQL for instruction: ${request.instruction}`,
    provider: "unconfigured"
  };
}

export function explainSql(sql: string) {
  return {
    explanation: `Scaffold explanation for SQL: ${sql}`
  };
}
