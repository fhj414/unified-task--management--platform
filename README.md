# Enterprise Hub

Enterprise Hub is a first-phase monorepo foundation for a unified team task
workspace. It contains a Vue 3 preview UI, a NestJS API, shared TypeScript
contracts, Prisma data models, and a local PostgreSQL/Redis development stack.

This phase provides an operational foundation plus a local-only mock JWT
authentication flow. It is not a task-management product yet.

## Prerequisites

- Node.js 22 or later
- pnpm 8.3.1 or later (the repository is pinned to pnpm 8)
- Docker Desktop with Docker Compose v2

Verify the local toolchain before installing:

```bash
node --version
pnpm --version
docker compose version
```

## Repository layout

```text
.
├── apps/
│   ├── api/                 # NestJS API and Prisma schema/migrations
│   └── web/                 # Vue 3 + Vite preview application
├── packages/
│   └── shared/              # Cross-application TypeScript contracts
├── docker-compose.yml       # Local PostgreSQL and Redis services
├── .env.example             # Safe local-development environment template
├── pnpm-workspace.yaml
└── package.json             # Workspace commands
```

The API is split into `common`, `auth`, `users`, `departments`, `tasks`,
`integrations`, and `sync` module areas. The health module and the local mock
authentication module expose HTTP endpoints in this phase.

## First-time setup

From the repository root:

```bash
pnpm install
cp .env.example .env
docker compose up -d --wait --wait-timeout 60
docker compose ps
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed
```

The default `.env` values point at the Compose services on localhost. Do not
commit `.env`; adjust it locally only when your ports or credentials differ.
`JWT_SECRET` must be a local-development value of at least 24 characters, and
`JWT_EXPIRES_IN` accepts a supported duration from `1m` through `24h`
(inclusive; the default and example use `1h`). Neither value is a production
credential.

### Local infrastructure

```bash
# Start or update PostgreSQL and Redis
docker compose up -d --wait --wait-timeout 60

# Inspect their health
docker compose ps

# Stop services but retain data volumes
docker compose stop

# Stop and remove only this project's services and volumes
docker compose down -v
```

The checked-in Compose configuration publishes PostgreSQL on `5432` and Redis
on `6379`, bound to `127.0.0.1` for local access only. If either port is already
occupied, stop the conflicting local service or alter the local Compose
configuration and matching `.env` values.

## Database commands

```bash
# Regenerate Prisma Client after schema changes
pnpm prisma:generate

# Apply checked-in migrations in local development
pnpm prisma:migrate

# Upsert the local mock users after migrations (safe to run repeatedly)
pnpm prisma:seed

# Open Prisma Studio
pnpm prisma:studio
```

The initial migration creates `Department`, `User`, and `Task` plus the task
status enum and indexes. Migration files are checked in; Prisma Client and
local database volumes are not.

## Run the applications

Start both applications together:

```bash
pnpm dev
```

Or run them in separate terminals:

```bash
pnpm dev:api
pnpm dev:web
```

Once started, use:

- Web preview: <http://localhost:5173>
- API health: <http://localhost:3000/health>
- Swagger UI: <http://localhost:3000/docs>

The Vite development server proxies `/health` and `/auth` to the API. Start
the API before expecting the connection card or mock-account chooser to work.

On first load, choose one of the seeded demo accounts to open the preview.
The app stores the access token only in browser session storage, restores it by
calling `GET /auth/me` after a refresh, and returns to the chooser when you
sign out.

## Validate, build, and test

```bash
# Type-check every workspace package
pnpm typecheck

# Build shared package, API, and web app
pnpm build

# Run unit tests across all packages
pnpm test

# Run the API endpoint test suite
pnpm test:e2e
```

For a complete local verification run, use two terminals in this order.
The API must be running before the endpoint requests in the final block.

**Terminal B — prepare the local stack and database:**

```bash
docker compose up -d --wait --wait-timeout 60
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed
```

**Terminal A — start the API and keep this command running:**

```bash
pnpm dev:api
```

**Terminal B — run the checks while Terminal A is still running:**

```bash
pnpm typecheck && pnpm build && pnpm test && pnpm test:e2e
curl --fail --silent http://localhost:3000/health
curl --fail --silent http://localhost:3000/docs
```

## API contract and operational checks

| Endpoint | Access | Purpose |
| --- | --- | --- |
| `GET /health` | Public | Reports API, PostgreSQL, and Redis health. |
| `GET /auth/mock-users` | Public | Lists seeded local mock users with department summaries. |
| `POST /auth/mock-login` | Public | Accepts `{ "email": "..." }` and returns an access token with the selected user. |
| `GET /auth/me` | Bearer JWT | Returns the current user for a valid access token. |

When PostgreSQL and Redis are available, `GET /health` returns HTTP 200 with
`status: "up"` and each `services` component set to `"up"`. If either
dependency is unavailable, it returns HTTP 503 with the unavailable component
marked `"down"`; connection details are intentionally not sent to clients.

Mock login looks up only the seeded local users. A missing, invalid, expired,
or unknown-user token receives the existing standardized 401 response.

Swagger documents these endpoints at `/docs`. Application startup also enables
global request validation, exception formatting, environment validation,
request logging, and CORS using `CORS_ORIGIN`.

To exercise the Redis degraded path in local development:

```bash
docker compose stop redis
curl --silent --show-error --output /tmp/enterprise-hub-health.json \
  --write-out '%{http_code}\n' http://localhost:3000/health
cat /tmp/enterprise-hub-health.json
docker compose start redis
until curl --fail --silent http://localhost:3000/health; do
  sleep 1
done
```

The first request should report HTTP `503`, `database: "up"`, and
`redis: "down"`; after Redis is restarted, the final loop retries until the
health endpoint returns HTTP `200`.

## Troubleshooting

- **Port already in use:** Ports `5432`, `6379`, `3000`, or `5173` are already
  occupied. Stop the relevant local process/service or choose alternate local
  ports and update `.env` where needed.
- **Prisma cannot connect:** Run `docker compose ps`, confirm PostgreSQL is
  healthy, then check that `DATABASE_URL` in `.env` matches the active local
  service.
- **Health reports Redis down:** Confirm `docker compose ps`, restart Redis
  with `docker compose start redis`, and retry `GET /health`.
- **Web says service details are unavailable:** Start the API on port `3000`;
  the web development server forwards `/health` there.
- **Node version warning or install failure:** Switch to Node 22+ and rerun
  `pnpm install` with pnpm 8.

## Current scope and mock-auth boundary

This phase contains the project skeleton, shared health contract, local
infrastructure, Prisma data model, a health check, and a preview UI with
local-only mock JWT authentication. The `auth` module provides seeded-user
selection, a short-lived local JWT, and current-user lookup for development.
It does not provide real DingTalk login, passwords, registration, refresh
tokens, production credentials, or a production account system. There is no
task, user, department, integration, or synchronization CRUD yet.

No SaaS connector, queue producer/consumer, microservice deployment,
Kubernetes configuration, complex DDD layer, or production observability
platform is included.

## Recommended next phase

Build the product in small, separately tested increments:

1. Add read-only department and user membership endpoints.
2. Add task create, list, detail, and status-update endpoints.
3. Define one SaaS connector configuration and credential abstraction.
4. Add BullMQ synchronization producers/consumers with idempotency handling.

Each step should retain the health endpoint, document its new API surface in
Swagger, and add focused unit and endpoint tests before adding the next one.
