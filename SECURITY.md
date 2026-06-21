# Security policy

## Reporting a vulnerability
Email **security@appido.io** with details and reproduction steps. Please do not open public issues
for security reports. We aim to acknowledge within 3 business days and to keep you updated through
remediation. Coordinated disclosure is appreciated.

## Handling of secrets
- Tenant gateway keys and Telegram bot tokens are stored with envelope encryption (AES-GCM) and are
  never logged (Pino redaction). `SECRETS_MASTER_KEY` must be >= 32 bytes and identical across the
  API and workers. Prefer sourcing it from a managed secret store; key rotation is supported via
  `SECRETS_MASTER_KEYS` + `POST /v1/owner/secrets/rotate`.
- Tenant isolation is enforced by PostgreSQL Row-Level Security under the `appido_app` (NOBYPASSRLS)
  role — set `APP_DATABASE_URL` to that role in every environment.

## Supply chain
- CI runs `npm audit` (report-only by default — raise to blocking before public launch).
- Release images are built with provenance + SBOM and scanned with Trivy (HIGH/CRITICAL).
- Dependabot keeps npm, GitHub Actions, and Docker base images updated.
- Recommended: commit a `package-lock.json` and switch `npm install` → `npm ci` in CI and Docker for
  fully reproducible builds.
