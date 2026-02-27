import type { DatabaseEngine } from "@dataflow/shared-types";
import type {
  ConnectorOptions,
  RelationalConnector,
  RelationalConnectorFactoryInput,
} from "./connector-types";
import { MysqlConnector } from "./mysql/mysql-connector";
import { PostgresConnector } from "./postgres/postgres-connector";
import { SqliteConnector } from "./sqlite/sqlite-connector";
import { SqlServerConnector } from "./sqlserver/sqlserver-connector";

export function assertSupportedDatabaseEngine(
  value: string,
): asserts value is DatabaseEngine {
  if (!["postgresql", "mysql", "sqlite", "sqlserver"].includes(value)) {
    throw new Error(`Unsupported database engine: ${value}`);
  }
}

export function createRelationalConnector(
  input: RelationalConnectorFactoryInput,
  options: ConnectorOptions = {},
): RelationalConnector {
  switch (input.databaseEngine) {
    case "postgresql":
      return new PostgresConnector(input, options);
    case "mysql":
      return new MysqlConnector(input, options);
    case "sqlite":
      return new SqliteConnector(input, options);
    case "sqlserver":
      return new SqlServerConnector(input, options);
  }
}
