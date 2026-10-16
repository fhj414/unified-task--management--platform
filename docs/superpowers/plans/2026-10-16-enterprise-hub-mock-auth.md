# Enterprise Hub Mock JWT Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Prisma-seeded local mock users, JWT-backed mock login/current-user APIs, and a minimal Vue login flow without real DingTalk authentication.

**Architecture:** The API owns seed data, identity lookup, JWT issuance, and one endpoint-scoped Bearer-token guard. Shared contracts carry only user and login response shapes. The Vue app restores a session-scoped token through `/auth/me`, shows a mock-user chooser when anonymous, and otherwise preserves the preview dashboard.

**Tech Stack:** pnpm workspace, NestJS 11, `@nestjs/jwt`, Prisma 6/PostgreSQL, Vue 3, Pinia, Vitest, Jest, Supertest, Swagger, Joi.

**Spec:** `docs/superpowers/specs/2026-10-16-enterprise-hub-mock-auth-design.md`

## Global Constraints

- Keep identity behavior local-development only; do not add DingTalk OAuth, passwords, registration, refresh tokens, roles, Passport, a global guard, task CRUD, or SaaS credentials.
- Do not change the Prisma schema or add a migration; the current `Department` and `User` models are sufficient.
- Keep `/health`, `GET /auth/mock-users`, and `POST /auth/mock-login` public. Guard only `GET /auth/me`.
- Store the token in browser `sessionStorage`, never `localStorage`; add it only to authenticated `/auth` requests.
- Use Node 22 and pnpm 8.3.1. Use `apply_patch` for edits, strict TDD for behavior, and focused conventional commits.
- Swagger-document all public endpoints and add focused unit, endpoint, and web-store tests.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `packages/shared/src/auth.ts` | Browser-safe user, department summary, and login response contracts. |
| `apps/api/prisma/seed.ts` | Idempotently upserts demo departments and users. |
| `apps/api/prisma/seed.spec.ts` | Verifies the seed boundary uses stable upserts. |
| `apps/api/src/common/config/env.validation.ts` | Validates JWT configuration. |
| `apps/api/src/auth/*` | DTOs, service, guard, controller, module, and focused tests. |
| `apps/api/test/auth.e2e-spec.ts` | Mock-login endpoint contract tests. |
| `apps/web/src/stores/auth.ts` | Pinia session restore, login, and logout behavior. |
| `apps/web/src/views/MockLoginView.vue` | Anonymous mock-account chooser. |
| `apps/web/src/App.vue` | Switches login and authenticated dashboard shells. |
| `README.md` | Documents seed, login, and mock-only constraints. |

### Task 1: Shared contracts, JWT configuration, and repeatable seed data

**Files:**
- Create: `packages/shared/src/auth.ts`, `apps/api/prisma/seed.ts`, `apps/api/prisma/seed.spec.ts`
- Modify: `packages/shared/src/index.ts`, `apps/api/src/common/config/env.validation.ts`, `apps/api/src/common/config/env.validation.spec.ts`, `apps/api/package.json`, `package.json`, `.env.example`, `pnpm-lock.yaml`

**Interfaces:**
- Produces `DepartmentSummary`, `AuthenticatedUser`, and `MockLoginResponse` from `@enterprise-hub/shared`.
- Produces `seedDatabase(prisma)`, where `prisma` exposes `department.upsert()` and `user.upsert()`.
- Extends `EnvironmentVariables` with `JWT_SECRET: string` and `JWT_EXPIRES_IN: string`.
- Produces root command `pnpm prisma:seed`, which loads the root `.env`.

- [ ] **Step 1: Write failing JWT environment tests**

Add tests proving missing `JWT_SECRET` throws and a valid secret defaults `JWT_EXPIRES_IN` to `1h`.

