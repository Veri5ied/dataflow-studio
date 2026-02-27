# Setup

1. Copy `.env.example` to `.env`
2. Install dependencies: `pnpm install`
3. Run database migrations: `pnpm db:migrate`
4. Optional seed data: `pnpm db:seed`
5. Optional Drizzle migration generation: `pnpm --filter @dataflow/api db:generate`
6. Start GUI: `pnpm dev:gui`
7. Start API: `pnpm dev:api`

## Local API auth testing

1. Create a development JWT:
   - `POST http://localhost:3001/api/v1/auth/dev/session`
   - Body:
     ```json
     { "userId": "YOUR_USERS_TABLE_UUID" }
     ```
2. Use the returned `accessToken` in protected routes:
   - `Authorization: Bearer <accessToken>`

## Membership API smoke tests

1. Invite a member (owner/admin token):
   - `POST http://localhost:3001/api/v1/workspaces/{workspaceId}/members/invite`
   - Body:
     ```json
     { "email": "member@example.com", "role": "editor", "expiresInDays": 7 }
     ```
2. Accept invite (invitee token):
   - `POST http://localhost:3001/api/v1/workspaces/invitations/accept`
   - Body:
     ```json
     { "inviteToken": "TOKEN_FROM_INVITE_RESPONSE" }
     ```
3. List members:
   - `GET http://localhost:3001/api/v1/workspaces/{workspaceId}/members`
4. List pending invites (owner/admin):
   - `GET http://localhost:3001/api/v1/workspaces/{workspaceId}/invites`

## DB connection + schema metadata smoke tests

1. Test external DB credentials (no save):
   - `POST http://localhost:3001/api/v1/workspaces/{workspaceId}/connect-db/test`
   - Body:
     ```json
     {
       "host": "localhost",
       "port": 5432,
       "databaseName": "postgres",
       "username": "postgres",
       "password": "admin",
       "sslMode": "disable"
     }
     ```
2. Save workspace DB connection:
   - `POST http://localhost:3001/api/v1/workspaces/{workspaceId}/connect-db`
3. Fetch schemas:
   - `GET http://localhost:3001/api/v1/workspaces/{workspaceId}/schemas`
4. Fetch tables for schema:
   - `GET http://localhost:3001/api/v1/workspaces/{workspaceId}/tables?schema=public`
5. Fetch table metadata:
   - `GET http://localhost:3001/api/v1/workspaces/{workspaceId}/tables/users?schema=public`

## Query engine smoke tests

1. Execute query:
   - `POST http://localhost:3001/api/v1/workspaces/{workspaceId}/query`
   - Body:
     ```json
     {
       "sqlText": "select now() as current_time",
       "limit": 50,
       "offset": 0
     }
     ```
2. Save query:
   - `POST http://localhost:3001/api/v1/workspaces/{workspaceId}/save-query`
3. Query history:
   - `GET http://localhost:3001/api/v1/workspaces/{workspaceId}/history?limit=20&offset=0`
4. Cancel long-running query:
   - start query with explicit `executionId` and SQL such as `select pg_sleep(20)`
   - call `POST http://localhost:3001/api/v1/workspaces/{workspaceId}/query/cancel`
   - Body:
     ```json
     { "executionId": "SAME_EXECUTION_ID_UUID" }
     ```

## AI guardrail smoke tests

1. Generate SQL:
   - `POST http://localhost:3001/api/v1/ai/generate-sql`
   - Body:
     ```json
     {
       "workspaceId": "{workspaceId}",
       "instruction": "show all users created in the last 7 days",
       "provider": "openai",
       "model": "gpt-4.1-mini"
     }
     ```
2. Explain query:
   - `POST http://localhost:3001/api/v1/ai/explain-query`
   - Body:
     ```json
     {
       "workspaceId": "{workspaceId}",
       "sqlText": "select * from users limit 10",
       "provider": "anthropic",
       "model": "claude-3-5-sonnet-latest"
     }
     ```
3. OpenAI-compatible provider (OpenRouter, local gateway, etc):
   - `POST http://localhost:3001/api/v1/ai/generate-sql`
   - Body:
     ```json
     {
       "workspaceId": "{workspaceId}",
       "instruction": "top 5 slow queries from query_history",
       "provider": "openai-compatible",
       "model": "meta-llama/llama-3.1-70b-instruct",
       "baseUrl": "https://openrouter.ai/api/v1"
     }
     ```
4. Validate local automated tests:
   - `pnpm --filter @dataflow/api test`

Migration policy is documented in `docs/migration-strategy.md`.

Docker scaffold files are in `tooling/docker`.
