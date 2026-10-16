# Enterprise Hub

Enterprise Hub is a first-phase monorepo foundation for a unified team task
workspace. It contains a Vue 3 preview UI, a NestJS API, shared TypeScript
contracts, Prisma data models, and a local PostgreSQL/Redis development stack.

This phase deliberately exposes only a health endpoint. It is an operational
foundation, not a task-management product yet.

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
`integrations`, and `sync` module areas. Only the common health module has an
HTTP endpoint in this phase.

## First-time setup

From the repository root:

```bash
pnpm install
cp .env.example .env
docker compose up -d
docker compose ps
pnpm prisma:generate
pnpm prisma:migrate
```

The default `.env` values point at the Compose services on localhost. Do not
commit `.env`; adjust it locally only when your ports or credentials differ.

### Local infrastructure

```bash
# Start or update PostgreSQL and Redis
docker compose up -d

# Inspect their health
docker compose ps

# Stop services but retain data volumes
docker compose stop

# Stop and remove only this project's services and volumes
docker compose down -v
```

The checked-in Compose configuration publishes PostgreSQL on `5432` and Redis
on `6379`. If either port is already occupied, stop the conflicting local
service or alter the local Compose configuration and matching `.env` values.

## Database commands

```bash
# Regenerate Prisma Client after schema changes
pnpm prisma:generate

# Apply checked-in migrations in local development
pnpm prisma:migrate

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

The Vite development server proxies `/health` to the API. Start the API before
expecting the connection card in the web preview to report healthy.

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

For a complete local verification run, start Compose and apply migrations
before the endpoint test and live health checks:

```bash
docker compose up -d
pnpm prisma:generate
pnpm prisma:migrate
pnpm typecheck && pnpm build && pnpm test && pnpm test:e2e
curl --fail --silent http://localhost:3000/health
curl --fail --silent http://localhost:3000/docs
```

## API contract and operational checks

`GET /health` is the only application endpoint currently exposed. When
PostgreSQL and Redis are available it returns HTTP 200 with `status: "up"` and
each `services` component set to `"up"`. If either dependency is unavailable,
it returns HTTP 503 with the unavailable component marked `"down"`; connection
details are intentionally not sent to clients.

Swagger documents the endpoint at `/docs`. Application startup also enables
global request validation, exception formatting, environment validation,
request logging, and CORS using `CORS_ORIGIN`.

To exercise the Redis degraded path in local development:

```bash
docker compose stop redis
curl --silent --show-error --output /tmp/enterprise-hub-health.json \
  --write-out '%{http_code}\n' http://localhost:3000/health
cat /tmp/enterprise-hub-health.json
docker compose start redis
curl --fail --silent http://localhost:3000/health
```

The first request should report HTTP `503`, `database: "up"`, and
`redis: "down"`; after Redis is restarted, the final request should be HTTP
`200`.

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
infrastructure, the Prisma data model, an API health check, and a static web
preview with placeholder tasks. The `auth` module is structural only: it does
not provide a real DingTalk login, JWT/session handling, or any other login
endpoint. There is no task, user, department, integration, or synchronization
CRUD yet.

No SaaS connector, queue producer/consumer, microservice deployment,
Kubernetes configuration, complex DDD layer, or production observability
platform is included.

## Recommended next phase

Build the product in small, separately tested increments:

1. Add a local mock-auth flow and a current-user endpoint.
2. Add read-only department and user membership endpoints.
3. Add task create, list, detail, and status-update endpoints.
4. Define one SaaS connector configuration and credential abstraction.
5. Add BullMQ synchronization producers/consumers with idempotency handling.

Each step should retain the health endpoint, document its new API surface in
Swagger, and add focused unit and endpoint tests before adding the next one.
