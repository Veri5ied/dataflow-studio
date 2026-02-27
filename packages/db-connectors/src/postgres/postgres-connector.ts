import type {
  DatabaseEngine,
  DbColumnSummary,
  DbSchemaSummary,
  DbTableMetadata,
  DbTableSummary,
  ExternalDbConnectionInput,
  ExternalDbConnectionTestResult,
  SslMode,
} from "@dataflow/shared-types";
import { createRequire } from "node:module";
import type {
  ConnectorOptions,
  RelationalConnector,
  RelationalQueryExecutionHandle,
  RelationalQueryExecutionInput,
  RelationalQueryExecutionResult,
} from "../connector-types";
import { assertIdentifier } from "../connector-utils";

type PgSslConfig =
  | false
  | {
      rejectUnauthorized: boolean;
    };

type QueryResult<T> = {
  rows: T[];
  rowCount: number | null;
  command: string;
};

type PgClient = {
  connect: () => Promise<void>;
  end: () => Promise<void>;
  query: <T>(
    text: string,
    values?: readonly unknown[],
  ) => Promise<QueryResult<T>>;
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
  query_timeout: number;
  application_name: string;
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
      rejectUnauthorized: true,
    };
  }

  return {
    rejectUnauthorized: false,
  };
}

export class PostgresConnector implements RelationalConnector {
  readonly engine: DatabaseEngine = "postgresql";
  private readonly credentials: ExternalDbConnectionInput;
  private readonly connectionTimeoutMs: number;

  constructor(
    credentials: ExternalDbConnectionInput,
    options: ConnectorOptions = {},
  ) {
    this.credentials = credentials;
    this.connectionTimeoutMs = options.connectionTimeoutMs ?? 5_000;
  }

  private createClient(options?: {
    connectionTimeoutMs?: number;
    statementTimeoutMs?: number;
    queryTimeoutMs?: number;
  }) {
    const connectionTimeoutMillis =
      options?.connectionTimeoutMs ?? this.connectionTimeoutMs;
    const statementTimeoutMs =
      options?.statementTimeoutMs ?? connectionTimeoutMillis * 2;
    const queryTimeoutMs = options?.queryTimeoutMs ?? statementTimeoutMs;

    return new Client({
      host: this.credentials.host,
      port: this.credentials.port,
      database: this.credentials.databaseName,
      user: this.credentials.username,
      password: this.credentials.password,
      ssl: resolveSslConfig(this.credentials.sslMode),
      connectionTimeoutMillis,
      statement_timeout: statementTimeoutMs,
      query_timeout: queryTimeoutMs,
      application_name: "dataflow-studio-postgres-connector",
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
        `SELECT current_database() AS current_database, current_user AS current_user, version() AS server_version`,
      );

      const row = result.rows[0];
      return {
        ok: true,
        databaseEngine: this.engine,
        databaseName: row.current_database,
        currentUser: row.current_user,
        serverVersion: row.server_version,
        latencyMs: Date.now() - startedAt,
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
        `,
      );

      return result.rows.map((row: { schema_name: string }) => ({
        schemaName: row.schema_name,
      }));
    });
  }

  async listTables(schemaName?: string): Promise<DbTableSummary[]> {
    return this.withClient(async (client) => {
      const normalizedSchema = schemaName?.trim();
      const conditions = [
        `table_schema NOT IN ('pg_catalog', 'information_schema')`,
        `table_schema NOT LIKE 'pg_toast%'`,
        `table_schema NOT LIKE 'pg_temp_%'`,
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
        values,
      );

      return result.rows.map(
        (row: {
          table_schema: string;
          table_name: string;
          table_type: DbTableSummary["tableType"];
        }) => ({
          schemaName: row.table_schema,
          tableName: row.table_name,
          tableType: row.table_type,
        }),
      );
    });
  }

  async getTableMetadata(
    schemaName: string,
    tableName: string,
  ): Promise<DbTableMetadata | null> {
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
        [safeSchema, safeTable],
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
        [safeSchema, safeTable],
      );

      const columns: DbColumnSummary[] = columnsResult.rows.map(
        (row: {
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
          defaultValue: row.column_default,
        }),
      );

      return {
        schemaName: table.table_schema,
        tableName: table.table_name,
        tableType: table.table_type,
        columns,
      };
    });
  }

  async startQueryExecution(
    input: RelationalQueryExecutionInput,
  ): Promise<RelationalQueryExecutionHandle> {
    const client = this.createClient({
      statementTimeoutMs: input.timeoutMs,
      queryTimeoutMs: input.timeoutMs,
    });
    await client.connect();

    const pidResult = await client.query<{ pid: number }>(
      "SELECT pg_backend_pid() AS pid",
    );
    const backendPid = Number(pidResult.rows[0]?.pid ?? 0);
    let closed = false;

    const close = async () => {
      if (closed) {
        return;
      }

      closed = true;
      await client.end();
    };

    const cancel = async () => {
      if (!backendPid) {
        return false;
      }

      const cancelClient = this.createClient({
        connectionTimeoutMs: 5_000,
        statementTimeoutMs: 5_000,
        queryTimeoutMs: 5_000,
      });

      try {
        await cancelClient.connect();
        const canceledResult = await cancelClient.query<{ canceled: boolean }>(
          "SELECT pg_cancel_backend($1) AS canceled",
          [backendPid],
        );
        return Boolean(canceledResult.rows[0]?.canceled);
      } catch {
        return false;
      } finally {
        await cancelClient.end();
      }
    };

    return {
      run: async (): Promise<RelationalQueryExecutionResult> => {
        const result = await client.query<Record<string, unknown>>(input.sql);
        const rows = Array.isArray(result.rows) ? result.rows : [];
        return {
          rows,
          rowCount:
            typeof result.rowCount === "number" ? result.rowCount : rows.length,
          command: result.command,
          columns: rows[0] ? Object.keys(rows[0]) : [],
        };
      },
      cancel,
      close,
    };
  }
}
