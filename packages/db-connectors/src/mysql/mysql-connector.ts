import mysql, {
  type Connection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";
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
import type {
  ConnectorOptions,
  RelationalConnector,
  RelationalQueryExecutionHandle,
  RelationalQueryExecutionInput,
  RelationalQueryExecutionResult,
} from "../connector-types";
import { assertIdentifier, inferSqlCommand } from "../connector-utils";

type MysqlSslConfig =
  | undefined
  | {
      rejectUnauthorized: boolean;
    };

function resolveMysqlSslConfig(sslMode: SslMode): MysqlSslConfig {
  if (sslMode === "disable") {
    return undefined;
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

export class MysqlConnector implements RelationalConnector {
  readonly engine: DatabaseEngine = "mysql";
  private readonly credentials: ExternalDbConnectionInput;
  private readonly connectionTimeoutMs: number;

  constructor(
    credentials: ExternalDbConnectionInput,
    options: ConnectorOptions = {},
  ) {
    this.credentials = credentials;
    this.connectionTimeoutMs = options.connectionTimeoutMs ?? 5_000;
  }

  private async createConnection() {
    return mysql.createConnection({
      host: this.credentials.host,
      port: this.credentials.port,
      database: this.credentials.databaseName,
      user: this.credentials.username,
      password: this.credentials.password,
      ssl: resolveMysqlSslConfig(this.credentials.sslMode),
      connectTimeout: this.connectionTimeoutMs,
      multipleStatements: false,
    });
  }

  private async withConnection<T>(fn: (connection: Connection) => Promise<T>) {
    const connection = await this.createConnection();
    try {
      return await fn(connection);
    } finally {
      await connection.end();
    }
  }

  async testConnection(): Promise<ExternalDbConnectionTestResult> {
    return this.withConnection(async (connection) => {
      const startedAt = Date.now();
      const [rows] = await connection.query<RowDataPacket[]>(
        "SELECT DATABASE() AS current_database, CURRENT_USER() AS current_user, VERSION() AS server_version",
      );
      const row = rows[0];
      return {
        ok: true,
        databaseEngine: this.engine,
        databaseName: String(
          row?.current_database ?? this.credentials.databaseName,
        ),
        currentUser: row?.current_user ? String(row.current_user) : null,
        serverVersion: String(row?.server_version ?? "unknown"),
        latencyMs: Date.now() - startedAt,
      };
    });
  }

  async listSchemas(): Promise<DbSchemaSummary[]> {
    return this.withConnection(async (connection) => {
      const [rows] = await connection.query<RowDataPacket[]>(
        `
          SELECT schema_name
          FROM information_schema.schemata
          WHERE schema_name NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
          ORDER BY schema_name
        `,
      );

      return rows.map((row) => ({
        schemaName: String(row.schema_name),
      }));
    });
  }

  async listTables(schemaName?: string): Promise<DbTableSummary[]> {
    return this.withConnection(async (connection) => {
      const values: string[] = [];
      let whereClause =
        "table_schema NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')";

      if (schemaName?.trim()) {
        whereClause = "table_schema = ?";
        values.push(assertIdentifier(schemaName.trim(), "schema"));
      }

      const [rows] = await connection.query<RowDataPacket[]>(
        `
          SELECT table_schema, table_name, table_type
          FROM information_schema.tables
          WHERE ${whereClause}
          ORDER BY table_schema, table_name
        `,
        values,
      );

      return rows.map((row) => ({
        schemaName: String(row.table_schema),
        tableName: String(row.table_name),
        tableType: String(row.table_type) as DbTableSummary["tableType"],
      }));
    });
  }

  async getTableMetadata(
    schemaName: string,
    tableName: string,
  ): Promise<DbTableMetadata | null> {
    return this.withConnection(async (connection) => {
      const safeSchema = assertIdentifier(schemaName.trim(), "schema");
      const safeTable = assertIdentifier(tableName.trim(), "table");

      const [tableRows] = await connection.query<RowDataPacket[]>(
        `
          SELECT table_schema, table_name, table_type
          FROM information_schema.tables
          WHERE table_schema = ? AND table_name = ?
          LIMIT 1
        `,
        [safeSchema, safeTable],
      );

      const table = tableRows[0];
      if (!table) {
        return null;
      }

      const [columnRows] = await connection.query<RowDataPacket[]>(
        `
          SELECT
            column_name,
            ordinal_position,
            data_type,
            is_nullable,
            column_default
          FROM information_schema.columns
          WHERE table_schema = ? AND table_name = ?
          ORDER BY ordinal_position
        `,
        [safeSchema, safeTable],
      );

      const columns: DbColumnSummary[] = columnRows.map((row) => ({
        columnName: String(row.column_name),
        ordinalPosition: Number(row.ordinal_position),
        dataType: String(row.data_type),
        isNullable: String(row.is_nullable).toUpperCase() === "YES",
        defaultValue:
          row.column_default === null ? null : String(row.column_default),
      }));

      return {
        schemaName: String(table.table_schema),
        tableName: String(table.table_name),
        tableType: String(table.table_type) as DbTableSummary["tableType"],
        columns,
      };
    });
  }

  async startQueryExecution(
    input: RelationalQueryExecutionInput,
  ): Promise<RelationalQueryExecutionHandle> {
    const connection = await this.createConnection();
    const threadId = connection.threadId;
    let closed = false;

    const close = async () => {
      if (closed) {
        return;
      }

      closed = true;
      await connection.end();
    };

    const cancel = async () => {
      if (!threadId) {
        return false;
      }

      const cancelConnection = await this.createConnection();
      try {
        await cancelConnection.query(`KILL QUERY ${threadId}`);
        return true;
      } catch {
        return false;
      } finally {
        await cancelConnection.end();
      }
    };

    return {
      run: async (): Promise<RelationalQueryExecutionResult> => {
        const [rows] = await connection.query<
          RowDataPacket[] | ResultSetHeader
        >({
          sql: input.sql,
          timeout: input.timeoutMs,
        });

        if (Array.isArray(rows)) {
          const mappedRows = rows as unknown as Record<string, unknown>[];
          return {
            rows: mappedRows,
            rowCount: mappedRows.length,
            command: inferSqlCommand(input.sql),
            columns: mappedRows[0] ? Object.keys(mappedRows[0]) : [],
          };
        }

        return {
          rows: [],
          rowCount: Number(rows.affectedRows ?? 0),
          command: inferSqlCommand(input.sql),
          columns: [],
        };
      },
      cancel,
      close,
    };
  }
}
