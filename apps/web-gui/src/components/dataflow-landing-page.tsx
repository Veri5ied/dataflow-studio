import { PlaygroundSection } from "./landing/playground-section";
import { StudioMockup } from "./landing/studio-mockup";

const featureTags = [
  ["✓ PostgreSQL", "var(--green)", "var(--green-dim)", "rgba(52,211,153,.2)"],
  ["✓ MySQL", "var(--blue)", "var(--blue-dim)", "rgba(79,142,247,.2)"],
  ["✓ SQLite", "var(--cyan)", "var(--cyan-dim)", "rgba(0,212,255,.2)"],
  ["✓ SQL Server", "var(--amber)", "var(--amber-dim)", "rgba(251,191,36,.2)"],
] as const;

const bottomFeatureCards = [
  {
    color: "var(--cyan)",
    background: "var(--cyan-dim)",
    border: "rgba(0,212,255,.2)",
    title: "Schema explorer",
    description:
      "Browse tables, columns, indexes, and relationships. Click any table to inspect structure and sample rows.",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--cyan)"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 21V9" />
      </svg>
    ),
  },
  {
    color: "var(--green)",
    background: "var(--green-dim)",
    border: "rgba(52,211,153,.2)",
    title: "Workspace collaboration",
    description:
      "Invite teammates, share saved queries, and control access with role-based membership and seat limits.",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--green)"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    color: "var(--amber)",
    background: "var(--amber-dim)",
    border: "rgba(251,191,36,.2)",
    title: "Query history & saves",
    description:
      "Every query is logged. Save the good ones, share them with the team, or replay with one click.",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--amber)"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
  },
  {
    color: "var(--violet)",
    background: "var(--violet-dim)",
    border: "rgba(167,139,250,.2)",
    title: "Docker-first self-host",
    description:
      "One compose up and you're running. Dockerfile, docker-compose, and k8s scaffolding included.",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--violet)"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
];

const steps = [
  {
    title: "Deploy or sign up",
    description:
      "Self-host with Docker in one command, or use the cloud version with a free trial. OAuth via GitHub or Google.",
  },
  {
    title: "Create a workspace",
    description:
      "Workspaces are the unit of collaboration. Create one, invite your team, and connect your database credentials.",
  },
  {
    title: "Connect your database",
    description:
      "Test the connection, browse schemas, and start querying. Supports PostgreSQL, MySQL, SQLite, and SQL Server.",
  },
  {
    title: "Query with AI",
    description:
      "Use natural language to generate SQL, get explanations, catch risky patterns, and save queries for the whole team.",
  },
];

const environmentRows = [
  ["DEPLOYMENT_MODE", "cloud or self-host", "required"],
  ["APP_DATABASE_URL", "PostgreSQL connection string", "required"],
  ["OAUTH_GITHUB_CLIENT_ID", "GitHub OAuth App client ID", "required"],
  ["OAUTH_GOOGLE_CLIENT_ID", "Google OAuth client ID", "required"],
  ["JWT_SECRET", "Secret for JWT signing", "required"],
  ["REDIS_URL", "Redis connection URL", "required"],
  ["OPENAI_API_KEY", "For AI SQL generation (BYOK)", "optional"],
  ["ANTHROPIC_API_KEY", "Anthropic Claude provider", "optional"],
] as const;

