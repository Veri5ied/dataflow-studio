# System Design Flow

This document is a visual map of how DataFlow Studio works today, with focus on API-first delivery and runtime commercial modes.

## 1) Platform architecture

```mermaid
flowchart LR
  U["User Browser"] --> WG["Web GUI (TanStack Start)"]
  WG --> API["API (Hono) /api/v1"]
  API --> APPDB["App PostgreSQL (metadata)"]
  API --> REDIS["Redis (cache rate-limit session)"]
  API --> EXTDB["External relational DBs"]
  API --> AI["LLM Providers via ai-engine"]

  subgraph MONO["Nx Monorepo"]
    WG
    API
    P1["packages/ui"]
    P2["packages/db-connectors"]
    P3["packages/ai-engine"]
    P4["packages/shared-types"]
    P5["packages/config"]
    P6["packages/utils"]
  end

  WG -. uses .-> P1
  API -. uses .-> P2
  API -. uses .-> P3
  WG -. uses .-> P4
  API -. uses .-> P4
  API -. uses .-> P5
  API -. uses .-> P6
```

## 2) Runtime mode gate

```mermaid
flowchart TD
  A["Request arrives at API"] --> B{"DEPLOYMENT_MODE"}
  B -->|cloud| C["Cloud runtime"]
  B -->|self-host| D{"SELF_HOST_EDITION"}

  C --> C1["Billing routes enabled"]
  C --> C2["License routes disabled"]
  C --> C3["AI requires active/trialing cloud billing"]

  D -->|community| E["Self-host Community"]
  E --> E1["Billing routes disabled"]
  E --> E2["License routes disabled"]
  E --> E3["AI via BYOK keys, no paid cloud billing checks"]

  D -->|enterprise| F["Self-host Enterprise"]
  F --> F1["Billing routes disabled"]
  F --> F2["License routes enabled"]
  F --> F3["AI requires active license and AI entitlement"]
```

## 3) OAuth sign-in flow

```mermaid
sequenceDiagram
  autonumber
  participant Browser
  participant Web as Web GUI
  participant API as Auth API
  participant Provider as OAuth Provider
  participant DB as App DB

  Browser->>Web: Click "Continue with GitHub/Google"
  Web->>API: GET /api/v1/auth/oauth/:provider
  API-->>Browser: Redirect to provider authorize URL
  Browser->>Provider: Authorize app
  Provider-->>API: Callback with code + state
  API->>Provider: Exchange code for token
  API->>Provider: Fetch user profile
  API->>DB: Upsert OAuth user
  API-->>Browser: Return JWT session payload
  Browser->>API: Use Bearer token on protected routes
```

## 4) Query execution flow

```mermaid
sequenceDiagram
  autonumber
  participant Web as Web GUI
  participant API as Query API
  participant DB as App DB
  participant Conn as DB Connector
  participant Ext as External DB

  Web->>API: POST /workspaces/:id/query (sqlText, limit, offset)
  API->>DB: Verify membership + workspace connection metadata
  API->>Conn: Build connector by databaseEngine
  Conn->>Ext: Execute SQL (with timeout/pagination guards)
  Ext-->>Conn: Rows + columns + command + rowCount
  Conn-->>API: Query result
  API->>DB: Insert query_history record
  API-->>Web: Return execution result
```

## 5) AI generation/explain flow

```mermaid
sequenceDiagram
  autonumber
  participant Web as Web GUI
  participant API as AI API
  participant DB as App DB
  participant Guard as Commercial and usage guardrails
  participant Engine as AI Engine
  participant LLM as Model Provider

  Web->>API: POST /ai/generate-sql or /ai/explain-query
  API->>DB: Verify workspace membership
  API->>Guard: Check runtime entitlement (cloud billing or enterprise license)
  API->>Guard: Check ai_requests + ai_tokens quota
  API->>Engine: Build model config from provider/model/env
  Engine->>LLM: Send prompt
  LLM-->>Engine: Response + usage
  Engine-->>API: SQL/explanation + token usage
  API->>DB: Persist ai_logs + increment usage counters
  API-->>Web: Return generated SQL/explanation
```

## 6) Billing and licensing flows

```mermaid
sequenceDiagram
  autonumber
  participant Cloud as Cloud Admin
  participant API as Billing API
  participant Polar as Polar
  participant DB as App DB

  Cloud->>API: POST /billing/checkout-session
  API->>DB: Upsert billing account + subscription + usage limits
  API-->>Cloud: Checkout URL
  Polar-->>API: POST /billing/webhook/polar
  API->>DB: Verify signature, idempotency, sync subscription state
```

```mermaid
sequenceDiagram
  autonumber
  participant Ent as Enterprise Admin
  participant API as License API
  participant DB as App DB

  Ent->>API: POST /licenses/activate (licenseKey, fingerprint)
  API->>API: Verify signature and claims
  API->>DB: Upsert enterprise_licenses + license_activations + audit events
  API-->>Ent: Active entitlements (seats, aiEnabled, expiry)
```
