import { createRelationalConnector } from '@dataflow/db-connectors'
import type {
  DatabaseEngine,
  ExternalDbConnectionInput,
  SslMode,
} from '@dataflow/shared-types'
import { ApiError } from '../lib/api-error'
import { env } from '../lib/env'

type PlaygroundConnectionPayload = {
  connectionString?: string
  databaseEngine?: DatabaseEngine
  host?: string
  port?: number
  databaseName?: string
  username?: string
  password?: string
  filePath?: string
  sslMode?: SslMode
}

type PlaygroundQueryInput = PlaygroundConnectionPayload & {
  sqlText: string
  limit?: number
  offset?: number
  timeoutMs?: number
}

const DEFAULT_PORTS: Record<Exclude<DatabaseEngine, 'sqlite'>, number> = {
  postgresql: 5432,
  mysql: 3306,
  sqlserver: 1433,
}

const MAX_SQL_LENGTH = 100_000
const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100
const DEFAULT_QUERY_TIMEOUT_MS = 15_000
const MAX_QUERY_TIMEOUT_MS = 30_000
const DISALLOWED_SQL_PATTERNS: RegExp[] = [/\\[a-z]+/i, /\bcopy\b[\s\S]*\bprogram\b/i]
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1'])

function assertPlaygroundEnabled() {
  if (!env.PUBLIC_PLAYGROUND_ENABLED) {
    throw new ApiError(404, 'Public playground is disabled.', 'playground_disabled')
  }
}

function assertNonEmpty(value: string | undefined, field: string) {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) {
    throw new ApiError(400, `${field} is required.`, 'validation_error')
  }

  return trimmed
}

function isPrivateIpv4(host: string) {
  const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!match) {
    return false
  }

  const [a, b] = [Number(match[1]), Number(match[2])]
  if (a === 10 || a === 127 || a === 0) {
    return true
  }
  if (a === 192 && b === 168) {
    return true
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true
  }

  return false
}

function assertAllowedHost(host: string) {
  if (env.PUBLIC_PLAYGROUND_ALLOW_PRIVATE_HOSTS) {
    return
  }

  const normalizedHost = host.trim().toLowerCase()
  if (LOCAL_HOSTS.has(normalizedHost) || isPrivateIpv4(normalizedHost)) {
    throw new ApiError(
      400,
      'Private and local network hosts are not allowed in the public playground.',
      'playground_private_host_not_allowed',
    )
  }
}

function parseSslMode(url: URL): SslMode {
  const sslMode = url.searchParams.get('sslmode')?.trim().toLowerCase()
  if (
    sslMode === 'disable' ||
    sslMode === 'allow' ||
    sslMode === 'prefer' ||
    sslMode === 'require' ||
    sslMode === 'verify-ca' ||
    sslMode === 'verify-full'
  ) {
    return sslMode
  }

  const ssl = url.searchParams.get('ssl')?.trim().toLowerCase()
  if (ssl === 'false' || ssl === '0' || ssl === 'disable') {
    return 'disable'
  }

  return 'require'
}

