import sql from "mssql";
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

type SqlServerRow = Record<string, unknown>;

function resolveSqlServerEncrypt(sslMode: SslMode) {
  return sslMode !== "disable";
}

function resolveSqlServerTrustServerCertificate(sslMode: SslMode) {
  return sslMode === "allow" || sslMode === "prefer" || sslMode === "require";
}

export class SqlServerConnector implements RelationalConnector {
  readonly engine: DatabaseEngine = "sqlserver";
  private readonly credentials: ExternalDbConnectionInput;
  private readonly connectionTimeoutMs: number;

  constructor(
    credentials: ExternalDbConnectionInput,
    options: ConnectorOptions = {},
  ) {
    this.credentials = credentials;
    this.connectionTimeoutMs = options.connectionTimeoutMs ?? 5_000;
  }

  private async createPool(requestTimeoutMs: number) {
    return new sql.ConnectionPool({
      server: this.credentials.host,
      port: this.credentials.port,
      database: this.credentials.databaseName,
      user: this.credentials.username,
      password: this.credentials.password,
      connectionTimeout: this.connectionTimeoutMs,
      requestTimeout: requestTimeoutMs,
      options: {
        encrypt: resolveSqlServerEncrypt(this.credentials.sslMode),
        trustServerCertificate: resolveSqlServerTrustServerCertificate(
          this.credentials.sslMode,
        ),
      },
    }).connect();
  }

  private async withPool<T>(
    requestTimeoutMs: number,
    fn: (pool: sql.ConnectionPool) => Promise<T>,
  ) {
    const pool = await this.createPool(requestTimeoutMs);
    try {
      return await fn(pool);
    } finally {
      await pool.close();
    }
  }

  async testConnection(): Promise<ExternalDbConnectionTestResult> {
    return this.withPool(this.connectionTimeoutMs * 2, async (pool) => {
      const startedAt = Date.now();
      const result = await pool.request().query<SqlServerRow>(
        `
          SELECT
            DB_NAME() AS current_database,
            SUSER_SNAME() AS current_user,
            @@VERSION AS server_version
        `,
      );
      const row = result.recordset[0];
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
    return this.withPool(this.connectionTimeoutMs * 2, async (pool) => {
      const result = await pool.request().query<SqlServerRow>(
        `
          SELECT schema_name
          FROM information_schema.schemata
          ORDER BY schema_name
        `,
      );
      return result.recordset.map((row: SqlServerRow) => ({
        schemaName: String(row.schema_name),
      }));
    });
  }

  async listTables(schemaName?: string): Promise<DbTableSummary[]> {
    return this.withPool(this.connectionTimeoutMs * 2, async (pool) => {
      const request = pool.request();
      let whereClause = "";

      if (schemaName?.trim()) {
        whereClause = "WHERE table_schema = @schemaName";
        request.input(
          "schemaName",
          sql.NVarChar,
          assertIdentifier(schemaName.trim(), "schema"),
        );
      }

      const result = await request.query<SqlServerRow>(
        `
          SELECT table_schema, table_name, table_type
          FROM information_schema.tables
          ${whereClause}
          ORDER BY table_schema, table_name
        `,
      );

      return result.recordset.map((row: SqlServerRow) => ({
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
    return this.withPool(this.connectionTimeoutMs * 2, async (pool) => {
      const safeSchema = assertIdentifier(schemaName.trim(), "schema");
      const safeTable = assertIdentifier(tableName.trim(), "table");

      const tableRequest = pool.request();
      tableRequest.input("schemaName", sql.NVarChar, safeSchema);
      tableRequest.input("tableName", sql.NVarChar, safeTable);
      const tableResult = await tableRequest.query<SqlServerRow>(
        `
          SELECT table_schema, table_name, table_type
          FROM information_schema.tables
          WHERE table_schema = @schemaName AND table_name = @tableName
        `,
      );

      const table = tableResult.recordset[0];
      if (!table) {
        return null;
      }

      const columnsRequest = pool.request();
      columnsRequest.input("schemaName", sql.NVarChar, safeSchema);
      columnsRequest.input("tableName", sql.NVarChar, safeTable);
      const columnsResult = await columnsRequest.query<SqlServerRow>(
        `
          SELECT
            column_name,
            ordinal_position,
            data_type,
            is_nullable,
            column_default
          FROM information_schema.columns
          WHERE table_schema = @schemaName AND table_name = @tableName
          ORDER BY ordinal_position
        `,
      );

      const columns: DbColumnSummary[] = columnsResult.recordset.map(
        (row: SqlServerRow) => ({
          columnName: String(row.column_name),
          ordinalPosition: Number(row.ordinal_position),
          dataType: String(row.data_type),
          isNullable: String(row.is_nullable).toUpperCase() === "YES",
          defaultValue:
            row.column_default === null ? null : String(row.column_default),
        }),
      );

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
    const pool = await this.createPool(input.timeoutMs);
    const request = pool.request();
    let closed = false;

    const close = async () => {
      if (closed) {
        return;
      }

      closed = true;
      await pool.close();
    };

    const cancel = async () => {
      try {
        request.cancel();
        return true;
      } catch {
        return false;
      }
    };

    return {
      run: async (): Promise<RelationalQueryExecutionResult> => {
        const result = await request.query<SqlServerRow>(input.sql);
        const rows = (result.recordset ?? []) as Record<string, unknown>[];
        const rowsAffected = Array.isArray(result.rowsAffected)
          ? result.rowsAffected.reduce(
              (total: number, value: number) => total + value,
              0,
            )
          : 0;

        return {
          rows,
          rowCount: rows.length > 0 ? rows.length : rowsAffected,
          command: inferSqlCommand(input.sql),
          columns: rows[0] ? Object.keys(rows[0]) : [],
        };
      },
      cancel,
      close,
    };
  }
}
