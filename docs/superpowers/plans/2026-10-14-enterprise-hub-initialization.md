# Enterprise Hub Initialization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable, tested pnpm monorepo skeleton for Enterprise Hub with a Vue placeholder UI, a NestJS health API, Prisma models, and local PostgreSQL/Redis infrastructure.

**Architecture:** Keep the web app, API, and shared contracts as three pnpm workspace packages. The NestJS modular monolith owns infrastructure adapters and exposes only `GET /health`; the Vue app consumes the shared health contract through a Pinia store. Docker Compose supplies PostgreSQL and Redis, while Prisma owns the initial relational schema.

**Tech Stack:** Node.js 22, pnpm 8, TypeScript 5, Vue 3, Vite, Pinia, NestJS 11, Prisma 6, PostgreSQL 16, Redis 7, BullMQ, Jest, Supertest, Vitest, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-10-14-enterprise-hub-design.md`

## Global Constraints

- First phase only: expose `GET /health`; do not implement business CRUD endpoints.
- Keep `common`, `auth`, `users`, `departments`, `tasks`, `integrations`, and `sync` as NestJS module boundaries.
- Do not implement real DingTalk login; `auth` remains a structural placeholder for a future local Mock flow.
- Do not add microservices, Kubernetes, complex DDD, an event bus, or a queue producer/consumer.
- `GET /health` checks API, PostgreSQL, and Redis; return 200 when all are up and 503 when any dependency is down.
- Use test-first implementation for runtime behavior. Configuration and generated scaffolding are verified through validation/build commands.
- Commit `pnpm-lock.yaml`; never commit `.env` or credentials.

---

## File Map

- Root workspace: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, `.env.example`, `docker-compose.yml`.
- Shared contracts: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/src/health.ts`, `packages/shared/src/index.ts`.
- API tooling: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/tsconfig.build.json`, `apps/api/nest-cli.json`, `apps/api/jest.config.js`, `apps/api/test/jest-e2e.json`.
- API bootstrap/config: `apps/api/src/main.ts`, `apps/api/src/app.module.ts`, `apps/api/src/common/config/env.validation.ts`.
- API cross-cutting behavior: `apps/api/src/common/filters/http-exception.filter.ts`, `apps/api/src/common/interceptors/request-logging.interceptor.ts` and matching specs.
- API infrastructure: `apps/api/src/common/database/database.module.ts`, `apps/api/src/common/database/prisma.service.ts`, `apps/api/src/common/redis/redis.module.ts`, `apps/api/src/common/redis/redis.service.ts`.
- API health: `apps/api/src/common/health/health.module.ts`, `health.controller.ts`, `health.service.ts`, `health.service.spec.ts`, `apps/api/test/health.e2e-spec.ts`.
- API placeholders: one `*.module.ts` file in each of `auth`, `users`, `departments`, `tasks`, `integrations`, and `sync`.
- Prisma: `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/migration_lock.toml`, `apps/api/prisma/migrations/20261014000000_init/migration.sql`.
- Web tooling: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/tsconfig.node.json`, `apps/web/vite.config.ts`, `apps/web/index.html`, `apps/web/src/vite-env.d.ts`.
- Web runtime: `apps/web/src/main.ts`, `apps/web/src/App.vue`, `apps/web/src/styles.css`, `apps/web/src/stores/health.ts`, `apps/web/src/stores/health.spec.ts`, `apps/web/src/views/TodoPlaceholderView.vue`.
- Documentation: `README.md`.

---

