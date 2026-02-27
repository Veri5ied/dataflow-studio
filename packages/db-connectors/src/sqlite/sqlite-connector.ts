import { createRequire } from "node:module";
import type {
  DatabaseEngine,
  DbColumnSummary,
  DbSchemaSummary,
  DbTableMetadata,
  DbTableSummary,
  ExternalDbConnectionInput,
  ExternalDbConnectionTestResult,
} from "@dataflow/shared-types";
import type {
  ConnectorOptions,
  RelationalConnector,
  RelationalQueryExecutionHandle,
  RelationalQueryExecutionInput,
  RelationalQueryExecutionResult,
} from "../connector-types";
import { assertIdentifier, inferSqlCommand } from "../connector-utils";

type SqliteStatement = {
  all: (...params: unknown[]) => unknown[];
  get: (...params: unknown[]) => unknown;
  run: (...params: unknown[]) => {
    lastInsertRowid: number;
    changes: number;
  };
};

type SqliteDatabase = {
  exec: (sql: string) => void;
  prepare: (sql: string) => SqliteStatement;
  close: () => void;
};

type SqliteDatabaseConstructor = new (path: string) => SqliteDatabase;

const require = createRequire(import.meta.url);
const { DatabaseSync } = require("node:sqlite") as {
  DatabaseSync: SqliteDatabaseConstructor;
};

type SqliteTableRow = {
  name: string;
  type: string;
};

type SqliteColumnRow = {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
};

function resolveSqlitePath(credentials: ExternalDbConnectionInput) {
  const filePath =
    credentials.filePath?.trim() || credentials.databaseName.trim();
  if (!filePath) {
    throw new Error("SQLite file path is required.");
  }

  return filePath;
}

function isReadQuery(sql: string) {
  return /^(select|with|pragma)\b/i.test(sql.trim());
}

export class SqliteConnector implements RelationalConnector {
  readonly engine: DatabaseEngine = "sqlite";
  private readonly credentials: ExternalDbConnectionInput;
  private readonly connectionTimeoutMs: number;

  constructor(
    credentials: ExternalDbConnectionInput,
    options: ConnectorOptions = {},
  ) {
    this.credentials = credentials;
    this.connectionTimeoutMs = options.connectionTimeoutMs ?? 5_000;
  }

  private withDatabase<T>(fn: (database: SqliteDatabase) => T) {
    const database = new DatabaseSync(resolveSqlitePath(this.credentials));
    database.exec(`PRAGMA busy_timeout = ${this.connectionTimeoutMs}`);

    try {
      return fn(database);
    } finally {
      database.close();
    }
  }

  async testConnection(): Promise<ExternalDbConnectionTestResult> {
    return this.withDatabase((database) => {
      const startedAt = Date.now();
      const row = database
        .prepare("SELECT sqlite_version() AS server_version")
        .get() as { server_version?: string };

      return {
        ok: true,
        databaseEngine: this.engine,
        databaseName: resolveSqlitePath(this.credentials),
        currentUser: null,
        serverVersion: row?.server_version ?? "sqlite",
        latencyMs: Date.now() - startedAt,
      };
    });
  }

  async listSchemas(): Promise<DbSchemaSummary[]> {
    return [{ schemaName: "main" }];
  }

  async listTables(schemaName?: string): Promise<DbTableSummary[]> {
    const targetSchema = schemaName?.trim() || "main";
    if (targetSchema !== "main") {
      return [];
    }

    return this.withDatabase((database) => {
      const rows = database
        .prepare(
          `
            SELECT name, type
            FROM sqlite_master
            WHERE type IN ('table', 'view')
              AND name NOT LIKE 'sqlite_%'
            ORDER BY name
          `,
        )
        .all() as SqliteTableRow[];

      return rows.map((row) => ({
        schemaName: "main",
        tableName: row.name,
        tableType: row.type === "view" ? "VIEW" : "TABLE",
      }));
    });
  }

  async getTableMetadata(
    schemaName: string,
    tableName: string,
  ): Promise<DbTableMetadata | null> {
    const safeSchema = assertIdentifier(schemaName.trim(), "schema");
    if (safeSchema !== "main") {
      return null;
    }

    const safeTable = assertIdentifier(tableName.trim(), "table");
    return this.withDatabase((database) => {
      const table = database
        .prepare(
          `
            SELECT name, type
            FROM sqlite_master
            WHERE name = ?1
              AND type IN ('table', 'view')
            LIMIT 1
          `,
        )
        .get(safeTable) as SqliteTableRow | undefined;

      if (!table) {
        return null;
      }

      const columns = database
        .prepare(`PRAGMA main.table_info("${safeTable}")`)
        .all() as SqliteColumnRow[];

      const mappedColumns: DbColumnSummary[] = columns.map((column) => ({
        columnName: column.name,
        ordinalPosition: Number(column.cid) + 1,
        dataType: column.type || "TEXT",
        isNullable: Number(column.notnull) === 0,
        defaultValue: column.dflt_value,
      }));

      return {
        schemaName: "main",
        tableName: table.name,
        tableType: table.type === "view" ? "VIEW" : "TABLE",
        columns: mappedColumns,
      };
    });
  }

  async startQueryExecution(
    input: RelationalQueryExecutionInput,
  ): Promise<RelationalQueryExecutionHandle> {
    const database = new DatabaseSync(resolveSqlitePath(this.credentials));
    database.exec(`PRAGMA busy_timeout = ${input.timeoutMs}`);
    let closed = false;

    const close = async () => {
      if (closed) {
        return;
      }

      closed = true;
      database.close();
    };

    return {
      run: async (): Promise<RelationalQueryExecutionResult> => {
        const statement = database.prepare(input.sql);
        if (isReadQuery(input.sql)) {
          const rows = statement.all() as Record<string, unknown>[];
          return {
            rows,
            rowCount: rows.length,
            command: inferSqlCommand(input.sql),
            columns: rows[0] ? Object.keys(rows[0]) : [],
          };
        }

        const result = statement.run();
        return {
          rows: [],
          rowCount: Number(result.changes ?? 0),
          command: inferSqlCommand(input.sql),
          columns: [],
        };
      },
      cancel: async () => false,
      close,
    };
  }
}
