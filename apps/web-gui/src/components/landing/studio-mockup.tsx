const sidebarItems = [
  'workspaces',
  'users',
  'query_history',
  'saved_queries',
]

const rows = [
  ['Prod DB', '842', '6', 'active'],
  ['Analytics', '291', '3', 'active'],
  ['Staging', '73', '2', 'trial'],
]

export function StudioMockup() {
  return (
    <div className="mockup-wrap">
      <div className="studio-mockup">
        <div className="mockup-titlebar">
          <div className="m-dot" style={{ background: '#ff5f57' }} />
          <div className="m-dot" style={{ background: '#febc2e' }} />
          <div className="m-dot" style={{ background: '#28c840' }} />
          <div className="mockup-tabs">
            <div className="m-tab active">Query Editor</div>
            <div className="m-tab">Schema Explorer</div>
            <div className="m-tab">History</div>
          </div>
        </div>

        <div className="mockup-body">
          <div className="mockup-sidebar">
            <div className="ms-section">Tables</div>
            {sidebarItems.map((item, index) => (
              <div key={item} className={`ms-item${index === 0 ? ' active' : ''}`}>
                <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                  <rect x="1" y="1" width="10" height="10" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
                  <line x1="1" y1="4" x2="11" y2="4" stroke="currentColor" strokeWidth="1.2" />
                  <line x1="4" y1="4" x2="4" y2="11" stroke="currentColor" strokeWidth="1.2" />
                </svg>
                {item}
              </div>
            ))}
            <div className="ms-section">Views</div>
            <div className="ms-item">
              <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
                <path d="M1 6s2-4 5-4 5 4 5 4-2 4-5 4-5-4-5-4z" />
                <circle cx="6" cy="6" r="1.5" fill="currentColor" />
              </svg>
              active_members
            </div>
          </div>

          <div className="mockup-editor">
            <div className="editor-toolbar">
              <div className="editor-btn run">▶ Run</div>
              <div className="editor-btn ai">✦ AI Generate</div>
            </div>
            <div className="editor-area">
              <span className="sql-cmt">-- Show workspace usage for the last 30 days</span>
              <br />
              <span className="sql-kw">SELECT</span>
              <br />
              &nbsp;&nbsp;w.<span className="sql-fn">id</span>,
              <br />
              &nbsp;&nbsp;w.<span className="sql-tbl">name</span>,
              <br />
              &nbsp;&nbsp;<span className="sql-fn">COUNT</span>(qh.id) <span className="sql-kw">AS</span> query_count,
              <br />
              &nbsp;&nbsp;<span className="sql-fn">COUNT</span>(<span className="sql-kw">DISTINCT</span> wm.user_id) <span className="sql-kw">AS</span> active_members
              <br />
              <span className="sql-kw">FROM</span> <span className="sql-tbl">workspaces</span> w
              <br />
              <span className="sql-kw">LEFT JOIN</span> <span className="sql-tbl">query_history</span> qh
              <br />
              &nbsp;&nbsp;<span className="sql-kw">ON</span> qh.workspace_id = w.id
              <br />
              &nbsp;&nbsp;<span className="sql-kw">AND</span> qh.executed_at &gt; <span className="sql-fn">NOW</span>() - <span className="sql-str">INTERVAL '30 days'</span>
              <br />
              <span className="sql-kw">LEFT JOIN</span> <span className="sql-tbl">workspace_members</span> wm <span className="sql-kw">ON</span> wm.workspace_id = w.id
              <br />
              <span className="sql-kw">GROUP BY</span> w.id, w.name
              <br />
              <span className="sql-kw">ORDER BY</span> query_count <span className="sql-kw">DESC</span>;
            </div>
            <div className="results-header" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 16px', borderTop: '1px solid var(--border)', fontFamily: 'var(--mono)', fontSize: '11px' }}>
              <span className="results-badge ok">200 OK</span>
              <span style={{ color: 'var(--muted)' }}>4 rows · 12ms</span>
            </div>
            <div className="results-table">
              <div className="rt-head">
                <span>#</span>
                <span>name</span>
                <span>query_count</span>
                <span>active_members</span>
                <span>status</span>
              </div>
              {rows.map(([name, queryCount, members, status], index) => (
                <div key={name} className="rt-row">
                  <span style={{ color: 'var(--muted)' }}>{index + 1}</span>
                  <span>{name}</span>
                  <span style={{ color: 'var(--cyan)' }}>{queryCount}</span>
                  <span>{members}</span>
                  <span>
                    <span className={`badge-sm ${status === 'active' ? 'badge-active' : 'badge-trial'}`}>
                      {status}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
