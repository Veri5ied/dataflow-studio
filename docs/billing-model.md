# Billing and Licensing Model

## Runtime model

DataFlow Studio uses a split commercial runtime:

1. Cloud Pro (`DEPLOYMENT_MODE=cloud`)
2. Self-host Community (`DEPLOYMENT_MODE=self-host`, `SELF_HOST_EDITION=community`)
3. Self-host Enterprise (`DEPLOYMENT_MODE=self-host`, `SELF_HOST_EDITION=enterprise`)

Cloud billing and self-host licensing are separate enforcement paths.

## Cloud Pro

- Billing provider: Polar only
- Trial-first onboarding (no permanent free cloud tier)
- Seat-based subscription
- AI access requires active/trialing cloud billing state
- Billing APIs and Polar webhooks are enabled only in cloud mode

Cloud env contract:

- `POLAR_ACCESS_TOKEN`
- `POLAR_ORGANIZATION_ID`
- `POLAR_WEBHOOK_SECRET`
- `POLAR_CHECKOUT_BASE_URL`
- `POLAR_PORTAL_BASE_URL`
- `TRIAL_DAYS`
- `CLOUD_TRIAL_SEAT_LIMIT`
- `CLOUD_TRIAL_AI_REQUESTS_LIMIT`
- `CLOUD_TRIAL_AI_TOKENS_LIMIT`
- `CLOUD_PRO_SEAT_PRICE_CENTS`
- `CLOUD_PRO_AI_REQUESTS_LIMIT`
- `CLOUD_PRO_AI_TOKENS_LIMIT`

## Self-host Community

- AGPL runtime
- No in-app checkout or billing portal
- No Polar webhook processing
- AI may run with user-provided model keys
- Seats are not monetized in community mode

## Self-host Enterprise

- Commercial self-host entitlement via signed license keys
- License activation/deactivation/status APIs enabled
- Seat capacity enforced by license entitlements
- AI requires active, non-expired license with `aiEnabled=true`

Enterprise self-host env contract:

- `LICENSE_VERIFICATION_SECRET`
- `LICENSE_SYNC_GRACE_HOURS`

## API mode gating summary

- Cloud mode:
  - `/api/v1/billing/*` enabled
  - `/api/v1/licenses/*` disabled
- Self-host community:
  - `/api/v1/billing/*` disabled
  - `/api/v1/licenses/*` disabled
- Self-host enterprise:
  - `/api/v1/billing/*` disabled
  - `/api/v1/licenses/*` enabled

See `docs/edition-matrix.md` for full feature matrix.
