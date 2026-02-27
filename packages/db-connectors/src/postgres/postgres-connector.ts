import type {
  DbColumnSummary,
  DbSchemaSummary,
  DbTableMetadata,
  DbTableSummary,
  ExternalDbConnectionInput,
  ExternalDbConnectionTestResult,
  SslMode
} from "@dataflow/shared-types";
import { createRequire } from "node:module";

type PgSslConfig =
  | false
  | {
      rejectUnauthorized: boolean;
    };

type ConnectorOptions = {
  connectionTimeoutMs?: number;
};

type QueryResult<T> = {
  rows: T[];
};

type PgClient = {
  connect: () => Promise<void>;
  end: () => Promise<void>;
  query: <T>(text: string, values?: readonly unknown[]) => Promise<QueryResult<T>>;
};

type PgClientConstructor = new (config: {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: PgSslConfig;
  connectionTimeoutMillis: number;
  statement_timeout: number;
}) => PgClient;

const require = createRequire(import.meta.url);
const { Client } = require("pg") as {
  Client: PgClientConstructor;
};

function resolveSslConfig(sslMode: SslMode): PgSslConfig {
  if (sslMode === "disable") {
    return false;
  }

  if (sslMode === "verify-ca" || sslMode === "verify-full") {
    return {
      rejectUnauthorized: true
    };
  }

  return {
    rejectUnauthorized: false
  };
}

function isValidIdentifier(value: string) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
}

function assertIdentifier(value: string, label: string) {
  if (!isValidIdentifier(value)) {
    throw new Error(`Invalid ${label} identifier.`);
  }

  return value;
}

export class PostgresConnector {
  private readonly credentials: ExternalDbConnectionInput;
  private readonly connectionTimeoutMs: number;

  constructor(credentials: ExternalDbConnectionInput, options: ConnectorOptions = {}) {
    this.credentials = credentials;
    this.connectionTimeoutMs = options.connectionTimeoutMs ?? 5_000;
  }

  private createClient() {
    return new Client({
      host: this.credentials.host,
      port: this.credentials.port,
      database: this.credentials.databaseName,
      user: this.credentials.username,
      password: this.credentials.password,
      ssl: resolveSslConfig(this.credentials.sslMode),
      connectionTimeoutMillis: this.connectionTimeoutMs,
      statement_timeout: this.connectionTimeoutMs * 2
    });
  }

  private async withClient<T>(fn: (client: PgClient) => Promise<T>) {
    const client = this.createClient();
    await client.connect();

    try {
      return await fn(client);
    } finally {
      await client.end();
    }
  }

  async testConnection(): Promise<ExternalDbConnectionTestResult> {
    return this.withClient(async (client) => {
      const startedAt = Date.now();
      const result = await client.query<{
        current_database: string;
        current_user: string;
        server_version: string;
      }>(
        `SELECT current_database() AS current_database, current_user AS current_user, version() AS server_version`
      );

      const row = result.rows[0];
      return {
        ok: true,
        databaseName: row.current_database,
        currentUser: row.current_user,
        serverVersion: row.server_version,
        latencyMs: Date.now() - startedAt
      };
    });
  }

  async listSchemas(): Promise<DbSchemaSummary[]> {
    return this.withClient(async (client) => {
      const result = await client.query<{ schema_name: string }>(
        `
          SELECT schema_name
          FROM information_schema.schemata
          WHERE schema_name NOT IN ('pg_catalog', 'information_schema')
            AND schema_name NOT LIKE 'pg_toast%'
            AND schema_name NOT LIKE 'pg_temp_%'
          ORDER BY schema_name
        `
      );

      return result.rows.map((row: { schema_name: string }) => ({
        schemaName: row.schema_name
      }));
    });
  }

  async listTables(schemaName?: string): Promise<DbTableSummary[]> {
    return this.withClient(async (client) => {
      const normalizedSchema = schemaName?.trim();
      const conditions = [
        `table_schema NOT IN ('pg_catalog', 'information_schema')`,
        `table_schema NOT LIKE 'pg_toast%'`,
        `table_schema NOT LIKE 'pg_temp_%'`
      ];
      const values: string[] = [];

      if (normalizedSchema) {
        conditions.push(`table_schema = $1`);
        values.push(assertIdentifier(normalizedSchema, "schema"));
      }

      const result = await client.query<{
        table_schema: string;
        table_name: string;
        table_type: DbTableSummary["tableType"];
      }>(
        `
          SELECT table_schema, table_name, table_type
          FROM information_schema.tables
          WHERE ${conditions.join(" AND ")}
          ORDER BY table_schema, table_name
        `,
        values
      );

      return result.rows.map((row: {
        table_schema: string;
        table_name: string;
        table_type: DbTableSummary["tableType"];
      }) => ({
        schemaName: row.table_schema,
        tableName: row.table_name,
        tableType: row.table_type
      }));
    });
  }

  async getTableMetadata(schemaName: string, tableName: string): Promise<DbTableMetadata | null> {
    return this.withClient(async (client) => {
      const safeSchema = assertIdentifier(schemaName.trim(), "schema");
      const safeTable = assertIdentifier(tableName.trim(), "table");

      const tableResult = await client.query<{
        table_schema: string;
        table_name: string;
        table_type: DbTableSummary["tableType"];
      }>(
        `
          SELECT table_schema, table_name, table_type
          FROM information_schema.tables
          WHERE table_schema = $1
            AND table_name = $2
          LIMIT 1
        `,
        [safeSchema, safeTable]
      );

      const table = tableResult.rows[0];
      if (!table) {
        return null;
      }

      const columnsResult = await client.query<{
        column_name: string;
        ordinal_position: number;
        data_type: string;
        is_nullable: "YES" | "NO";
        column_default: string | null;
      }>(
        `
          SELECT
            column_name,
            ordinal_position,
            data_type,
            is_nullable,
            column_default
          FROM information_schema.columns
          WHERE table_schema = $1
            AND table_name = $2
          ORDER BY ordinal_position
        `,
        [safeSchema, safeTable]
      );

      const columns: DbColumnSummary[] = columnsResult.rows.map((row: {
        column_name: string;
        ordinal_position: number;
        data_type: string;
        is_nullable: "YES" | "NO";
        column_default: string | null;
      }) => ({
        columnName: row.column_name,
        ordinalPosition: Number(row.ordinal_position),
        dataType: row.data_type,
        isNullable: row.is_nullable === "YES",
        defaultValue: row.column_default
      }));

      return {
        schemaName: table.table_schema,
        tableName: table.table_name,
        tableType: table.table_type,
        columns
      };
    });
  }
}
