# Query + AI API Test Cases

## Prerequisites

- API is running
- Workspace has active external DB connection
- Valid JWT

## Environment

- `baseUrl = http://localhost:3001/api/v1`
- `token = <bearer token>`
- `workspaceId = <workspace uuid>`

## Query Engine

### 1. Execute query (success)

- Request: `POST {{baseUrl}}/workspaces/{{workspaceId}}/query`
- Body:
  ```json
  {
    "sqlText": "select now() as current_time",
    "limit": 50,
    "offset": 0
  }
  ```
- Expect:
  - `200`
  - `status = "completed"`
  - `rows[]`

### 2. Save query (success)

- Request: `POST {{baseUrl}}/workspaces/{{workspaceId}}/save-query`
- Body:
  ```json
  {
    "name": "current-time",
    "sqlText": "select now() as current_time"
  }
  ```
- Expect:
  - `201`
  - response includes `saved`

### 3. Query history (success)

- Request: `GET {{baseUrl}}/workspaces/{{workspaceId}}/history?limit=20&offset=0`
- Expect:
  - `200`
  - response includes `items[]` and `total`

### 4. Cancel running query

- Start:
  - `POST {{baseUrl}}/workspaces/{{workspaceId}}/query`
  - Body:
    ```json
    {
      "executionId": "11111111-1111-4111-8111-111111111111",
      "sqlText": "select pg_sleep(20)"
    }
    ```
- While running:
  - `POST {{baseUrl}}/workspaces/{{workspaceId}}/query/cancel`
  - Body:
    ```json
    { "executionId": "11111111-1111-4111-8111-111111111111" }
    ```
- Expect:
  - cancel route returns `canceled = true`
  - execute route eventually returns `query_canceled`

### 5. Reject multi-statement SQL

- Request body:
  ```json
  { "sqlText": "select 1; select 2;" }
  ```
- Expect:
  - `400`
  - `code = "multi_statement_not_allowed"`

## AI Guardrails

### 6. Generate SQL (success)

- Request: `POST {{baseUrl}}/ai/generate-sql`
- Body:
  ```json
  {
    "workspaceId": "{{workspaceId}}",
    "instruction": "list active users",
    "provider": "openai",
    "model": "gpt-4.1-mini"
  }
  ```
- Expect:
  - `200`
  - response includes `sql`, `usage`, and `logId`

### 7. Explain query (success)

- Request: `POST {{baseUrl}}/ai/explain-query`
- Body:
  ```json
  {
    "workspaceId": "{{workspaceId}}",
    "sqlText": "select * from users limit 10",
    "provider": "anthropic",
    "model": "claude-3-5-sonnet-latest"
  }
  ```
- Expect:
  - `200`
  - response includes `explanation`, `usage`, and `logId`

### 8. OpenAI-compatible provider (success)

- Request: `POST {{baseUrl}}/ai/generate-sql`
- Body:
  ```json
  {
    "workspaceId": "{{workspaceId}}",
    "instruction": "show top 10 customers by spend",
    "provider": "openai-compatible",
    "model": "meta-llama/llama-3.1-70b-instruct",
    "baseUrl": "https://openrouter.ai/api/v1"
  }
  ```
- Expect:
  - `200`
  - response includes `provider = "openai-compatible"`

### 9. Usage limit exceeded

- Setup:
  - set `usage_counters.limit_quantity` for `ai_requests` or `ai_tokens` to current used value
- Request: any AI endpoint
- Expect:
  - `402`
  - `code = "usage_limit_exceeded"`