```ts
expect(() => validateEnvironment(baseEnvironment)).toThrow();
expect(validateEnvironment({ ...baseEnvironment, JWT_SECRET: 'local-development-jwt-secret-change-me' }))
  .toMatchObject({ JWT_EXPIRES_IN: '1h' });
```

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm --filter @enterprise-hub/api test -- env.validation.spec.ts`

Expected: FAIL because JWT values are not validated.

- [ ] **Step 3: Implement validated configuration**

Add both interface properties and these Joi entries, then add matching local-only values to `.env.example`.

```ts
JWT_SECRET: Joi.string().min(24).required(),
JWT_EXPIRES_IN: Joi.string().default('1h'),
```

- [ ] **Step 4: Run the environment test and verify GREEN**

Run: `pnpm --filter @enterprise-hub/api test -- env.validation.spec.ts`

Expected: PASS.

- [ ] **Step 5: Write a failing idempotent-seed test**

Use a complete fake Prisma boundary. Run `seedDatabase(prisma)` twice; assert two department upserts and three user upserts per run, including `ada.lovelace@enterprise-hub.local`.

```ts
await seedDatabase(prisma);
await seedDatabase(prisma);
expect(prisma.department.upsert).toHaveBeenCalledTimes(4);
expect(prisma.user.upsert).toHaveBeenCalledTimes(6);
expect(prisma.user.upsert).toHaveBeenCalledWith(expect.objectContaining({
  where: { email: 'ada.lovelace@enterprise-hub.local' },
}));
```

- [ ] **Step 6: Run the seed test and verify RED**

Run: `pnpm --filter @enterprise-hub/api test -- prisma/seed.spec.ts`

Expected: FAIL because the seed module does not exist.

- [ ] **Step 7: Implement contracts and seed module**

Create and re-export:

```ts
export interface DepartmentSummary { id: string; name: string }
export interface AuthenticatedUser { id: string; email: string; name: string; department: DepartmentSummary | null }
export interface MockLoginResponse { accessToken: string; user: AuthenticatedUser }
```

Implement `seedDatabase` with two fixed UUID departments (`Engineering`, `Operations`) and three fixed-email users (`ada.lovelace`, `grace.hopper`, `linus.torvalds`). Upsert departments by fixed ID and users by email. Export the function, then call it from a direct-execution `main()` that disconnects Prisma. Add `tsx`, Prisma's `seed: "tsx prisma/seed.ts"` config, API `prisma:seed`, and the root dotenv wrapper.

- [ ] **Step 8: Verify targeted behavior and a real seed**

Run:

```bash
pnpm --filter @enterprise-hub/api test -- env.validation.spec.ts prisma/seed.spec.ts
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed
pnpm prisma:seed
```

Expected: tests pass and two seed runs succeed without duplicates.

- [ ] **Step 9: Commit Task 1**

```bash
git add packages/shared apps/api/prisma apps/api/src/common/config apps/api/package.json package.json .env.example pnpm-lock.yaml
git commit -m "feat: add mock auth seed foundation"
```

### Task 2: NestJS mock-login API and JWT guard

**Files:**
- Create: `apps/api/src/auth/auth.service.ts`, `apps/api/src/auth/auth.service.spec.ts`, `apps/api/src/auth/auth.controller.ts`, `apps/api/src/auth/jwt-auth.guard.ts`, `apps/api/src/auth/jwt-auth.guard.spec.ts`, `apps/api/src/auth/dto/mock-login.dto.ts`, `apps/api/src/auth/dto/auth-user.dto.ts`, `apps/api/src/auth/dto/mock-login-response.dto.ts`, `apps/api/test/auth.e2e-spec.ts`
- Modify: `apps/api/src/auth/auth.module.ts`, `apps/api/package.json`, `pnpm-lock.yaml`

**Interfaces:**
- Consumes Task 1 contracts and config.
- Produces public `GET /auth/mock-users`, public `POST /auth/mock-login`, guarded `GET /auth/me`.
- Produces `AuthService.listMockUsers()`, `login(email)`, `getCurrentUser(userId)`, and `JwtAuthGuard` that attaches `{ sub: string; email: string }` as `request.authUser`.

- [ ] **Step 1: Write failing AuthService tests**

Use a complete Prisma fake returning users with nullable department and a `JwtService.signAsync` fake. Verify login signs `{ sub, email }` and returns the mapped response; unknown login and missing current user throw `UnauthorizedException`.

```ts
await expect(service.login('missing@enterprise-hub.local')).rejects.toBeInstanceOf(UnauthorizedException);
expect(jwtService.signAsync).toHaveBeenCalledWith({ sub: 'user-id', email: 'ada.lovelace@enterprise-hub.local' });
```

- [ ] **Step 2: Run service tests and verify RED**

Run: `pnpm --filter @enterprise-hub/api test -- auth.service.spec.ts`

Expected: FAIL because `AuthService` does not exist.

- [ ] **Step 3: Implement service, DTOs, and module registration**

Install `@nestjs/jwt`. Register `JwtModule` from `ConfigService` values. Query Prisma with `department: { select: { id: true, name: true } }`; map to `AuthenticatedUser` and never expose raw timestamps. `MockLoginDto` uses `@IsEmail() email`; response DTOs describe shared shapes in Swagger.

- [ ] **Step 4: Run service tests and verify GREEN**

Run: `pnpm --filter @enterprise-hub/api test -- auth.service.spec.ts`

Expected: PASS.

- [ ] **Step 5: Write failing guard and endpoint tests**

Guard test: missing Bearer header and rejected verification both throw `UnauthorizedException`; a verified payload reaches `request.authUser`.

Endpoint test uses `AppModule`, `configureApplication`, real JWT, and overridden Prisma fixtures. Cover success and unknown mock login plus `/auth/me` with no token, valid login token, and invalid token.

```ts
GET /auth/mock-users                   // 200
POST /auth/mock-login { valid email }  // 201 with token
POST /auth/mock-login { unknown }      // 401 standard body
GET /auth/me                           // 401 without token
GET /auth/me                           // 200 with login token
```

- [ ] **Step 6: Run guard and e2e tests and verify RED**

Run:

```bash
pnpm --filter @enterprise-hub/api test -- jwt-auth.guard.spec.ts
pnpm --filter @enterprise-hub/api test:e2e -- auth.e2e-spec.ts
```

Expected: FAIL because no guard/controller routes exist.

- [ ] **Step 7: Implement the focused guard and controller**

Parse exactly one `Bearer <token>`, call `JwtService.verifyAsync`, attach the payload, and replace verification details with `UnauthorizedException('Invalid or expired access token')`. Decorate controller methods with Swagger tags, response DTOs, and Bearer security only for `/auth/me`; apply `@UseGuards(JwtAuthGuard)` only there.

- [ ] **Step 8: Verify backend auth tests are GREEN**

Run:

```bash
pnpm --filter @enterprise-hub/api test -- auth.service.spec.ts jwt-auth.guard.spec.ts
pnpm --filter @enterprise-hub/api test:e2e -- auth.e2e-spec.ts
```

Expected: all named tests PASS.

- [ ] **Step 9: Commit Task 2**

```bash
git add apps/api/src/auth apps/api/test/auth.e2e-spec.ts apps/api/package.json pnpm-lock.yaml
git commit -m "feat: add mock JWT authentication API"
```

### Task 3: Vue mock-user login flow

**Files:**
- Create: `apps/web/src/stores/auth.ts`, `apps/web/src/stores/auth.spec.ts`, `apps/web/src/views/MockLoginView.vue`
- Modify: `apps/web/src/App.vue`, `apps/web/src/styles.css`, `apps/web/vite.config.ts`

**Interfaces:**
- Consumes Task 1 contracts and Task 2 endpoints.
- Produces `useAuthStore()` with `initialize()`, `login(email)`, `logout()`, `state`, `user`, `mockUsers`.
- State is exactly `'loading' | 'anonymous' | 'authenticated'`; token key is `enterprise-hub.access-token`.

- [ ] **Step 1: Write failing auth-store tests**

Test stored-token restore calls `/auth/me` with Bearer auth and reaches authenticated state; invalid restoration clears token, loads mock users, and becomes anonymous; successful login stores the returned token; logout clears token and user. Mock full HTTP fixtures, not partial response objects.

```ts
expect(fetch).toHaveBeenCalledWith('/auth/me', expect.objectContaining({
  headers: { Authorization: 'Bearer stored-token' },
}));
expect(sessionStorage.getItem('enterprise-hub.access-token')).toBeNull();
```

- [ ] **Step 2: Run store tests and verify RED**

Run: `pnpm --filter @enterprise-hub/web test -- auth.spec.ts`

Expected: FAIL because the auth store is absent.

- [ ] **Step 3: Implement the minimal store**

Use `ref` state and a narrow request helper. `initialize()` reads only session storage and validates with `/auth/me`; failure clears token before fetching `/auth/mock-users`. `login(email)` POSTs JSON to `/auth/mock-login`, persists only a successful token, and remains anonymous on non-OK results. `logout()` clears memory/session storage. Do not add a router or general HTTP client.

- [ ] **Step 4: Run store tests and verify GREEN**

Run: `pnpm --filter @enterprise-hub/web test -- auth.spec.ts`

Expected: PASS.

- [ ] **Step 5: Implement the login view and dashboard switch**

Build `MockLoginView.vue` with an accessible labelled account selector, disabled submit until selection, and visible error text. `App.vue` runs `authStore.initialize()` on mount; show loading, login, or existing dashboard based on state. Add current user and logout to the dashboard header. Keep health checks and task placeholder. Proxy `/auth` in Vite and add focused responsive CSS only.

- [ ] **Step 6: Verify web behavior**

Run:

```bash
pnpm --filter @enterprise-hub/web test -- auth.spec.ts health.spec.ts
pnpm --filter @enterprise-hub/web typecheck
```

Expected: all named tests and web typecheck PASS.

- [ ] **Step 7: Commit Task 3**

```bash
git add apps/web
git commit -m "feat: add mock auth web flow"
```

### Task 4: Documentation, manual flow, and complete verification

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-10-16-enterprise-hub-mock-auth-design.md` only if verification reveals a design mismatch