### Task 1: Establish the workspace and shared health contract

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/health.ts`
- Create: `packages/shared/src/index.ts`

**Interfaces:**
- Produces: `ComponentStatus`, `ServiceStatuses`, and `HealthResponse` exported from `@enterprise-hub/shared`.
- Consumes: none.

- [ ] **Step 1: Create the root workspace configuration**

Use a private root package with these scripts:

```json
{
  "name": "enterprise-hub",
  "version": "0.1.0",
  "private": true,
  "packageManager": "pnpm@8.3.1",
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "pnpm --parallel --filter @enterprise-hub/api --filter @enterprise-hub/web dev",
    "dev:api": "pnpm --filter @enterprise-hub/api dev",
    "dev:web": "pnpm --filter @enterprise-hub/web dev",
    "build": "pnpm -r build",
    "typecheck": "pnpm -r typecheck",
    "test": "pnpm -r test",
    "test:e2e": "pnpm --filter @enterprise-hub/api test:e2e",
    "prisma:generate": "pnpm --filter @enterprise-hub/api prisma:generate",
    "prisma:migrate": "pnpm --filter @enterprise-hub/api prisma:migrate",
    "prisma:studio": "pnpm --filter @enterprise-hub/api prisma:studio"
  }
}
```

Set workspace packages to `apps/*` and `packages/*`. Extendable compiler defaults in `tsconfig.base.json` must enable strict mode, ES2022 target, Node module resolution, declaration output, `esModuleInterop`, `skipLibCheck`, and consistent file-name casing. Ignore `node_modules`, `dist`, `coverage`, `.env`, Vite caches, and local IDE files.

- [ ] **Step 2: Add the shared package and contract**

Create a buildable ESM package named `@enterprise-hub/shared` with `build: tsc -p tsconfig.json`, `typecheck: tsc --noEmit`, and a no-op test command that reports the package has type-only contracts. Define:

```ts
export type ComponentStatus = 'up' | 'down';

export interface ServiceStatuses {
  api: ComponentStatus;
  database: ComponentStatus;
  redis: ComponentStatus;
}

export interface HealthResponse {
  status: ComponentStatus;
  timestamp: string;
  services: ServiceStatuses;
}
```

Re-export these types from `src/index.ts`.

- [ ] **Step 3: Verify the shared package compiles**

Run: `pnpm --filter @enterprise-hub/shared typecheck`

Expected: exit 0 with no TypeScript diagnostics.

- [ ] **Step 4: Commit the workspace foundation**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .gitignore packages/shared
git commit -m "chore: initialize pnpm workspace"
```

---

### Task 2: Add application manifests and install reproducible dependencies

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/tsconfig.build.json`
- Create: `apps/api/nest-cli.json`
- Create: `apps/api/jest.config.js`
- Create: `apps/api/test/jest-e2e.json`
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/tsconfig.node.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/src/vite-env.d.ts`
- Create: `pnpm-lock.yaml`

**Interfaces:**
- Produces: runnable `@enterprise-hub/api` and `@enterprise-hub/web` package scripts and installed workspace dependencies.
- Consumes: `@enterprise-hub/shared` through `workspace:*`.

- [ ] **Step 1: Define the API package**

Add scripts for `nest start --watch`, `nest build`, `tsc --noEmit`, Jest unit tests, Jest e2e tests, Prisma generate/migrate/studio, and dependencies for Nest core/config/swagger/bullmq, Prisma Client, ioredis, Joi, reflect-metadata, and rxjs. Use compatible major lines:

```json
{
  "dependencies": {
    "@enterprise-hub/shared": "workspace:*",
    "@nestjs/bullmq": "^11.0.0",
    "@nestjs/common": "^11.0.0",
    "@nestjs/config": "^4.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/platform-express": "^11.0.0",
    "@nestjs/swagger": "^11.0.0",
    "@prisma/client": "^6.0.0",
    "bullmq": "^5.0.0",
    "ioredis": "^5.0.0",
    "joi": "^17.0.0",
    "reflect-metadata": "^0.2.0",
    "rxjs": "^7.8.0"
  }
}
```

Use Jest 29, ts-jest 29, Supertest 7, Prisma CLI 6, Nest testing 11, and Node/Jest/Supertest type packages as dev dependencies. Configure decorators and metadata in `tsconfig.json`; exclude tests from `tsconfig.build.json`.

- [ ] **Step 2: Define the web package**

Add Vue 3, Pinia, and the shared workspace package. Add Vite, Vue plugin, Vitest, jsdom, Vue Test Utils, TypeScript, and vue-tsc as dev dependencies. Scripts are `vite`, `vue-tsc && vite build`, `vue-tsc --noEmit`, and `vitest run`.

Configure `vite.config.ts` with the Vue plugin, jsdom tests, and a `/health` proxy to `http://localhost:3000`.

- [ ] **Step 3: Install and lock dependencies**

Run: `pnpm install`

Expected: exit 0 and a new `pnpm-lock.yaml` covering all three workspace packages.

- [ ] **Step 4: Verify tooling resolves**

Run: `pnpm --filter @enterprise-hub/api exec nest --version && pnpm --filter @enterprise-hub/web exec vite --version && pnpm --filter @enterprise-hub/api exec prisma --version`

Expected: all three commands exit 0.

- [ ] **Step 5: Commit package tooling**

```bash
git add apps/api/package.json apps/api/tsconfig.json apps/api/tsconfig.build.json apps/api/nest-cli.json apps/api/jest.config.js apps/api/test/jest-e2e.json apps/web/package.json apps/web/tsconfig.json apps/web/tsconfig.node.json apps/web/vite.config.ts apps/web/src/vite-env.d.ts pnpm-lock.yaml
git commit -m "chore: configure web and api toolchains"
```

---

### Task 3: Configure Docker infrastructure and Prisma schema

**Files:**
- Create: `.env.example`
- Create: `docker-compose.yml`
- Create: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/migration_lock.toml`
- Create: `apps/api/prisma/migrations/20261014000000_init/migration.sql`

**Interfaces:**
- Produces: PostgreSQL on `localhost:5432`, Redis on `localhost:6379`, and Prisma models `Department`, `User`, `Task` plus enum `TaskStatus`.
- Consumes: `DATABASE_URL`, `REDIS_HOST`, and `REDIS_PORT` from environment variables.

- [ ] **Step 1: Add local environment defaults**

Create `.env.example` with:

```dotenv
PORT=3000
DATABASE_URL=postgresql://enterprise_hub:enterprise_hub@localhost:5432/enterprise_hub?schema=public
REDIS_HOST=localhost
REDIS_PORT=6379
CORS_ORIGIN=http://localhost:5173
```

- [ ] **Step 2: Add Compose services**

Define `postgres:16-alpine` and `redis:7-alpine`, named volumes, fixed development credentials matching `.env.example`, and health checks using `pg_isready` and `redis-cli ping`. Expose only ports 5432 and 6379.

- [ ] **Step 3: Define the Prisma schema**

Use PostgreSQL and the JS Prisma client. Define `TaskStatus`, `Department` with a named self-relation, `User` with optional department relation, and `Task` with optional assignee relation. Apply UUID defaults, timestamp defaults, `@updatedAt`, `onDelete: SetNull`, unique email, and the two composite indexes from the spec.

- [ ] **Step 4: Add the deterministic initial SQL migration**

The SQL must create the `TaskStatus` enum, three tables, primary/unique constraints, foreign keys with `ON DELETE SET NULL`, and indexes equivalent to:

```sql
CREATE INDEX "Task_assigneeId_status_idx" ON "Task"("assigneeId", "status");
CREATE INDEX "Task_source_externalId_idx" ON "Task"("source", "externalId");
```

- [ ] **Step 5: Validate and format Prisma**

Run: `cp .env.example .env && pnpm --filter @enterprise-hub/api exec prisma format && pnpm --filter @enterprise-hub/api exec prisma validate && pnpm prisma:generate`

Expected: schema validation succeeds and Prisma Client generation exits 0.

- [ ] **Step 6: Start dependencies and apply migration**

Run: `docker compose up -d && docker compose ps && pnpm prisma:migrate -- --name init`

Expected: PostgreSQL and Redis show healthy; Prisma reports the database is in sync without creating a second migration.

- [ ] **Step 7: Commit infrastructure and schema**

```bash
git add .env.example docker-compose.yml apps/api/prisma
git commit -m "feat: add local infrastructure and data schema"
```

---

### Task 4: Build and test API configuration and cross-cutting behavior

**Files:**
- Create: `apps/api/src/common/config/env.validation.spec.ts`
- Create: `apps/api/src/common/config/env.validation.ts`
- Create: `apps/api/src/common/filters/http-exception.filter.spec.ts`
- Create: `apps/api/src/common/filters/http-exception.filter.ts`
- Create: `apps/api/src/common/interceptors/request-logging.interceptor.spec.ts`
- Create: `apps/api/src/common/interceptors/request-logging.interceptor.ts`

**Interfaces:**
- Produces: `validateEnvironment(config: Record<string, unknown>): EnvironmentVariables`, `HttpExceptionFilter`, and `RequestLoggingInterceptor`.
- Consumes: Nest HTTP adapter contracts and the five environment variables in `.env.example`.

- [ ] **Step 1: Write failing environment validation tests**

Test that valid string input becomes a typed object with numeric `PORT` and `REDIS_PORT`, and that a missing `DATABASE_URL` throws with a useful validation message:

```ts
expect(() => validateEnvironment(validConfig)).not.toThrow();
expect(validateEnvironment(validConfig).REDIS_PORT).toBe(6379);
expect(() => validateEnvironment({ ...validConfig, DATABASE_URL: undefined })).toThrow(/DATABASE_URL/);
```

- [ ] **Step 2: Run the config spec and confirm RED**

Run: `pnpm --filter @enterprise-hub/api test -- env.validation.spec.ts`

Expected: FAIL because `env.validation.ts` does not exist.

- [ ] **Step 3: Implement Joi environment validation**

Export an `EnvironmentVariables` interface and a `validateEnvironment` function. Require `DATABASE_URL`, `REDIS_HOST`, and a URI `CORS_ORIGIN`; default `PORT` to 3000 and `REDIS_PORT` to 6379; allow no unknown values in the returned object while accepting unrelated process environment keys during validation.

- [ ] **Step 4: Run the config spec and confirm GREEN**

Run: `pnpm --filter @enterprise-hub/api test -- env.validation.spec.ts`

Expected: PASS.

- [ ] **Step 5: Write failing exception filter tests**

Use a minimal mocked HTTP arguments host. Verify a `BadRequestException('invalid input')` produces status 400 and a body matching:

```ts
{
  statusCode: 400,
  message: 'invalid input',
  path: '/example',
  timestamp: expect.any(String)
}
```

Also verify an unknown `Error` produces 500 with `message: 'Internal server error'`.

- [ ] **Step 6: Run the filter spec and confirm RED**

Run: `pnpm --filter @enterprise-hub/api test -- http-exception.filter.spec.ts`

Expected: FAIL because the filter does not exist.

- [ ] **Step 7: Implement the global exception filter**

Use `@Catch()` and the HTTP adapter response. Preserve a string or string-array Nest exception message, normalize all other cases, use ISO timestamps, and never expose unknown exception details.

- [ ] **Step 8: Run the filter spec and confirm GREEN**

Run: `pnpm --filter @enterprise-hub/api test -- http-exception.filter.spec.ts`

Expected: PASS.

- [ ] **Step 9: Write failing request logging interceptor tests**

Stub a Nest logger and verify that completing an observable logs method, URL, response status, and elapsed milliseconds. Verify an errored observable logs the status and rethrows the original error.

- [ ] **Step 10: Run the interceptor spec and confirm RED**

Run: `pnpm --filter @enterprise-hub/api test -- request-logging.interceptor.spec.ts`

Expected: FAIL because the interceptor does not exist.

- [ ] **Step 11: Implement the request logging interceptor**

Use RxJS `tap` and `catchError`; do not log request bodies, headers, environment variables, or stack traces. Keep the original observable value and error unchanged.

- [ ] **Step 12: Run all three specs and confirm GREEN**

Run: `pnpm --filter @enterprise-hub/api test -- env.validation.spec.ts http-exception.filter.spec.ts request-logging.interceptor.spec.ts`

Expected: all tests PASS.

- [ ] **Step 13: Commit cross-cutting behavior**

```bash
git add apps/api/src/common/config apps/api/src/common/filters apps/api/src/common/interceptors
git commit -m "feat: add api validation and request handling"
```

---

### Task 5: Implement infrastructure adapters and the health endpoint with TDD

**Files:**
- Create: `apps/api/src/common/database/database.module.ts`
- Create: `apps/api/src/common/database/prisma.service.ts`
- Create: `apps/api/src/common/redis/redis.module.ts`
- Create: `apps/api/src/common/redis/redis.service.ts`
- Create: `apps/api/src/common/health/health.service.spec.ts`
- Create: `apps/api/src/common/health/health.service.ts`
- Create: `apps/api/src/common/health/health.controller.ts`
- Create: `apps/api/src/common/health/health.module.ts`
- Create: `apps/api/test/health.e2e-spec.ts`

**Interfaces:**
- Produces: `PrismaService.checkConnection(): Promise<void>`, `RedisService.ping(): Promise<void>`, `HealthService.check(): Promise<HealthResponse>`, and `GET /health`.
- Consumes: `HealthResponse` from `@enterprise-hub/shared`, Prisma Client, ioredis, and Nest Config.

- [ ] **Step 1: Write failing health service unit tests**

Use lightweight fake adapters with `checkConnection` and `ping`. Freeze the clock or assert the timestamp parses. Cover:

```ts
expect(result.status).toBe('up');
expect(result.services).toEqual({ api: 'up', database: 'up', redis: 'up' });
```

When either fake rejects, assert overall `down`, the failed component is `down`, and the other dependency remains `up`. Include a case where both reject to prove checks are independent.

- [ ] **Step 2: Run the health unit spec and confirm RED**

Run: `pnpm --filter @enterprise-hub/api test -- health.service.spec.ts`

Expected: FAIL because health service and adapters do not exist.

- [ ] **Step 3: Implement the infrastructure adapters**

`PrismaService` extends `PrismaClient`, connects on module init, disconnects on destroy, and implements `checkConnection()` with `$queryRaw\`SELECT 1\``. `RedisService` creates one ioredis client from `REDIS_HOST`/`REDIS_PORT`, uses `lazyConnect`, connects on module init, closes on destroy, and throws unless `ping()` returns `PONG`. Export each service from a global infrastructure module.

- [ ] **Step 4: Implement the minimal health service**

Run both dependency probes with `Promise.allSettled`, map fulfilled/rejected outcomes to `up`/`down`, always set API to `up`, set the overall status, and return a fresh ISO timestamp. Log dependency failure summaries without returning error details.

- [ ] **Step 5: Run the health unit spec and confirm GREEN**

Run: `pnpm --filter @enterprise-hub/api test -- health.service.spec.ts`

Expected: PASS.

- [ ] **Step 6: Write the failing endpoint tests**

Create a Nest testing application containing `HealthController` and override `HealthService`. Assert an `up` response produces status 200 and a body matching `HealthResponse`; assert a `down` response produces status 503 while preserving the services map.

- [ ] **Step 7: Run the e2e spec and confirm RED**

Run: `pnpm --filter @enterprise-hub/api test:e2e -- health.e2e-spec.ts`

Expected: FAIL because the controller/module do not exist.

- [ ] **Step 8: Implement the health controller and module**

Expose only `@Get('health')`. Call `HealthService.check()`, set status 200 or 503 with a passthrough Express response, and return the result unchanged. Add Swagger operation and 200/503 response metadata without creating an unrelated DTO hierarchy.

- [ ] **Step 9: Run health unit and endpoint tests and confirm GREEN**

Run: `pnpm --filter @enterprise-hub/api test -- health.service.spec.ts && pnpm --filter @enterprise-hub/api test:e2e -- health.e2e-spec.ts`

Expected: both commands PASS.

- [ ] **Step 10: Commit the health slice**

```bash
git add apps/api/src/common/database apps/api/src/common/redis apps/api/src/common/health apps/api/test/health.e2e-spec.ts
git commit -m "feat: add dependency-aware health endpoint"
```

---

### Task 6: Assemble the NestJS modular application

**Files:**
- Create: `apps/api/src/auth/auth.module.ts`
- Create: `apps/api/src/users/users.module.ts`
- Create: `apps/api/src/departments/departments.module.ts`
- Create: `apps/api/src/tasks/tasks.module.ts`
- Create: `apps/api/src/integrations/integrations.module.ts`
- Create: `apps/api/src/sync/sync.module.ts`
- Create: `apps/api/src/app.module.ts`
- Create: `apps/api/src/main.ts`
- Modify: `apps/api/test/health.e2e-spec.ts`

**Interfaces:**
- Produces: bootable NestJS application with validated config, BullMQ Redis configuration, global validation/filter/logging, Swagger at `/docs`, CORS, and module placeholders.
- Consumes: every API component created in Tasks 4 and 5.

- [ ] **Step 1: Strengthen the endpoint test to bootstrap AppModule**

Change the e2e test to compile `AppModule`, override `PrismaService` and `RedisService` with deterministic fakes, and register the same global filter used by `main.ts`. Keep the 200 and 503 assertions.

- [ ] **Step 2: Run the e2e spec and confirm RED**

Run: `pnpm --filter @enterprise-hub/api test:e2e -- health.e2e-spec.ts`

Expected: FAIL because `AppModule` does not exist.

- [ ] **Step 3: Add the six empty business modules**

Each file exports one `@Module({})` class named after its directory. Add a brief comment only in `AuthModule` stating that local Mock authentication belongs to the next phase; do not add controllers or providers.

- [ ] **Step 4: Implement AppModule**

Import `ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'], validate: validateEnvironment })`, infrastructure modules, `HealthModule`, placeholder modules, and `BullModule.forRootAsync` using `REDIS_HOST` and numeric `REDIS_PORT`. Do not register a named queue.

- [ ] **Step 5: Implement application bootstrap**

Create the app, enable CORS, install the strict `ValidationPipe`, global exception filter, and request logging interceptor. Configure Swagger title `Enterprise Hub API`, version `0.1.0`, path `/docs`, then listen on validated `PORT`.

- [ ] **Step 6: Run API tests, typecheck, and build**

Run: `pnpm --filter @enterprise-hub/api test && pnpm --filter @enterprise-hub/api test:e2e && pnpm --filter @enterprise-hub/api typecheck && pnpm --filter @enterprise-hub/api build`

Expected: all commands exit 0.

- [ ] **Step 7: Commit the assembled API**

```bash
git add apps/api/src apps/api/test/health.e2e-spec.ts
git commit -m "feat: assemble modular nestjs api"
```

---

### Task 7: Build the Vue placeholder UI and health state with TDD

**Files:**
- Create: `apps/web/index.html`
- Create: `apps/web/src/stores/health.spec.ts`
- Create: `apps/web/src/stores/health.ts`
- Create: `apps/web/src/views/TodoPlaceholderView.vue`
- Create: `apps/web/src/App.vue`
- Create: `apps/web/src/main.ts`
- Create: `apps/web/src/styles.css`

**Interfaces:**
- Produces: `useHealthStore` with `loadHealth(): Promise<void>`, status state, and human-readable connection state; a responsive placeholder screen.
- Consumes: `HealthResponse` from `@enterprise-hub/shared` and `GET /health` through the Vite proxy.

- [ ] **Step 1: Write failing Pinia store tests**

Stub global fetch, activate a testing Pinia, and cover:

```ts
await store.loadHealth();
expect(store.state).toBe('connected');
expect(store.health?.services.database).toBe('up');
```

For a rejected fetch and a 503 response, assert `state === 'unavailable'`, loading finishes, and no exception escapes to the component.

- [ ] **Step 2: Run the store spec and confirm RED**

Run: `pnpm --filter @enterprise-hub/web test -- src/stores/health.spec.ts`

Expected: FAIL because the store does not exist.

- [ ] **Step 3: Implement the minimal health store**

Define `state` as `'idle' | 'loading' | 'connected' | 'unavailable'`, retain an optional `HealthResponse`, call `fetch('/health')`, parse a valid health body for both 200 and 503, and map fetch/parsing errors to unavailable. Treat only `response.ok && body.status === 'up'` as connected.

- [ ] **Step 4: Run the store spec and confirm GREEN**

Run: `pnpm --filter @enterprise-hub/web test -- src/stores/health.spec.ts`

Expected: PASS.

- [ ] **Step 5: Create the placeholder application shell**

Build a semantic layout with a header, compact sidebar, health status card, and `TodoPlaceholderView`. Render three clearly marked sample rows from a local constant and label them as preview content. Do not add Vue Router or business API calls. Call `loadHealth()` on mount.

- [ ] **Step 6: Add focused responsive styling**

Use plain CSS with design tokens, accessible color contrast, visible focus states, a two-column desktop layout, and a single-column breakpoint. Avoid component libraries and external fonts.

- [ ] **Step 7: Run web tests, typecheck, and build**

Run: `pnpm --filter @enterprise-hub/web test && pnpm --filter @enterprise-hub/web typecheck && pnpm --filter @enterprise-hub/web build`

Expected: all commands exit 0 and Vite emits `apps/web/dist`.

- [ ] **Step 8: Commit the web shell**

```bash
git add apps/web/index.html apps/web/src
git commit -m "feat: add enterprise hub placeholder web app"
```

---

### Task 8: Document operation and verify the integrated system

**Files:**
- Create: `README.md`
- Modify: any file only when a verification result exposes a concrete defect; add a failing regression test before changing runtime behavior.

**Interfaces:**
- Produces: complete setup, migration, development, test, build, endpoint, and troubleshooting instructions.
- Consumes: the final root scripts and local infrastructure workflow.

- [ ] **Step 1: Write the README**

Document prerequisites (Node 22+, pnpm 8+, Docker Compose), directory tree, initial setup, environment copy, Compose commands, Prisma generate/migrate/studio commands, combined and separate dev commands, URLs (`5173`, `3000/health`, `3000/docs`), typecheck/build/test/e2e commands, current scope, Mock-auth boundary, and next-phase endpoint recommendations.

- [ ] **Step 2: Verify static project quality**

Run: `pnpm typecheck && pnpm build && pnpm test && pnpm test:e2e`

Expected: every command exits 0 with zero failed tests.

- [ ] **Step 3: Verify Compose and migration from the checked-in files**

Run: `docker compose config && docker compose up -d && docker compose ps && pnpm prisma:generate && pnpm prisma:migrate`

Expected: Compose config validates, PostgreSQL and Redis are healthy, Prisma Client generates, and migration reports the database is up to date.

- [ ] **Step 4: Verify the live healthy path**

Start the API with `pnpm dev:api`, then run:

```bash
curl --fail --silent http://localhost:3000/health
curl --fail --silent http://localhost:3000/docs
```

Expected: health returns status `up` with API/database/Redis all `up`; Swagger HTML is returned.

- [ ] **Step 5: Verify the live degraded path**

Stop Redis with `docker compose stop redis`, request `/health`, and assert HTTP 503 with Redis `down` and database `up`. Restart Redis and confirm `/health` returns HTTP 200 again. This action affects only the project-local development container.

- [ ] **Step 6: Verify the web integration**

Start `pnpm dev:web`, load `http://localhost:5173`, and confirm the layout, preview tasks, and connected health state render without console errors. If browser automation is unavailable, use the Vite build plus an HTTP request to the dev server and explicitly report that visual verification remains manual.

- [ ] **Step 7: Inspect repository state and requirements**

Run: `git status --short && git diff --check && rg --files -g '!node_modules' -g '!dist'`

Expected: no whitespace errors; all required directories and files are present; `.env`, `node_modules`, `dist`, and coverage output are untracked/ignored.

- [ ] **Step 8: Commit documentation and any verified corrections**

```bash
git add README.md
git commit -m "docs: add enterprise hub development guide"
```

---

## Final Verification Checklist

- [ ] `apps/web`, `apps/api`, and `packages/shared` exist as pnpm workspace packages.
- [ ] API contains all seven requested module areas and exposes no business endpoint except `/health`.
- [ ] Prisma schema and checked-in migration contain User, Department, and Task.
- [ ] ValidationPipe, exception filter, Swagger, environment validation, and request logging are wired globally.
- [ ] Compose starts healthy PostgreSQL and Redis services from documented defaults.
- [ ] Web renders the shell, placeholder tasks, and live backend status.
- [ ] Unit tests and the endpoint test have been observed failing before implementation and passing afterward.
- [ ] `pnpm typecheck`, `pnpm build`, `pnpm test`, and `pnpm test:e2e` all exit 0 in a fresh final run.
- [ ] README includes install, start, migration, testing, current scope, and next-phase recommendations.
- [ ] No real DingTalk login, CRUD, queue worker, microservice, Kubernetes, or complex DDD code is present.
