import { useEffect, useMemo, useRef, useState } from "react";
import {
  aiQueries,
  buildGeneratedRows,
  demoDbs,
  formatRowCount,
  mockResults,
  normalizeSql,
  type DemoDatabase,
  type DemoDatabaseKey,
  type QueryResult,
  type SupportedEngine,
} from "../../lib/dataflow-demo-data";

type ConnectTab = "demo" | "own";
type ResultStatus = "idle" | "loading" | "ok" | "error";
type StatusKind = "idle" | "loading" | "ok" | "error";
type SslMode =
  | "disable"
  | "allow"
  | "prefer"
  | "require"
  | "verify-ca"
  | "verify-full";

type PlaygroundTable = {
  rows: number;
  cols: string[];
  queryName: string;
  displayName: string;
};

type PlaygroundDatabase = {
  name: string;
  engine: SupportedEngine;
  tables: Record<string, PlaygroundTable>;
};

type ResultState = {
  status: ResultStatus;
  meta: string;
  data: QueryResult | null;
  error: string | null;
};

type ConnectionStatus = {
  kind: StatusKind;
  message: string;
};

type PlaygroundConnectionPayload = {
  connectionString?: string;
  databaseEngine?: SupportedEngine;
  host?: string;
  port?: number;
  databaseName?: string;
  username?: string;
  password?: string;
  sslMode?: SslMode;
};

type PlaygroundTestResponse = {
  testResult: {
    databaseName: string;
    currentUser: string | null;
    latencyMs: number;
  };
};

type PlaygroundSchemaResponse = {
  databaseName: string;
  databaseEngine: SupportedEngine;
  tables: Array<{
    schemaName: string;
    tableName: string;
    tableType: string;
  }>;
};

type PlaygroundQueryResponse = {
  durationMs: number;
  columns: string[];
  rows: Array<Array<string | number | boolean | null>>;
};

const sqlKeywords = [
  "SELECT",
  "FROM",
  "WHERE",
  "JOIN",
  "LEFT JOIN",
  "RIGHT JOIN",
  "INNER JOIN",
  "GROUP BY",
  "ORDER BY",
  "HAVING",
  "LIMIT",
  "OFFSET",
  "ON",
  "AND",
  "OR",
  "NOT",
  "IN",
  "AS",
  "DISTINCT",
  "COUNT",
  "SUM",
  "AVG",
  "MAX",
  "MIN",
  "INSERT",
  "UPDATE",
  "DELETE",
  "SET",
  "VALUES",
  "RETURNING",
];

const demoCards: Array<{
  key: DemoDatabaseKey;
  icon: string;
  name: string;
  description: string;
  engine: string;
}> = [
  {
    key: "ecommerce",
    icon: "🛍️",
    name: "E-commerce",
    description: "Users, orders, products, payments. 14k rows across 6 tables.",
    engine: "PostgreSQL",
  },
  {
    key: "analytics",
    icon: "📊",
    name: "Analytics",
    description: "Events, sessions, funnels, cohorts. Time-series data.",
    engine: "PostgreSQL",
  },
  {
    key: "saas",
    icon: "🏢",
    name: "SaaS App",
    description: "Workspaces, members, billing, subscriptions. Multi-tenant.",
    engine: "MySQL",
  },
];

function buildInitialResults(): ResultState {
  return {
    status: "idle",
    meta: "Run a query to see results",
    data: null,
    error: null,
  };
}

function buildInitialConnectionStatus(): ConnectionStatus {
  return {
    kind: "idle",
    message: "",
  };
}

function extractErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed.";
}

