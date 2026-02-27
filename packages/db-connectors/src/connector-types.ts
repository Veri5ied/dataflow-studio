import type {
  DatabaseEngine,
  DbSchemaSummary,
  DbTableMetadata,
  DbTableSummary,
  ExternalDbConnectionInput,
  ExternalDbConnectionTestResult,
} from "@dataflow/shared-types";

export type ConnectorOptions = {
  connectionTimeoutMs?: number;
};

export type RelationalQueryExecutionResult = {
  rows: Record<string, unknown>[];
  rowCount: number;
  command: string;
  columns: string[];
};

export type RelationalQueryExecutionHandle = {
  run: () => Promise<RelationalQueryExecutionResult>;
  cancel: () => Promise<boolean>;
  close: () => Promise<void>;
};

export type RelationalQueryExecutionInput = {
  sql: string;
  timeoutMs: number;
};

export interface RelationalConnector {
  readonly engine: DatabaseEngine;
  testConnection: () => Promise<ExternalDbConnectionTestResult>;
  listSchemas: () => Promise<DbSchemaSummary[]>;
  listTables: (schemaName?: string) => Promise<DbTableSummary[]>;
  getTableMetadata: (
    schemaName: string,
    tableName: string,
  ) => Promise<DbTableMetadata | null>;
  startQueryExecution: (
    input: RelationalQueryExecutionInput,
  ) => Promise<RelationalQueryExecutionHandle>;
}

export type RelationalConnectorFactoryInput = ExternalDbConnectionInput;
