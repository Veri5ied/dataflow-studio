# Billing Model

## Commercial strategy

DataFlow Studio uses one billing engine with two commercial offers.

Supported billing providers:

- Stripe
- Polar (polar.sh)

Required provider env vars:

- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- Polar: `POLAR_ACCESS_TOKEN`, `POLAR_ORGANIZATION_ID`, `POLAR_WEBHOOK_SECRET`

1. Cloud Pro (self-serve)
2. Enterprise (sales-led)

There is no permanent free cloud tier. New cloud workspaces receive a time-limited trial.

## Offer definitions

### Cloud Pro

- 14-day trial on workspace creation
- Paid subscription required after trial expires
- Seat-based pricing
- AI usage is metered and quota-enforced

### Enterprise

- Annual contract
- Higher seat commitments and invoicing support
- Advanced controls (SSO, audit, enterprise RBAC, support SLA)
- Optional paid self-host license for enterprise package

## Seat model

- A seat is an active, accepted workspace member.
- Pending invitations do not consume seats.
- Seat checks run when invitations are accepted or members are added.
- Owners/admins can view seat usage and limits.

## AI billing policy

- AI is not unlimited on default paid plans.
- AI usage is tracked per workspace.
- Each plan includes usage quotas/credits.
- Overages can be blocked or billed via add-on credits.

## Workspace and billing ownership

- First authenticated user creates the workspace and becomes owner.
- Workspace owner is linked to the billing account.
- Owner/admin can manage seats and billing settings.

## Self-host and licensing note

- Self-hosted deployments can run without cloud billing integration.
- Paid self-host requires enterprise licensing controls outside pure MIT scope.
- Keep OSS core clear and isolate enterprise-only capabilities where required.

## Initial implementation scope

1. Trial state + expiration timestamps
2. Workspace subscription state
3. Seat counting and enforcement hooks
4. AI usage counters and quota checks
5. Billing provider adapter and webhook processing
