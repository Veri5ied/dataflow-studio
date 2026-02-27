# Schema API Test Cases

## Prerequisites

- API is running
- Workspace exists
- Owner/admin JWT available
- External PostgreSQL credentials available

## Environment

- `baseUrl = http://localhost:3001/api/v1`
- `token = <bearer token>`
- `workspaceId = <workspace uuid>`

## 1. Test DB connection (success)

- Request: `POST {{baseUrl}}/workspaces/{{workspaceId}}/connect-db/test`
- Auth: `Bearer {{token}}`
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
- Expect:
  - `200`
  - `testResult.ok = true`

## 2. Save DB connection (success)

- Request: `POST {{baseUrl}}/workspaces/{{workspaceId}}/connect-db`
- Auth: `Bearer {{token}}`
- Body: same as test payload
- Expect:
  - `201`
  - response includes `connection`
  - response includes `testResult`

## 3. Fetch schemas (success)

- Request: `GET {{baseUrl}}/workspaces/{{workspaceId}}/schemas`
- Auth: `Bearer {{token}}`
- Expect:
  - `200`
  - response includes `schemas[]`

## 4. Fetch tables by schema (success)

- Request: `GET {{baseUrl}}/workspaces/{{workspaceId}}/tables?schema=public`
- Auth: `Bearer {{token}}`
- Expect:
  - `200`
  - response includes `tables[]`

## 5. Fetch table metadata (success)

- Request: `GET {{baseUrl}}/workspaces/{{workspaceId}}/tables/users?schema=public`
- Auth: `Bearer {{token}}`
- Expect:
  - `200`
  - response includes `table.columns[]`

## 6. Invalid credentials

- Request: `POST {{baseUrl}}/workspaces/{{workspaceId}}/connect-db/test`
- Body uses bad password
- Expect:
  - `400`
  - `code = "db_connection_test_failed"`

## 7. Viewer cannot test connection

- Request: `POST {{baseUrl}}/workspaces/{{workspaceId}}/connect-db/test`
- Auth: viewer token
- Expect:
  - `403`
  - `code = "insufficient_workspace_role"`

## 8. Table not found

- Request: `GET {{baseUrl}}/workspaces/{{workspaceId}}/tables/does_not_exist?schema=public`
- Expect:
  - `404`
  - `code = "table_not_found"`
