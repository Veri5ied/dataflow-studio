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

Migration policy is documented in `docs/migration-strategy.md`.

Docker scaffold files are in `tooling/docker`.
