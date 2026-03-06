import { useEffect, useMemo, useRef, useState } from 'react'
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
} from '../../lib/dataflow-demo-data'

type ConnectTab = 'demo' | 'own'
type ResultStatus = 'idle' | 'loading' | 'ok' | 'error'
type TestStatus = 'idle' | 'testing' | 'ok'

type ResultState = {
  status: ResultStatus
  meta: string
  data: QueryResult | null
  error: string | null
}

const sqlKeywords = [
  'SELECT',
  'FROM',
  'WHERE',
  'JOIN',
  'LEFT JOIN',
  'RIGHT JOIN',
  'INNER JOIN',
  'GROUP BY',
  'ORDER BY',
  'HAVING',
  'LIMIT',
  'OFFSET',
  'ON',
  'AND',
  'OR',
  'NOT',
  'IN',
  'AS',
  'DISTINCT',
  'COUNT',
  'SUM',
  'AVG',
  'MAX',
  'MIN',
  'INSERT',
  'UPDATE',
  'DELETE',
  'SET',
  'VALUES',
  'RETURNING',
]

const demoCards: Array<{
  key: DemoDatabaseKey
  icon: string
  name: string
  description: string
  engine: string
}> = [
  {
    key: 'ecommerce',
    icon: '🛍️',
    name: 'E-commerce',
    description: 'Users, orders, products, payments. 14k rows across 6 tables.',
    engine: 'PostgreSQL',
  },
  {
    key: 'analytics',
    icon: '📊',
    name: 'Analytics',
    description: 'Events, sessions, funnels, cohorts. Time-series data.',
    engine: 'PostgreSQL',
  },
  {
    key: 'saas',
    icon: '🏢',
    name: 'SaaS App',
    description: 'Workspaces, members, billing, subscriptions. Multi-tenant.',
    engine: 'MySQL',
  },
]

function buildInitialResults(): ResultState {
  return {
    status: 'idle',
    meta: 'Run a query to see results',
    data: null,
    error: null,
  }
}

