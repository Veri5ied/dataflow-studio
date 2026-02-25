# Security Policy

## Supported versions

This project is currently in active scaffold and MVP development. Security fixes are applied to the latest default branch.

## Reporting a vulnerability

Do not open public issues for security vulnerabilities.

Share a private report with:

- Affected component(s)
- Reproduction steps
- Impact assessment
- Suggested remediation (if known)

Maintainers will acknowledge reports and provide remediation timeline updates.

## Security baseline

- OAuth secrets must be managed through environment variables.
- Workspace DB credentials must be encrypted at rest.
- JWT secrets must be strong and rotated as needed.
- AI/API routes should be rate-limited.