async function requestPlayground<T>(
  path: string,
  payload: unknown,
): Promise<T> {
  const response = await fetch(`/api/v1/playground/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => null)) as
    | { error?: string }
    | T
    | null;

  if (!response.ok) {
    throw new Error(
      (data as { error?: string } | null)?.error ?? "Request failed.",
    );
  }

  return data as T;
}

function resolvePlaygroundTableName(
  engine: SupportedEngine,
  schemaName: string,
  tableName: string,
) {
  if (engine === "sqlite") {
    return tableName;
  }

  return `${schemaName}.${tableName}`;
}

function mapSchemaResponseToDatabase(
  response: PlaygroundSchemaResponse,
): PlaygroundDatabase {
  const tables = Object.fromEntries(
    response.tables.map((table) => {
      const key = resolvePlaygroundTableName(
        response.databaseEngine,
        table.schemaName,
        table.tableName,
      );

      return [
        key,
        {
          rows: -1,
          cols: [],
          queryName: key,
          displayName: key,
        },
      ];
    }),
  );

  return {
    name: response.databaseName,
    engine: response.databaseEngine,
    tables,
  };
}

function mapDemoDatabaseToPlayground(
  database: DemoDatabase,
): PlaygroundDatabase {
  const tables = Object.fromEntries(
    Object.entries(database.tables).map(([tableName, table]) => [
      tableName,
      {
        rows: table.rows,
        cols: table.cols,
        queryName: tableName,
        displayName: tableName,
      },
    ]),
  );

  return {
    name: database.name,
    engine: database.engine,
    tables,
  };
}

export function PlaygroundSection() {
  const [connectTab, setConnectTab] = useState<ConnectTab>("demo");
  const [selectedDemo, setSelectedDemo] =
    useState<DemoDatabaseKey>("ecommerce");
  const [activeDatasetKey, setActiveDatasetKey] =
    useState<DemoDatabaseKey>("ecommerce");
  const [activeDatabase, setActiveDatabase] =
    useState<PlaygroundDatabase | null>(null);
  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [showAiBar, setShowAiBar] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [sql, setSql] = useState("");
  const [results, setResults] = useState<ResultState>(buildInitialResults);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    buildInitialConnectionStatus,
  );
  const [engine, setEngine] = useState<SupportedEngine>("postgresql");
  const [host, setHost] = useState("");
  const [databaseName, setDatabaseName] = useState("");
  const [port, setPort] = useState("5432");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [connectionString, setConnectionString] = useState("");
  const [sslMode, setSslMode] = useState<SslMode>("disable");
  const [liveConnectionPayload, setLiveConnectionPayload] =
    useState<PlaygroundConnectionPayload | null>(null);
  const pendingAiResultRef = useRef<QueryResult | null>(null);
  const timeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((timeoutId) =>
        window.clearTimeout(timeoutId),
      );
    };
  }, []);

  const lineNumbers = useMemo(() => {
    return Array.from(
      { length: Math.max(1, sql.split("\n").length) },
      (_, index) => index + 1,
    ).join("\n");
  }, [sql]);

  function schedule(callback: () => void, delay: number) {
    const timeoutId = window.setTimeout(callback, delay);
    timeoutsRef.current.push(timeoutId);
  }

  function clearResults() {
    setResults(buildInitialResults());
  }

  function buildConnectionPayload(): PlaygroundConnectionPayload {
    return {
      connectionString: connectionString.trim() || undefined,
      databaseEngine: engine,
      host: host.trim() || undefined,
      port: port.trim() ? Number(port) : undefined,
      databaseName: databaseName.trim() || undefined,
      username: username.trim() || undefined,
      password: password || undefined,
      sslMode,
    };
  }

  function openStudio(
    nextDatabase: PlaygroundDatabase,
    datasetKey: DemoDatabaseKey,
  ) {
    const firstTable = Object.keys(nextDatabase.tables)[0] ?? null;

    setActiveDatabase(nextDatabase);
    setActiveDatasetKey(datasetKey);
    setActiveTable(firstTable);
    setSql(
      firstTable
        ? `SELECT * FROM ${nextDatabase.tables[firstTable]?.queryName ?? firstTable} LIMIT 10;`
        : "",
    );
    setShowAiBar(false);
    setAiPrompt("");
    pendingAiResultRef.current = null;
    clearResults();
  }

  function connectDemo() {
    setLiveConnectionPayload(null);
    setConnectionStatus(buildInitialConnectionStatus());
    openStudio(mapDemoDatabaseToPlayground(demoDbs[selectedDemo]), selectedDemo);
  }

  async function testConnection() {
    setConnectionStatus({
      kind: "loading",
      message: "⏳ Connecting…",
    });

    try {
      const payload = buildConnectionPayload();
      const response = await requestPlayground<PlaygroundTestResponse>(
        "test-connection",
        payload,
      );
      setConnectionStatus({
        kind: "ok",
        message: `✓ Connected to ${response.testResult.databaseName} in ${response.testResult.latencyMs}ms`,
      });
    } catch (error) {
      setConnectionStatus({
        kind: "error",
        message: `× ${extractErrorMessage(error)}`,
      });
    }
  }

  async function connectOwn() {
    setConnectionStatus({
      kind: "loading",
      message: "⏳ Connecting…",
    });

    try {
      const payload = buildConnectionPayload();
      const response = await requestPlayground<PlaygroundSchemaResponse>(
        "schema",
        payload,
      );
      const datasetKey = engine === "mysql" ? "saas" : "ecommerce";
      setLiveConnectionPayload(payload);
      openStudio(mapSchemaResponseToDatabase(response), datasetKey);
      setConnectionStatus({
        kind: "ok",
        message: `✓ Connected — ${response.tables.length} tables discovered`,
      });
    } catch (error) {
      setConnectionStatus({
        kind: "error",
        message: `× ${extractErrorMessage(error)}`,
      });
    }
  }

  function disconnect() {
    setActiveDatabase(null);
    setActiveTable(null);
    setSql("");
    setShowAiBar(false);
    setAiPrompt("");
    setLiveConnectionPayload(null);
    pendingAiResultRef.current = null;
    clearResults();
  }

  function selectTable(tableName: string) {
    setActiveTable(tableName);
    const nextQueryName =
      activeDatabase?.tables[tableName]?.queryName ?? tableName;
    setSql(`SELECT * FROM ${nextQueryName} LIMIT 10;`);
    pendingAiResultRef.current = null;
    clearResults();
  }

  function renderResult(result: QueryResult, duration: number) {
    setResults({
      status: "ok",
      meta: `${result.rows.length} row${result.rows.length === 1 ? "" : "s"} · ${Math.round(duration)}ms`,
      data: result,
      error: null,
    });
  }

  function showQueryError(message: string) {
    setResults({
      status: "error",
      meta: "Error",
      data: null,
      error: message,
    });
  }

  async function runQueryWithText(sqlText: string) {
    const trimmedSql = sqlText.trim();
    if (!trimmedSql) {
      return;
    }

    setResults({
      status: "loading",
      meta: "Executing…",
      data: null,
      error: null,
    });

    if (liveConnectionPayload) {
      try {
        const response = await requestPlayground<PlaygroundQueryResponse>(
          "query",
          {
            ...liveConnectionPayload,
            sqlText: trimmedSql,
          },
        );
        renderResult(
          {
            cols: response.columns,
            rows: response.rows as Array<Array<string | number | null>>,
          },
          response.durationMs,
        );
      } catch (error) {
        showQueryError(extractErrorMessage(error));
      }
      return;
    }

    const duration = 300 + Math.random() * 600;

    schedule(() => {
      const pendingAiResult = pendingAiResultRef.current;
      if (pendingAiResult) {
        pendingAiResultRef.current = null;
        renderResult(pendingAiResult, duration);
        return;
      }

      const mock = mockResults[normalizeSql(trimmedSql)];
      if (mock) {
        renderResult(mock, duration);
        return;
      }

      if (activeTable && activeDatabase?.tables[activeTable]) {
        const table = activeDatabase.tables[activeTable];
        renderResult(
          {
            cols: table.cols,
            rows: buildGeneratedRows(table.cols, 8),
          },
          duration,
        );
        return;
      }

      showQueryError("Syntax error or table not found in demo dataset.");
    }, duration);
  }

  function runQuery() {
    void runQueryWithText(sql);
  }

  function formatSql() {
    let formattedSql = sql;
    sqlKeywords.forEach((keyword) => {
      formattedSql = formattedSql.replace(
        new RegExp(`\\b${keyword}\\b`, "gi"),
        keyword,
      );
    });
    setSql(formattedSql);
  }

  function clearEditor() {
    setSql("");
    pendingAiResultRef.current = null;
    clearResults();
  }

  function generateSql() {
    if (liveConnectionPayload) {
      setShowAiBar(false);
      showQueryError(
        "AI generation is not available in the public playground. Use a workspace to generate SQL against your schema.",
      );
      return;
    }

    const nextAiQuery = aiQueries[activeDatasetKey] ?? aiQueries.ecommerce;
    setSql("-- ✦ AI is generating your query…");
    clearResults();

    schedule(() => {
      pendingAiResultRef.current = nextAiQuery.result;
      setSql(nextAiQuery.sql);
      setShowAiBar(false);
      setAiPrompt("");
      void runQueryWithText(nextAiQuery.sql);
    }, 1400);
  }

  return (
    <div id="playground">
      <div className="playground-inner">
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginBottom: "40px",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div>
            <div className="section-eyebrow">Live Demo</div>
            <h2 className="section-title" style={{ marginBottom: "8px" }}>
              Connect your database. Right now.
            </h2>
            <p className="section-sub" style={{ maxWidth: "500px" }}>
              Paste your connection string, enter credentials, or pick a sample
              database. Browse your tables, write SQL, and let AI generate
              queries. This is exactly what DataFlow Studio feels like.
            </p>
          </div>
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: "11px",
              color: "var(--muted)",
              textAlign: "right",
              lineHeight: 1.8,
            }}
          >
            <div>
              Credentials are sent to your DataFlow API and are not persisted by
              the playground
            </div>
            <div style={{ color: "var(--blue)" }}>
              Powered by DataFlow Studio API
            </div>
          </div>
        </div>

        {!activeDatabase ? (
          <div id="connect-panel">
            <div className="connect-tabs">
              <button
                type="button"
                className={`connect-tab${connectTab === "demo" ? " active" : ""}`}
                onClick={() => setConnectTab("demo")}
              >
                Try a sample database
              </button>
              <button
                type="button"
                className={`connect-tab${connectTab === "own" ? " active" : ""}`}
                onClick={() => setConnectTab("own")}
              >
                Connect your own
              </button>
            </div>

            {connectTab === "demo" ? (
              <div id="demo-panel">
                <div className="demo-dbs">
                  {demoCards.map((card) => (
                    <button
                      key={card.key}
                      type="button"
                      className={`demo-db-card${selectedDemo === card.key ? " selected" : ""}`}
                      onClick={() => setSelectedDemo(card.key)}
                    >
                      <div className="demo-db-icon">{card.icon}</div>
                      <div className="demo-db-name">{card.name}</div>
                      <div className="demo-db-desc">{card.description}</div>
                      <div className="demo-db-engine">{card.engine}</div>
                    </button>
                  ))}
                </div>
                <div
                  style={{
                    marginTop: "20px",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <button
                    type="button"
                    className="connect-btn primary"
                    onClick={connectDemo}
                  >
                    Open in Studio →
                  </button>
                  <span
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: "11px",
                      color: "var(--muted)",
                    }}
                  >
                    No account required
                  </span>
                </div>
              </div>
            ) : (
              <>
                <div id="own-panel">
                  <div className="connect-form">
                    <div className="form-row">
                      <div className="form-field">
                        <label className="form-label" htmlFor="db-engine">
                          Engine
                        </label>
                        <select
                          id="db-engine"
                          className="form-select"
                          value={engine}
                          onChange={(event) =>
                            setEngine(event.target.value as SupportedEngine)
                          }
                        >
                          <option value="postgresql">PostgreSQL</option>
                          <option value="mysql">MySQL</option>
                          <option value="sqlite">SQLite</option>
                          <option value="sqlserver">SQL Server</option>
                        </select>
                      </div>
                      <div className="form-field">
                        <label className="form-label" htmlFor="db-host">
                          Host
                        </label>
                        <input
                          id="db-host"
                          className="form-input"
                          value={host}
                          onChange={(event) => setHost(event.target.value)}
                          placeholder="db.example.com"
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-field">
                        <label className="form-label" htmlFor="db-name">
                          Database
                        </label>
                        <input
                          id="db-name"
                          className="form-input"
                          value={databaseName}
                          onChange={(event) =>
                            setDatabaseName(event.target.value)
                          }
                          placeholder="my_database"
                        />
                      </div>
                      <div className="form-field">
                        <label className="form-label" htmlFor="db-port">
                          Port
                        </label>
                        <input
                          id="db-port"
                          className="form-input"
                          value={port}
                          onChange={(event) => setPort(event.target.value)}
                          placeholder="5432"
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-field">
                        <label className="form-label" htmlFor="db-user">
                          Username
                        </label>
                        <input
                          id="db-user"
                          className="form-input"
                          value={username}
                          onChange={(event) => setUsername(event.target.value)}
                          placeholder="readonly_user"
                        />
                      </div>
                      <div className="form-field">
                        <label className="form-label" htmlFor="db-pass">
                          Password
                        </label>
                        <input
                          id="db-pass"
                          className="form-input"
                          type="password"
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          placeholder="••••••••"
                        />
                      </div>
                    </div>

                    <div className="form-field">
                      <label className="form-label" htmlFor="db-connstr">
                        Or paste connection string
                      </label>
                      <input
                        id="db-connstr"
                        className="form-input"
                        value={connectionString}
                        onChange={(event) =>
                          setConnectionString(event.target.value)
                        }
                        placeholder="postgresql://user:pass@host:5432/dbname"
                      />
                    </div>

                    <div className="form-field">
                      <label className="form-label" htmlFor="db-ssl-mode">
                        SSL mode
                      </label>
                      <select
                        id="db-ssl-mode"
                        className="form-select"
                        value={sslMode}
                        onChange={(event) =>
                          setSslMode(event.target.value as SslMode)
                        }
                      >
                        <option value="disable">disable</option>
                        <option value="allow">allow</option>
                        <option value="prefer">prefer</option>
                        <option value="require">require</option>
                        <option value="verify-ca">verify-ca</option>
                        <option value="verify-full">verify-full</option>
                      </select>
                    </div>

                    <div className="connect-actions">
                      <button
                        type="button"
                        className="connect-btn ghost"
                        onClick={() => void testConnection()}
                        disabled={connectionStatus.kind === "loading"}
                      >
                        {connectionStatus.kind === "loading"
                          ? "Testing…"
                          : "Test connection"}
                      </button>
                      <button
                        type="button"
                        className="connect-btn primary"
                        onClick={() => void connectOwn()}
                        disabled={connectionStatus.kind === "loading"}
                      >
                        Connect →
                      </button>
                      {connectionStatus.kind !== "idle" ? (
                        <span
                          className={`connect-status ${connectionStatus.kind === "loading" ? "conn-testing" : connectionStatus.kind === "ok" ? "conn-ok" : "conn-err"}`}
                        >
                          {connectionStatus.message}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    marginTop: "14px",
                    padding: "12px 16px",
                    background: "var(--blue-dim)",
                    border: "1px solid rgba(79,142,247,.2)",
                    borderRadius: "10px",
                    fontSize: "12px",
                    color: "var(--sub)",
                    fontFamily: "var(--mono)",
                    lineHeight: 1.65,
                  }}
                >
                  ℹ️ &nbsp;To connect a live database, deploy DataFlow Studio
                  and point the landing page at your API. SQLite is
                  intentionally blocked for the public playground because it
                  would expose server file paths.
                  <a
                    href="https://github.com/Veri5ied/dataflow-studio/blob/main/docs/setup.md"
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "var(--blue)", textDecoration: "none" }}
                  >
                    {" "}
                    Self-hosting guide →
                  </a>
                </div>
              </>
            )}
          </div>
        ) : (
          <div id="studio-panel">
            <div className="studio-shell">
              <div className="studio-sidebar">
                <div className="studio-conn-badge">
                  <div className="conn-indicator" />
                  <span className="conn-name">{activeDatabase.name}</span>
                  <button
                    type="button"
                    className="disconnect-btn"
                    onClick={disconnect}
                    title="Disconnect"
                  >
                    ✕
                  </button>
                </div>

                <div className="schema-label">Tables</div>
                <div className="schema-tables">
                  {Object.entries(activeDatabase.tables).map(
                    ([tableName, tableMeta]) => (
                      <button
                        key={tableName}
                        type="button"
                        className={`schema-table-item${activeTable === tableName ? " active" : ""}`}
                        onClick={() => selectTable(tableName)}
                      >
                        <span className="tbl-icon">▤</span>
                        <span className="tbl-name">
                          {tableMeta.displayName}
                        </span>
                        <span className="tbl-rows">
                          {formatRowCount(tableMeta.rows)}
                        </span>
                      </button>
                    ),
                  )}
                </div>
              </div>

              <div className="studio-main">
                <div className="studio-toolbar">
                  <button
                    type="button"
                    className="studio-btn run"
                    onClick={runQuery}
                  >
                    ▶ Run
                  </button>
                  <button
                    type="button"
                    className="studio-btn ai"
                    onClick={() => setShowAiBar((value) => !value)}
                  >
                    ✦ AI Generate
                  </button>
                  <div className="studio-divider-v" />
                  <button
                    type="button"
                    className="studio-btn sec"
                    onClick={formatSql}
                  >
                    ⇌ Format
                  </button>
                  <button
                    type="button"
                    className="studio-btn sec"
                    onClick={clearEditor}
                  >
                    ✕ Clear
                  </button>
                  <div
                    style={{
                      marginLeft: "auto",
                      fontFamily: "var(--mono)",
                      fontSize: "10px",
                      color: "var(--muted)",
                    }}
                  >
                    {activeTable ?? ""}
                  </div>
                </div>

                <div className={`ai-bar${showAiBar ? "" : " hidden"}`}>
                  <span
                    style={{
                      fontSize: "14px",
                      flexShrink: 0,
                      color: "var(--violet)",
                    }}
                  >
                    ✦
                  </span>
                  <input
                    type="text"
                    value={aiPrompt}
                    onChange={(event) => setAiPrompt(event.target.value)}
                    placeholder="Describe what you want… e.g. 'top 5 customers by spend last month'"
                  />
                  <button
                    type="button"
                    className="ai-generate-btn"
                    onClick={generateSql}
                  >
                    Generate SQL
                  </button>
                  <button
                    type="button"
                    className="ai-close"
                    onClick={() => setShowAiBar(false)}
                  >
                    ✕
                  </button>
                </div>

                <div className="sql-editor">
                  <div className="editor-wrap">
                    <div className="line-numbers">{lineNumbers}</div>
                    <textarea
                      className="editor-textarea"
                      spellCheck={false}
                      value={sql}
                      onChange={(event) => setSql(event.target.value)}
                      onKeyDown={(event) => {
                        if (
                          (event.ctrlKey || event.metaKey) &&
                          event.key === "Enter"
                        ) {
                          event.preventDefault();
                          runQuery();
                        }
                      }}
                      placeholder="-- Write SQL here, or use ✦ AI Generate above"
                    />
                  </div>
                </div>

                <div className="results-pane">
                  <div className="results-bar">
                    {results.status === "ok" ? (
                      <span className="results-status rs-ok">OK</span>
                    ) : null}
                    {results.status === "error" ? (
                      <span className="results-status rs-err">Error</span>
                    ) : null}
                    <span className="rs-meta">{results.meta}</span>
                  </div>
                  <div className="results-table-wrap">
                    {results.status === "idle" ? (
                      <div className="results-empty">
                        <span style={{ opacity: 0.4, fontSize: "18px" }}>
                          ⌘↵
                        </span>
                        <span>Press Run or Ctrl+Enter to execute</span>
                      </div>
                    ) : null}

                    {results.status === "loading" ? (
                      <table className="results-table">
                        <thead>
                          <tr>
                            <th>loading</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Array.from({ length: 5 }, (_, index) => (
                            <tr key={index} className="shimmer-row">
                              <td
                                style={{
                                  color: "var(--muted)",
                                  letterSpacing: ".15em",
                                }}
                              >
                                ████████████████
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : null}

                    {results.status === "ok" && results.data ? (
                      <table className="results-table">
                        <thead>
                          <tr>
                            {results.data.cols.map((column) => (
                              <th key={column}>{column}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {results.data.rows.map((row, rowIndex) => (
                            <tr key={`${rowIndex}-${row.length}`}>
                              {row.map((cell, cellIndex) => (
                                <td
                                  key={`${rowIndex}-${cellIndex}`}
                                  className={
                                    cell === null ? "null-val" : undefined
                                  }
                                >
                                  {cell === null ? "NULL" : String(cell)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : null}

                    {results.status === "error" && results.error ? (
                      <div className="results-error">× {results.error}</div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
