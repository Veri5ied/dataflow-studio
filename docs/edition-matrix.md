# Edition Matrix

DataFlow Studio has three runtime offers:

- Cloud Pro (`DEPLOYMENT_MODE=cloud`)
- Self-host Community (`DEPLOYMENT_MODE=self-host`, `SELF_HOST_EDITION=community`)
- Self-host Enterprise (`DEPLOYMENT_MODE=self-host`, `SELF_HOST_EDITION=enterprise`)

## Feature split

| Capability             | Cloud Pro                              | Self-host Community                   | Self-host Enterprise                                          |
| ---------------------- | -------------------------------------- | ------------------------------------- | ------------------------------------------------------------- |
| Hosting model          | Managed by DataFlow                    | Customer-managed                      | Customer-managed                                              |
| Source license         | AGPL app runtime                       | AGPL app runtime                      | AGPL app runtime + commercial license entitlement             |
| Authentication         | OAuth (GitHub/Google)                  | OAuth (GitHub/Google)                 | OAuth (GitHub/Google)                                         |
| In-app billing         | Polar checkout + portal                | Not available                         | Not available                                                 |
| License key activation | Not available                          | Not available                         | Required for enterprise entitlements                          |
| Trial                  | Yes (cloud trial window)               | Not applicable                        | Not applicable                                                |
| Seat control           | Metered by subscription quota          | Unlimited by default                  | Enforced by license seats                                     |
| AI access              | Requires active/trialing cloud billing | BYOK provider keys                    | Requires active enterprise license and AI-enabled entitlement |
| AI metering            | Usage counters + plan quota            | Usage counters (no default quota cap) | Usage counters + enterprise entitlement checks                |
| Billing webhooks       | Polar webhook enabled                  | Disabled                              | Disabled                                                      |
| Licensing API          | Disabled                               | Disabled                              | Enabled                                                       |

## API availability by mode

| API group                       | Cloud Pro                                               | Self-host Community                                     | Self-host Enterprise                               |
| ------------------------------- | ------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------- |
| `/api/v1/billing/*`             | Enabled                                                 | Returns `404` (`billing_unavailable_in_self_host`)      | Returns `404` (`billing_unavailable_in_self_host`) |
| `/api/v1/billing/webhook/polar` | Enabled                                                 | Returns `404`                                           | Returns `404`                                      |
| `/api/v1/licenses/*`            | Returns `404` (`licensing_unavailable_in_current_mode`) | Returns `404` (`licensing_unavailable_in_current_mode`) | Enabled                                            |

## Environment contract

Core mode variables:

- `DEPLOYMENT_MODE=cloud|self-host`
- `SELF_HOST_EDITION=community|enterprise`

Cloud defaults:

- `TRIAL_DAYS`
- `CLOUD_TRIAL_SEAT_LIMIT`
- `CLOUD_TRIAL_AI_REQUESTS_LIMIT`
- `CLOUD_TRIAL_AI_TOKENS_LIMIT`
- `CLOUD_PRO_SEAT_PRICE_CENTS`
- `CLOUD_PRO_AI_REQUESTS_LIMIT`
- `CLOUD_PRO_AI_TOKENS_LIMIT`
- `POLAR_ACCESS_TOKEN`
- `POLAR_ORGANIZATION_ID`
- `POLAR_WEBHOOK_SECRET`
- `POLAR_CHECKOUT_BASE_URL`
- `POLAR_PORTAL_BASE_URL`

Enterprise self-host defaults:

- `LICENSE_VERIFICATION_SECRET`
- `LICENSE_SYNC_GRACE_HOURS`
