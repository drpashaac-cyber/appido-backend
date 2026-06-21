# APPIDO backend — deployment

Ready-to-use configs for four paths. All build from the existing Dockerfiles
(`services/core-api/Dockerfile`, `services/workers/Dockerfile`), which compile the whole monorepo,
so the **same image runs both the API and the workers** (the workers just override the start command).

Before any path, read `../LAUNCH.md` (env vars + the build/migrate/test gate) and
`../PRODUCTION-READINESS.md` (what still needs configuring).

## The RLS note (read this once)
Tenant isolation is enforced by a dedicated Postgres role `appido_app` (NOBYPASSRLS) created by
migration `0001`. So:
1. First deploy runs `migrate` using **DATABASE_URL** (the owner role) — this creates `appido_app`.
2. Then set **APP_DATABASE_URL** = same host/db but user `appido_app` (password `appido_app`) and
   redeploy. The app uses APP_DATABASE_URL at runtime so RLS is enforced.
If APP_DATABASE_URL is unset it falls back to DATABASE_URL (RLS bypassed) — fine only for the very
first boot, never for steady state.

---

## 1) Render (recommended) — `render.yaml`
Declares Postgres + Key Value + API (web) + workers in one file.
1. Push this repo to GitHub/GitLab.
2. Render Dashboard → New → Blueprint → pick the repo (it reads `deploy/render.yaml`). Move the file
   to the repo root, or point the Blueprint at `deploy/render.yaml`.
3. Fill the prompted `sync: false` vars (LITELLM/provider keys, RESEND_API_KEY, APPIDO_PAY_SECRET,
   OWNER_EMAIL, PUBLIC_BASE_URL, CORS_ORIGINS, COOKIE_DOMAIN). `SECRETS_MASTER_KEY` is generated once
   and shared by both services via the `appido-shared` group.
4. First deploy: `preDeployCommand: npm run migrate` runs automatically. Then set `APP_DATABASE_URL`
   in the `appido-shared` group (see the RLS note) and redeploy.
5. Smoke: `BASE_URL=https://appido-api.onrender.com npm run smoke`.
Notes: Key Value uses `maxmemoryPolicy: noeviction` (BullMQ must not evict). pgvector/pgcrypto are
created by migration 0000 on managed Postgres.

## 2) Fly.io — `fly/fly.toml`
One image, two process groups (`app`, `worker`).
```bash
fly launch --copy-config --no-deploy        # or: fly apps create appido-backend
fly postgres create                          # attach; then enable pgvector (CREATE EXTENSION runs in migration)
# Redis: create an Upstash Redis (Fly extension) and note its URL
fly secrets set SECRETS_MASTER_KEY=... DATABASE_URL=... APP_DATABASE_URL=... REDIS_URL=... \
  RESEND_API_KEY=... LITELLM_BASE_URL=... LITELLM_MASTER_KEY=... ANTHROPIC_API_KEY=... \
  APPIDO_PAY_SECRET=... OWNER_EMAIL=... PUBLIC_BASE_URL=https://appido-backend.fly.dev \
  COOKIE_DOMAIN=.appido.io CORS_ORIGINS=https://www.appido.io
fly deploy                                   # release_command runs `npm run migrate` first
```
Scale workers: `fly scale count worker=2`.

## 3) Railway
No single multi-service file as rich as Render. Create a project, add **PostgreSQL** + **Redis**
plugins, then two services from this repo:
- API: Dockerfile `services/core-api/Dockerfile`; add a deploy/pre-start step `npm run migrate`.
- Workers: Dockerfile `services/workers/Dockerfile`; start command `node services/workers/dist/main.js`.
Set the same env vars as above on both. Use the plugins' injected `DATABASE_URL`/`REDIS_URL`, and add
`APP_DATABASE_URL` per the RLS note.

## 4) Kubernetes — `k8s/`
Build + push one image, then apply.
```bash
docker build -f services/core-api/Dockerfile -t ghcr.io/your-org/appido-backend:v1 .
docker push ghcr.io/your-org/appido-backend:v1
# edit the image tag in the three manifests + fill k8s/secret.example.yaml
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml -f k8s/secret.example.yaml
kubectl apply -f k8s/migrate-job.yaml      # wait for completion
kubectl apply -f k8s/core-api-deployment.yaml -f k8s/workers-deployment.yaml
kubectl apply -f k8s/ingress.yaml -f k8s/hpa.yaml
```
Postgres + Redis come from managed services or your own charts (e.g. CloudNativePG with the `vector`
extension; a Redis chart with `maxmemory-policy noeviction`). The API Deployment has readiness
(`/health/ready`) + liveness (`/health`) probes and an HPA (CPU 70%, 2→8). Workers scale via
`kubectl scale deploy/appido-workers --replicas=N`.

---

## After any deploy
- `npm run smoke` (or `BASE_URL=... node scripts/smoke.mjs`) — checks health, readiness, and that a
  protected route returns 401.
- Set the frontends' API base to the deployed URL (owner console + dashboard read `window.APPIDO_API_BASE`).
- Configure each tenant's payment gateway credentials in the dashboard and **sandbox-test** before
  going live (see PRODUCTION-READINESS.md).

---

## CI/CD (GitHub Actions)
- **`.github/workflows/ci.yml`** — every PR/push: `lint → typecheck → build → migrate → seed → test`
  on ephemeral Postgres + Redis, then `npm audit` (report-only). A green run is your launch gate.
- **`.github/workflows/deploy.yml`** — push to `main` / `v*` tags: build + push the image to **GHCR**
  with layer cache, **SBOM + provenance attestation**, and a **Trivy** HIGH/CRITICAL scan; then a
  gated `production` deploy.
- **`.github/workflows/codeql.yml`** — CodeQL static analysis (JS/TS), on push/PR + weekly.
- **`.github/dependabot.yml`** — weekly npm / GitHub Actions / Docker base-image PRs.

Configure once in GitHub:
- Repo **variable** `DEPLOY_TARGET` = `render` or `k8s`.
- **Render** path: optional deploy-hook secrets `RENDER_DEPLOY_HOOK_API` + `RENDER_DEPLOY_HOOK_WORKERS`
  (a connected Blueprint already auto-deploys on push; Render builds from the Dockerfile, not GHCR).
- **k8s** path: secret `KUBE_CONFIG` (base64 kubeconfig); the job rolls out the new image **by digest**.
  Point the k8s manifests' image at `ghcr.io/<owner>/<repo>`.
- Add required reviewers to the **`production`** Environment (Settings → Environments) for approval.

The container images are production-hardened: multi-stage build, dev-deps pruned, **non-root** (`node`)
user, `dumb-init` as PID 1 for clean signal handling, and a `/health` Docker `HEALTHCHECK`.
Recommended next: commit a `package-lock.json` and switch `npm install` → `npm ci` for reproducible builds.
