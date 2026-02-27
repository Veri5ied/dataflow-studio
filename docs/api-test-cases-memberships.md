# Membership API Test Cases

## Prerequisites

- API running at `http://localhost:3001`
- Valid JWT (use `POST /api/v1/auth/dev/session` in local development)
- Existing workspace id

## Environment

- `baseUrl = http://localhost:3001/api/v1`
- `ownerToken = <owner/admin bearer token>`
- `memberToken = <invitee bearer token>`
- `workspaceId = <workspace uuid>`

## 1. Invite member (success)

- Request: `POST {{baseUrl}}/workspaces/{{workspaceId}}/members/invite`
- Auth: `Bearer {{ownerToken}}`
- Body:
  ```json
  { "email": "member@example.com", "role": "editor", "expiresInDays": 7 }
  ```
- Expect:
  - `201`
  - response contains `invite.inviteToken`

## 2. List pending invites (success)

- Request: `GET {{baseUrl}}/workspaces/{{workspaceId}}/invites`
- Auth: `Bearer {{ownerToken}}`
- Expect:
  - `200`
  - invited email appears in `items[]`

## 3. Accept invite (success)

- Request: `POST {{baseUrl}}/workspaces/invitations/accept`
- Auth: `Bearer {{memberToken}}`
- Body:
  ```json
  { "inviteToken": "<token from invite response>" }
  ```
- Expect:
  - `201`
  - response contains `membership`
  - `inviteAccepted = true`

## 4. List members (success)

- Request: `GET {{baseUrl}}/workspaces/{{workspaceId}}/members`
- Auth: `Bearer {{ownerToken}}`
- Expect:
  - `200`
  - accepted user appears in `items[]`

## 5. Forbidden invite by viewer

- Request: `POST {{baseUrl}}/workspaces/{{workspaceId}}/members/invite`
- Auth: `Bearer {{memberToken}}` (viewer/editor role)
- Body:
  ```json
  { "email": "new-user@example.com", "role": "viewer" }
  ```
- Expect:
  - `403`
  - `code = "insufficient_workspace_role"`

## 6. Invite email mismatch on accept

- Request: `POST {{baseUrl}}/workspaces/invitations/accept`
- Auth: token for user with different email
- Body:
  ```json
  { "inviteToken": "<token>" }
  ```
- Expect:
  - `403`
  - `code = "invite_email_mismatch"`

## 7. Invite expired

- Setup: invite with short expiry (or manually update `expires_at` in DB to past)
- Request: `POST {{baseUrl}}/workspaces/invitations/accept`
- Auth: invitee token
- Expect:
  - `410`
  - `code = "invite_expired"`

## 8. Seat limit reached

- Setup:
  - ensure workspace `usage_counters` for metric `seats` has `limit_quantity = active_member_count`
  - create an invite for another user
- Request: `POST {{baseUrl}}/workspaces/invitations/accept`
- Auth: invitee token
- Expect:
  - `409`
  - `code = "workspace_seat_limit_reached"`
