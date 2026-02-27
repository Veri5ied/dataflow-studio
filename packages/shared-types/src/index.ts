export type Workspace = {
  id: string;
  name: string;
  createdAt: string;
};

export type QueryHistoryItem = {
  id: string;
  workspaceId: string;
  sql: string;
  durationMs: number;
  success: boolean;
  rowsReturned: number;
  executedAt: string;
};

export type SslMode =
  | "disable"
  | "allow"
  | "prefer"
  | "require"
  | "verify-ca"
  | "verify-full";

export type ExternalDbConnectionInput = {
  host: string;
  port: number;
  databaseName: string;
  username: string;
  password: string;
  sslMode: SslMode;
};

export type ExternalDbConnectionTestResult = {
  ok: boolean;
  databaseName: string;
  currentUser: string;
  serverVersion: string;
  latencyMs: number;
};

export type DbSchemaSummary = {
  schemaName: string;
};

export type DbTableSummary = {
  schemaName: string;
  tableName: string;
  tableType: "BASE TABLE" | "VIEW" | "FOREIGN TABLE" | "LOCAL TEMPORARY";
};

export type DbColumnSummary = {
  columnName: string;
  ordinalPosition: number;
  dataType: string;
  isNullable: boolean;
  defaultValue: string | null;
};

export type DbTableMetadata = {
  schemaName: string;
  tableName: string;
  tableType: DbTableSummary["tableType"];
  columns: DbColumnSummary[];
};