export function PlaygroundSection() {
  const [connectTab, setConnectTab] = useState<ConnectTab>('demo')
  const [selectedDemo, setSelectedDemo] = useState<DemoDatabaseKey>('ecommerce')
  const [activeDatasetKey, setActiveDatasetKey] = useState<DemoDatabaseKey>('ecommerce')
  const [activeDatabase, setActiveDatabase] = useState<DemoDatabase | null>(null)
  const [activeTable, setActiveTable] = useState<string | null>(null)
  const [showAiBar, setShowAiBar] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [sql, setSql] = useState('')
  const [results, setResults] = useState<ResultState>(buildInitialResults)
  const [testStatus, setTestStatus] = useState<TestStatus>('idle')
  const [engine, setEngine] = useState<SupportedEngine>('postgresql')
  const [host, setHost] = useState('')
  const [databaseName, setDatabaseName] = useState('')
  const [port, setPort] = useState('5432')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [connectionString, setConnectionString] = useState('')
  const pendingAiResultRef = useRef<QueryResult | null>(null)
  const timeoutsRef = useRef<number[]>([])

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId))
    }
  }, [])

  const lineNumbers = useMemo(() => {
    return Array.from({ length: Math.max(1, sql.split('\n').length) }, (_, index) => index + 1).join('\n')
  }, [sql])

  function schedule(callback: () => void, delay: number) {
    const timeoutId = window.setTimeout(callback, delay)
    timeoutsRef.current.push(timeoutId)
  }

  function clearResults() {
    setResults(buildInitialResults())
  }

  function openStudio(nextDatabase: DemoDatabase, datasetKey: DemoDatabaseKey) {
    const firstTable = Object.keys(nextDatabase.tables)[0] ?? null

    setActiveDatabase(nextDatabase)
    setActiveDatasetKey(datasetKey)
    setActiveTable(firstTable)
    setSql(firstTable ? `SELECT * FROM ${firstTable} LIMIT 10;` : '')
    setShowAiBar(false)
    setAiPrompt('')
    pendingAiResultRef.current = null
    clearResults()
  }

  function connectDemo() {
    openStudio(demoDbs[selectedDemo], selectedDemo)
  }

  function testConnection() {
    setTestStatus('testing')

    schedule(() => {
      setTestStatus('ok')
    }, 1100)
  }

  function connectOwn() {
    const matchedEntry = (Object.entries(demoDbs) as Array<[DemoDatabaseKey, DemoDatabase]>).find(
      ([, database]) => database.engine === engine,
    )

    const datasetKey = matchedEntry?.[0] ?? 'ecommerce'
    const dataset = matchedEntry?.[1] ?? demoDbs.ecommerce

    openStudio(
      {
        ...dataset,
        name: databaseName || 'my_database',
      },
      datasetKey,
    )
  }

  function disconnect() {
    setActiveDatabase(null)
    setActiveTable(null)
    setSql('')
    setShowAiBar(false)
    setAiPrompt('')
    pendingAiResultRef.current = null
    clearResults()
  }

  function selectTable(tableName: string) {
    setActiveTable(tableName)
    setSql(`SELECT * FROM ${tableName} LIMIT 10;`)
    pendingAiResultRef.current = null
    clearResults()
  }

  function renderResult(result: QueryResult, duration: number) {
    setResults({
      status: 'ok',
      meta: `${result.rows.length} row${result.rows.length === 1 ? '' : 's'} · ${Math.round(duration)}ms`,
      data: result,
      error: null,
    })
  }

  function showQueryError(message: string) {
    setResults({
      status: 'error',
      meta: 'Error',
      data: null,
      error: message,
    })
  }

  function runQueryWithText(sqlText: string) {
    const trimmedSql = sqlText.trim()
    if (!trimmedSql) {
      return
    }

    setResults({
      status: 'loading',
      meta: 'Executing…',
      data: null,
      error: null,
    })

    const duration = 300 + Math.random() * 600

    schedule(() => {
      const pendingAiResult = pendingAiResultRef.current
      if (pendingAiResult) {
        pendingAiResultRef.current = null
        renderResult(pendingAiResult, duration)
        return
      }

      const mock = mockResults[normalizeSql(trimmedSql)]
      if (mock) {
        renderResult(mock, duration)
        return
      }

      if (activeTable && activeDatabase?.tables[activeTable]) {
        const table = activeDatabase.tables[activeTable]
        renderResult(
          {
            cols: table.cols,
            rows: buildGeneratedRows(table.cols, 8),
          },
          duration,
        )
        return
      }

      showQueryError('Syntax error or table not found in demo dataset.')
    }, duration)
  }

  function runQuery() {
    runQueryWithText(sql)
  }

  function formatSql() {
    let formattedSql = sql
    sqlKeywords.forEach((keyword) => {
      formattedSql = formattedSql.replace(new RegExp(`\\b${keyword}\\b`, 'gi'), keyword)
    })
    setSql(formattedSql)
  }

  function clearEditor() {
    setSql('')
    pendingAiResultRef.current = null
    clearResults()
  }

  function generateSql() {
    const nextAiQuery = aiQueries[activeDatasetKey] ?? aiQueries.ecommerce
    setSql('-- ✦ AI is generating your query…')
    clearResults()

    schedule(() => {
      pendingAiResultRef.current = nextAiQuery.result
      setSql(nextAiQuery.sql)
      setShowAiBar(false)
      setAiPrompt('')
      runQueryWithText(nextAiQuery.sql)
    }, 1400)
  }

  return (
    <div id="playground">
      <div className="playground-inner">
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '40px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div className="section-eyebrow">Live Demo</div>
            <h2 className="section-title" style={{ marginBottom: '8px' }}>
              Connect your database. Right now.
            </h2>
            <p className="section-sub" style={{ maxWidth: '500px' }}>
              Paste your connection string, enter credentials, or pick a sample database. Browse your tables, write SQL, and let AI generate queries — this is exactly what DataFlow Studio feels like.
            </p>
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--muted)', textAlign: 'right', lineHeight: 1.8 }}>
            <div>Your credentials never leave your browser</div>
            <div style={{ color: 'var(--blue)' }}>Powered by DataFlow Studio API</div>
          </div>
        </div>

        {!activeDatabase ? (
          <div id="connect-panel">
            <div className="connect-tabs">
              <button
                type="button"
                className={`connect-tab${connectTab === 'demo' ? ' active' : ''}`}
                onClick={() => setConnectTab('demo')}
              >
                Try a sample database
              </button>
              <button
                type="button"
                className={`connect-tab${connectTab === 'own' ? ' active' : ''}`}
                onClick={() => setConnectTab('own')}
              >
                Connect your own
              </button>
            </div>

            {connectTab === 'demo' ? (
              <div id="demo-panel">
                <div className="demo-dbs">
                  {demoCards.map((card) => (
                    <button
                      key={card.key}
                      type="button"
                      className={`demo-db-card${selectedDemo === card.key ? ' selected' : ''}`}
                      onClick={() => setSelectedDemo(card.key)}
                    >
                      <div className="demo-db-icon">{card.icon}</div>
                      <div className="demo-db-name">{card.name}</div>
                      <div className="demo-db-desc">{card.description}</div>
                      <div className="demo-db-engine">{card.engine}</div>
                    </button>
                  ))}
                </div>
                <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button type="button" className="connect-btn primary" onClick={connectDemo}>
                    Open in Studio →
                  </button>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--muted)' }}>
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
                          onChange={(event) => setEngine(event.target.value as SupportedEngine)}
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
                          onChange={(event) => setDatabaseName(event.target.value)}
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
                        onChange={(event) => setConnectionString(event.target.value)}
                        placeholder="postgresql://user:pass@host:5432/dbname"
                      />
                    </div>

                    <div className="connect-actions">
                      <button type="button" className="connect-btn ghost" onClick={testConnection} disabled={testStatus === 'testing'}>
                        {testStatus === 'testing' ? 'Testing…' : 'Test connection'}
                      </button>
                      <button type="button" className="connect-btn primary" onClick={connectOwn}>
                        Connect →
                      </button>
                      {testStatus !== 'idle' ? (
                        <span className={`connect-status ${testStatus === 'testing' ? 'conn-testing' : 'conn-ok'}`}>
                          {testStatus === 'testing' ? '⏳ Connecting…' : '✓ Connected — running in demo mode'}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: '14px', padding: '12px 16px', background: 'var(--blue-dim)', border: '1px solid rgba(79,142,247,.2)', borderRadius: '10px', fontSize: '12px', color: 'var(--sub)', fontFamily: 'var(--mono)', lineHeight: 1.65 }}>
                  ℹ️ &nbsp;To connect a live database, deploy DataFlow Studio and set it as your API endpoint.
                  <a
                    href="https://github.com/Veri5ied/dataflow-studio"
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: 'var(--blue)', textDecoration: 'none' }}
                  >
                    {' '}
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
                  <button type="button" className="disconnect-btn" onClick={disconnect} title="Disconnect">
                    ✕
                  </button>
                </div>

                <div className="schema-label">Tables</div>
                <div className="schema-tables">
                  {Object.entries(activeDatabase.tables).map(([tableName, tableMeta]) => (
                    <button
                      key={tableName}
                      type="button"
                      className={`schema-table-item${activeTable === tableName ? ' active' : ''}`}
                      onClick={() => selectTable(tableName)}
                    >
                      <span className="tbl-icon">▤</span>
                      <span className="tbl-name">{tableName}</span>
                      <span className="tbl-rows">{formatRowCount(tableMeta.rows)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="studio-main">
                <div className="studio-toolbar">
                  <button type="button" className="studio-btn run" onClick={runQuery}>
                    ▶ Run
                  </button>
                  <button type="button" className="studio-btn ai" onClick={() => setShowAiBar((value) => !value)}>
                    ✦ AI Generate
                  </button>
                  <div className="studio-divider-v" />
                  <button type="button" className="studio-btn sec" onClick={formatSql}>
                    ⇌ Format
                  </button>
                  <button type="button" className="studio-btn sec" onClick={clearEditor}>
                    ✕ Clear
                  </button>
                  <div style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--muted)' }}>
                    {activeTable ?? ''}
                  </div>
                </div>

                <div className={`ai-bar${showAiBar ? '' : ' hidden'}`}>
                  <span style={{ fontSize: '14px', flexShrink: 0, color: 'var(--violet)' }}>✦</span>
                  <input
                    type="text"
                    value={aiPrompt}
                    onChange={(event) => setAiPrompt(event.target.value)}
                    placeholder="Describe what you want… e.g. 'top 5 customers by spend last month'"
                  />
                  <button type="button" className="ai-generate-btn" onClick={generateSql}>
                    Generate SQL
                  </button>
                  <button type="button" className="ai-close" onClick={() => setShowAiBar(false)}>
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
                        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                          event.preventDefault()
                          runQuery()
                        }
                      }}
                      placeholder="-- Write SQL here, or use ✦ AI Generate above"
                    />
                  </div>
                </div>

                <div className="results-pane">
                  <div className="results-bar">
                    {results.status === 'ok' ? <span className="results-status rs-ok">OK</span> : null}
                    {results.status === 'error' ? <span className="results-status rs-err">Error</span> : null}
                    <span className="rs-meta">{results.meta}</span>
                  </div>
                  <div className="results-table-wrap">
                    {results.status === 'idle' ? (
                      <div className="results-empty">
                        <span style={{ opacity: 0.4, fontSize: '18px' }}>⌘↵</span>
                        <span>Press Run or Ctrl+Enter to execute</span>
                      </div>
                    ) : null}

                    {results.status === 'loading' ? (
                      <table className="results-table">
                        <thead>
                          <tr>
                            <th>loading</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Array.from({ length: 5 }, (_, index) => (
                            <tr key={index} className="shimmer-row">
                              <td style={{ color: 'var(--muted)', letterSpacing: '.15em' }}>████████████████</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : null}

                    {results.status === 'ok' && results.data ? (
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
                            <tr key={`${rowIndex}-${row.join('-')}`}>
                              {row.map((cell, cellIndex) => (
                                <td key={`${rowIndex}-${cellIndex}`} className={cell === null ? 'null-val' : undefined}>
                                  {cell === null ? 'NULL' : String(cell)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : null}

                    {results.status === 'error' && results.error ? (
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
  )
}