function parseConnectionString(connectionString: string): PlaygroundConnectionPayload {
  let parsedUrl: URL
  try {
    parsedUrl = new URL(connectionString)
  } catch {
    throw new ApiError(400, 'Invalid connection string.', 'invalid_connection_string')
  }

  const protocol = parsedUrl.protocol.replace(':', '').toLowerCase()
  const databaseEngine: DatabaseEngine | undefined =
    protocol === 'postgres' || protocol === 'postgresql'
      ? 'postgresql'
      : protocol === 'mysql'
        ? 'mysql'
        : protocol === 'sqlserver'
          ? 'sqlserver'
          : protocol === 'sqlite'
            ? 'sqlite'
            : undefined

  if (!databaseEngine) {
    throw new ApiError(400, 'Unsupported connection string protocol.', 'invalid_connection_string')
  }

  if (databaseEngine === 'sqlite') {
    return {
      databaseEngine,
      filePath: decodeURIComponent(parsedUrl.pathname),
    }
  }

  return {
    databaseEngine,
    host: parsedUrl.hostname,
    port: parsedUrl.port ? Number(parsedUrl.port) : DEFAULT_PORTS[databaseEngine],
    databaseName: decodeURIComponent(parsedUrl.pathname.replace(/^\//, '')),
    username: decodeURIComponent(parsedUrl.username),
    password: decodeURIComponent(parsedUrl.password),
    sslMode: parseSslMode(parsedUrl),
  }
}

function resolveConnectionPayload(input: PlaygroundConnectionPayload): ExternalDbConnectionInput {
  const resolved = input.connectionString?.trim()
    ? {
        ...input,
        ...parseConnectionString(input.connectionString),
      }
    : input

  const databaseEngine = resolved.databaseEngine
  if (!databaseEngine) {
    throw new ApiError(400, 'databaseEngine is required.', 'validation_error')
  }

  if (databaseEngine === 'sqlite') {
    throw new ApiError(
      400,
      'SQLite is not supported in the public playground.',
      'playground_sqlite_not_supported',
    )
  }

  const host = assertNonEmpty(resolved.host, 'host')
  assertAllowedHost(host)

  return {
    databaseEngine,
    host,
    port: resolved.port ?? DEFAULT_PORTS[databaseEngine],
    databaseName: assertNonEmpty(resolved.databaseName, 'databaseName'),
    username: assertNonEmpty(resolved.username, 'username'),
    password: assertNonEmpty(resolved.password, 'password'),
    sslMode: resolved.sslMode ?? 'require',
  }
}

function normalizeSql(sqlText: string) {
  const trimmed = sqlText.trim()
  if (!trimmed) {
    throw new ApiError(400, 'sqlText is required.', 'invalid_sql_text')
  }

  if (trimmed.length > MAX_SQL_LENGTH) {
    throw new ApiError(400, 'sqlText is too large.', 'sql_too_large')
  }

  for (const pattern of DISALLOWED_SQL_PATTERNS) {
    if (pattern.test(trimmed)) {
      throw new ApiError(
        400,
        'SQL contains unsupported or unsafe commands.',
        'sql_not_allowed',
      )
    }
  }

  const withoutTrailingSemicolon = trimmed.replace(/;+\s*$/, '')
  if (withoutTrailingSemicolon.includes(';')) {
    throw new ApiError(
      400,
      'Multiple SQL statements are not allowed in a single execution.',
      'multi_statement_not_allowed',
    )
  }

  if (!/^(select|with|pragma)\b/i.test(withoutTrailingSemicolon)) {
    throw new ApiError(
      400,
      'Only read-only SELECT, WITH, and PRAGMA queries are allowed in the public playground.',
      'playground_query_not_allowed',
    )
  }

  return withoutTrailingSemicolon
}

function paginateReadSql(
  sqlText: string,
  engine: DatabaseEngine,
  limit: number,
  offset: number,
) {
  if (engine === 'sqlserver') {
    return [
      `SELECT * FROM (${sqlText}) AS dataflow_query`,
      'ORDER BY (SELECT NULL)',
      `OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`,
    ].join(' ')
  }

  return `SELECT * FROM (${sqlText}) AS dataflow_query LIMIT ${limit} OFFSET ${offset}`
}

function resolvePagination(limit?: number, offset?: number) {
  const normalizedLimit = limit ?? DEFAULT_LIMIT
  const normalizedOffset = offset ?? 0

  if (normalizedLimit < 1 || normalizedLimit > MAX_LIMIT) {
    throw new ApiError(
      400,
      `limit must be between 1 and ${MAX_LIMIT}.`,
      'invalid_query_limit',
    )
  }

  if (normalizedOffset < 0) {
    throw new ApiError(400, 'offset must be >= 0.', 'invalid_query_offset')
  }

  return {
    limit: normalizedLimit,
    offset: normalizedOffset,
  }
}

function resolveTimeoutMs(timeoutMs?: number) {
  const value = timeoutMs ?? DEFAULT_QUERY_TIMEOUT_MS
  if (value < 1 || value > MAX_QUERY_TIMEOUT_MS) {
    throw new ApiError(
      400,
      `timeoutMs must be between 1 and ${MAX_QUERY_TIMEOUT_MS}.`,
      'invalid_query_timeout',
    )
  }

  return value
}

export async function testPlaygroundConnection(input: PlaygroundConnectionPayload) {
  assertPlaygroundEnabled()
  const connector = createRelationalConnector(resolveConnectionPayload(input))

  try {
    return await connector.testConnection()
  } catch (error) {
    throw new ApiError(
      400,
      `Failed to connect to external database: ${error instanceof Error ? error.message : 'unknown error'}`,
      'db_connection_test_failed',
    )
  }
}

export async function getPlaygroundSchema(input: PlaygroundConnectionPayload) {
  assertPlaygroundEnabled()
  const connectionInput = resolveConnectionPayload(input)
  const connector = createRelationalConnector(connectionInput)

  try {
    const [schemas, tables] = await Promise.all([
      connector.listSchemas(),
      connector.listTables(),
    ])

    return {
      databaseName: connectionInput.databaseName,
      databaseEngine: connectionInput.databaseEngine,
      schemas,
      tables,
    }
  } catch (error) {
    throw new ApiError(
      502,
      `Failed to fetch schema metadata: ${error instanceof Error ? error.message : 'unknown error'}`,
      'schema_metadata_fetch_failed',
    )
  }
}

export async function runPlaygroundQuery(input: PlaygroundQueryInput) {
  assertPlaygroundEnabled()
  const connectionInput = resolveConnectionPayload(input)
  const connector = createRelationalConnector(connectionInput)
  const normalizedSql = normalizeSql(input.sqlText)
  const pagination = resolvePagination(input.limit, input.offset)
  const timeoutMs = resolveTimeoutMs(input.timeoutMs)
  const execution = await connector.startQueryExecution({
    sql: paginateReadSql(
      normalizedSql,
      connectionInput.databaseEngine,
      pagination.limit,
      pagination.offset,
    ),
    timeoutMs,
  })
  const startedAt = Date.now()

  try {
    const result = await execution.run()
    return {
      durationMs: Date.now() - startedAt,
      command: result.command,
      rowCount: result.rowCount,
      columns: result.columns,
      rows: result.rows.map((row) => result.columns.map((column) => row[column] ?? null)),
      pagination,
    }
  } catch (error) {
    throw new ApiError(
      400,
      error instanceof Error ? error.message : 'unknown query error',
      'query_execution_failed',
    )
  } finally {
    await execution.close()
  }
}