**Interfaces:**
- Consumes Tasks 1–3 commands/endpoints.
- Produces reproducible setup, seed, login, test, and mock-boundary documentation.

- [ ] **Step 1: Update README**

Add `pnpm prisma:seed` after migrations, document local `JWT_SECRET`/`JWT_EXPIRES_IN`, list three auth endpoints, describe selecting seeded users in the login page, and state that no real DingTalk, password, or production credentials exist.

- [ ] **Step 2: Run local stack and data commands**

Run:

```bash
docker compose up -d --wait --wait-timeout 60
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed
pnpm prisma:seed
```

Expected: services healthy; both seed invocations succeed.

- [ ] **Step 3: Run complete automated verification**

Run:

```bash
pnpm typecheck
pnpm build
pnpm test
pnpm test:e2e
docker compose config --quiet
git diff --check
```

Expected: every command exits 0. Run e2e outside the filesystem sandbox only if its local listener is blocked.

- [ ] **Step 4: Manually prove the browser flow**

Start API and web dev servers; choose a mock user at `http://localhost:5173`, confirm the dashboard shows the name, refresh to confirm session restore, then logout to confirm the chooser returns. Check browser console and confirm the anonymous health card still works.

- [ ] **Step 5: Commit Task 4**

```bash
git add README.md docs/superpowers/specs/2026-10-16-enterprise-hub-mock-auth-design.md
git commit -m "docs: document mock authentication workflow"
```