export function DataflowLandingPage() {
  return (
    <main>
      <div className="hero">
        <div className="glow-hero" />
        <div className="fade-up">
          <div className="hero-badge">
            Open source · Self-hostable · AI-powered
          </div>
        </div>
        <div className="fade-up">
          <h1>
            The database studio
            <br />
            your team <span className="hl">actually wants</span>
          </h1>
        </div>
        <div className="fade-up">
          <p className="hero-sub">
            Query, explore, and manage any relational database together, with AI
            SQL generation, schema exploration, and real-time collaboration
            baked in. No SaaS lock-in.
          </p>
        </div>
        <div className="fade-up">
          <div className="hero-ctas">
            <a href="/#playground" className="btn btn-primary">
              Try the API playground
            </a>
            <a
              href="https://github.com/Veri5ied/dataflow-studio"
              className="btn btn-ghost"
              target="_blank"
              rel="noreferrer"
            >
              Self-host in 5 min
            </a>
          </div>
          <div className="hero-meta">
            <span>⬡ PostgreSQL</span>
            <span>⬡ MySQL</span>
            <span>⬡ SQLite</span>
            <span>⬡ SQL Server</span>
            <span>⬡ OpenAI · Anthropic · Gemini</span>
          </div>
        </div>

        <StudioMockup />
      </div>

      <hr className="section-divider" />

      <section id="features">
        <div className="glow-section" />
        <div
          className="features-intro-grid"
          style={{
            gridTemplateColumns: "1fr 1fr",
            gap: "48px",
            alignItems: "start",
            marginBottom: "64px",
          }}
        >
          <div>
            <div className="section-eyebrow">Features</div>
            <h2 className="section-title">
              Everything your team needs.
              <br />
              Nothing it doesn\'t.
            </h2>
          </div>
          <div style={{ paddingTop: "8px" }}>
            <p
              style={{
                fontSize: "15px",
                color: "var(--sub)",
                lineHeight: 1.75,
                fontWeight: 300,
              }}
            >
              Built for engineers who want speed, AI assistance, and real
              collaboration — without giving up control over their data or
              infrastructure.
            </p>
            <div
              style={{
                display: "flex",
                gap: "10px",
                marginTop: "20px",
                flexWrap: "wrap",
              }}
            >
              {featureTags.map(([label, color, background, border]) => (
                <span
                  key={label}
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: "11px",
                    color,
                    background,
                    padding: "4px 12px",
                    borderRadius: "20px",
                    border: `1px solid ${border}`,
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div
          className="feature-hero-grid"
          style={{
            gridTemplateColumns: "1fr 1fr",
            gap: "16px",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              background:
                "linear-gradient(135deg,rgba(79,142,247,.08) 0%,var(--card) 60%)",
              border: "1px solid rgba(79,142,247,.25)",
              borderRadius: "16px",
              padding: "36px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "-30px",
                right: "-30px",
                width: "160px",
                height: "160px",
                background:
                  "radial-gradient(circle,rgba(79,142,247,.12),transparent 70%)",
                pointerEvents: "none",
                zIndex: 0,
              }}
            />
            <div style={{ position: "relative", zIndex: 1 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  marginBottom: "20px",
                }}
              >
                <div
                  style={{
                    width: "46px",
                    height: "46px",
                    borderRadius: "12px",
                    background: "var(--blue-dim)",
                    border: "1px solid rgba(79,142,247,.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--blue)"
                    strokeWidth="1.8"
                    aria-hidden="true"
                  >
                    <ellipse cx="12" cy="5" rx="9" ry="3" />
                    <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
                    <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
                  </svg>
                </div>
                <div>
                  <div
                    style={{
                      fontFamily: "var(--serif)",
                      fontSize: "18px",
                      fontWeight: 700,
                      color: "var(--text)",
                      marginBottom: "2px",
                    }}
                  >
                    Multi-engine support
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: "10px",
                      color: "var(--blue)",
                      letterSpacing: ".06em",
                    }}
                  >
                    pg · mysql · sqlite · mssql
                  </div>
                </div>
              </div>
              <p
                style={{
                  fontSize: "14px",
                  color: "var(--sub)",
                  lineHeight: 1.7,
                  marginBottom: "20px",
                }}
              >
                Connect to PostgreSQL, MySQL, SQLite, and SQL Server from a
                single workspace. Switch between databases without changing your
                workflow or learning new tooling.
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "8px",
                }}
              >
                {[
                  ["PostgreSQL", "16.x · all schemas"],
                  ["MySQL", "8.x · InnoDB"],
                  ["SQLite", "file or :memory:"],
                  ["SQL Server", "2019+ · Azure"],
                ].map(([title, value]) => (
                  <div
                    key={title}
                    style={{
                      background: "rgba(79,142,247,.06)",
                      border: "1px solid rgba(79,142,247,.12)",
                      borderRadius: "8px",
                      padding: "10px 12px",
                      fontFamily: "var(--mono)",
                      fontSize: "11px",
                      color: "var(--sub)",
                    }}
                  >
                    <div
                      style={{
                        color: "var(--blue)",
                        fontWeight: 700,
                        marginBottom: "2px",
                      }}
                    >
                      {title}
                    </div>
                    {value}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div
            style={{
              background:
                "linear-gradient(135deg,rgba(167,139,250,.08) 0%,var(--card) 60%)",
              border: "1px solid rgba(167,139,250,.25)",
              borderRadius: "16px",
              padding: "36px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "-30px",
                right: "-30px",
                width: "160px",
                height: "160px",
                background:
                  "radial-gradient(circle,rgba(167,139,250,.1),transparent 70%)",
                pointerEvents: "none",
                zIndex: 0,
              }}
            />
            <div style={{ position: "relative", zIndex: 1 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  marginBottom: "20px",
                }}
              >
                <div
                  style={{
                    width: "46px",
                    height: "46px",
                    borderRadius: "12px",
                    background: "var(--violet-dim)",
                    border: "1px solid rgba(167,139,250,.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--violet)"
                    strokeWidth="1.8"
                    aria-hidden="true"
                  >
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </div>
                <div>
                  <div
                    style={{
                      fontFamily: "var(--serif)",
                      fontSize: "18px",
                      fontWeight: 700,
                      color: "var(--text)",
                      marginBottom: "2px",
                    }}
                  >
                    AI SQL generation
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: "10px",
                      color: "var(--violet)",
                      letterSpacing: ".06em",
                    }}
                  >
                    OpenAI · Anthropic · Gemini · BYOK
                  </div>
                </div>
              </div>
              <p
                style={{
                  fontSize: "14px",
                  color: "var(--sub)",
                  lineHeight: 1.7,
                  marginBottom: "20px",
                }}
              >
                Describe what you want in plain English. DataFlow generates the
                SQL against your actual schema, explains it line by line, and
                flags potential risks before you run.
              </p>
              <div
                style={{
                  background: "rgba(0,0,0,.3)",
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                  padding: "14px",
                  fontFamily: "var(--mono)",
                  fontSize: "11.5px",
                }}
              >
                <div
                  style={{
                    color: "var(--muted)",
                    marginBottom: "8px",
                    fontSize: "10px",
                    letterSpacing: ".08em",
                    textTransform: "uppercase",
                  }}
                >
                  Prompt
                </div>
                <div
                  style={{
                    color: "var(--violet)",
                    marginBottom: "12px",
                    fontStyle: "italic",
                  }}
                >
                  &quot;Top 5 users by spend this month&quot;
                </div>
                <div
                  style={{
                    color: "var(--muted)",
                    marginBottom: "6px",
                    fontSize: "10px",
                    letterSpacing: ".08em",
                    textTransform: "uppercase",
                  }}
                >
                  Generated SQL
                </div>
                <div style={{ color: "var(--sub)", lineHeight: 1.7 }}>
                  <span style={{ color: "#7EC8E3" }}>SELECT</span> u.name,{" "}
                  <span style={{ color: "var(--cyan)" }}>SUM</span>(o.total)
                  <br />
                  <span style={{ color: "#7EC8E3" }}>FROM</span>{" "}
                  <span style={{ color: "var(--amber)" }}>users</span> u{" "}
                  <span style={{ color: "#7EC8E3" }}>JOIN</span>{" "}
                  <span style={{ color: "var(--amber)" }}>orders</span> o…
                  <br />
                  <span style={{ color: "#7EC8E3" }}>ORDER BY</span> total{" "}
                  <span style={{ color: "#7EC8E3" }}>DESC LIMIT</span> 5
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          className="feature-bottom-grid"
          style={{ gridTemplateColumns: "repeat(4,1fr)", gap: "16px" }}
        >
          {bottomFeatureCards.map((card) => (
            <div
              key={card.title}
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderTop: `2px solid ${card.color}`,
                borderRadius: "14px",
                padding: "24px",
                transition: "border-color .2s,transform .2s",
              }}
            >
              <div
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "10px",
                  background: card.background,
                  border: `1px solid ${card.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "16px",
                }}
              >
                {card.icon}
              </div>
              <div
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: "15px",
                  fontWeight: 700,
                  color: "var(--text)",
                  marginBottom: "8px",
                }}
              >
                {card.title}
              </div>
              <div
                style={{
                  fontSize: "12.5px",
                  color: "var(--sub)",
                  lineHeight: 1.65,
                }}
              >
                {card.description}
              </div>
            </div>
          ))}
        </div>
      </section>

      <hr className="section-divider" />

      <section id="how-it-works">
        <div className="section-eyebrow">How it works</div>
        <h2 className="section-title">From zero to querying in minutes.</h2>
        <div className="steps">
          {steps.map((step, index) => (
            <div key={step.title} className="step">
              <div className="step-num">
                {String(index + 1).padStart(2, "0")}
              </div>
              <div className="step-title">{step.title}</div>
              <div className="step-desc">{step.description}</div>
            </div>
          ))}
        </div>
      </section>

      <hr className="section-divider" />

      <section id="editions">
        <div className="section-eyebrow">Editions</div>
        <h2 className="section-title">One codebase, three ways to run it.</h2>
        <p className="section-sub">
          Community is free and open forever. Enterprise adds entitlements.
          Cloud is managed for teams who don\'t want to ops.
        </p>
        <div className="editions-grid">
          <div className="edition-card">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div className="edition-name">Community</div>
              <span className="fbadge fbadge-agpl">AGPL-3.0</span>
            </div>
            <div className="edition-price">
              Free<span> · self-host</span>
            </div>
            <div className="edition-desc">
              Full-featured for individuals and teams who self-host. AGPL
              license. Bring your own AI keys.
            </div>
            <div className="edition-feat">
              <span className="ef-icon ef-yes">✓</span> Multi-engine DB
              connections
            </div>
            <div className="edition-feat">
              <span className="ef-icon ef-yes">✓</span> Schema explorer + query
              editor
            </div>
            <div className="edition-feat">
              <span className="ef-icon ef-yes">✓</span> AI SQL (BYOK — your API
              keys)
            </div>
            <div className="edition-feat">
              <span className="ef-icon ef-yes">✓</span> Workspace collaboration
            </div>
            <div className="edition-feat">
              <span className="ef-icon ef-no">✕</span> License entitlements
            </div>
            <div className="edition-feat">
              <span className="ef-icon ef-no">✕</span> Priority support
            </div>
            <a
              href="https://github.com/Veri5ied/dataflow-studio"
              className="edition-cta outline"
              target="_blank"
              rel="noreferrer"
            >
              Get started free →
            </a>
          </div>

          <div className="edition-card featured">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div className="edition-name">Enterprise</div>
              <span
                style={{
                  background: "var(--blue-dim)",
                  color: "var(--blue)",
                  fontFamily: "var(--mono)",
                  fontSize: "10px",
                  padding: "3px 9px",
                  borderRadius: "4px",
                  fontWeight: 700,
                }}
              >
                RECOMMENDED
              </span>
            </div>
            <div className="edition-price">
              Custom<span> · self-host</span>
            </div>
            <div className="edition-desc">
              License key entitlements for teams that need SLAs, AI usage
              controls, and commercial support.
            </div>
            <div className="edition-feat">
              <span className="ef-icon ef-yes">✓</span> Everything in Community
            </div>
            <div className="edition-feat">
              <span className="ef-icon ef-yes">✓</span> Signed license key
              activation
            </div>
            <div className="edition-feat">
              <span className="ef-icon ef-yes">✓</span> AI entitlement gating
            </div>
            <div className="edition-feat">
              <span className="ef-icon ef-yes">✓</span> Seat + usage enforcement
            </div>
            <div className="edition-feat">
              <span className="ef-icon ef-yes">✓</span> Commercial license
            </div>
            <div className="edition-feat">
              <span className="ef-icon ef-yes">✓</span> Priority support
            </div>
            <a href="#" className="edition-cta solid">
              Contact us →
            </a>
          </div>

          <div className="edition-card">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div className="edition-name">Cloud</div>
              <span
                style={{
                  background: "var(--green-dim)",
                  color: "var(--green)",
                  fontFamily: "var(--mono)",
                  fontSize: "10px",
                  padding: "3px 9px",
                  borderRadius: "4px",
                  fontWeight: 700,
                }}
              >
                TRIAL FIRST
              </span>
            </div>
            <div className="edition-price">
              $5<span> · per seat/mo</span>
            </div>
            <div className="edition-desc">
              Managed cloud with Polar billing. Trial-first, no permanent free
              tier. AI access included with active subscription.
            </div>
            <div className="edition-feat">
              <span className="ef-icon ef-yes">✓</span> Fully managed hosting
            </div>
            <div className="edition-feat">
              <span className="ef-icon ef-yes">✓</span> AI included (no BYOK
              needed)
            </div>
            <div className="edition-feat">
              <span className="ef-icon ef-yes">✓</span> Polar subscription
              billing
            </div>
            <div className="edition-feat">
              <span className="ef-icon ef-yes">✓</span> Per-seat pricing
            </div>
            <div className="edition-feat">
              <span className="ef-icon ef-no">✕</span> No permanent free plan
            </div>
            <div className="edition-feat">
              <span className="ef-icon ef-no">✕</span> Not self-hosted
            </div>
            <a href="#" className="edition-cta outline">
              Start trial →
            </a>
          </div>
        </div>
      </section>

      <hr className="section-divider" />

      <section id="setup">
        <div className="section-eyebrow">Quick start</div>
        <h2 className="section-title">Running in five commands.</h2>
        <div className="setup-layout">
          <div>
            <div className="code-block">
              <div className="code-header">
                <div className="code-dots">
                  <div className="code-dot" style={{ background: "#ff5f57" }} />
                  <div className="code-dot" style={{ background: "#febc2e" }} />
                  <div className="code-dot" style={{ background: "#28c840" }} />
                </div>
                <span className="code-label">terminal</span>
              </div>
              <pre>{`# Clone the repo

git clone https://github.com/Veri5ied/dataflow-studio
cd dataflow-studio

# Copy env and install
cp .env.example .env
pnpm install

# Run migrations + seed
pnpm db:migrate
pnpm db:seed

# Start GUI + API in parallel
pnpm dev:web-gui
pnpm dev:api`}</pre>
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: "var(--text)",
                marginBottom: "16px",
                fontFamily: "var(--serif)",
              }}
            >
              Required environment variables
            </div>
            <div className="env-table">
              {environmentRows.map(([key, value, requirement]) => (
                <div key={key} className="env-row">
                  <div>
                    <div className="env-key">{key}</div>
                    <div className="env-val">{value}</div>
                  </div>
                  <span
                    className={
                      requirement === "required" ? "badge-req" : "badge-opt"
                    }
                  >
                    {requirement}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <hr className="section-divider" />

      <PlaygroundSection />
    </main>
  );
}
