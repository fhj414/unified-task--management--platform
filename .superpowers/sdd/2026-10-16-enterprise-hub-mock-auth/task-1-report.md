# Task 1 report: shared contracts, JWT configuration, and repeatable seed data

## Scope completed

- Added the shared `DepartmentSummary`, `AuthenticatedUser`, and `MockLoginResponse` contracts and re-exported them from `@enterprise-hub/shared`.
- Added required JWT configuration with a 24-character minimum secret and a default `JWT_EXPIRES_IN` of `1h`.
- Added local-only JWT example values to `.env.example`.
- Added a Prisma seed module that uses two fixed UUID department identities and three fixed email user identities. Departments are upserted by `id`; users are upserted by `email`.
- Added `tsx`, Prisma seed configuration, the API seed script, and the root dotenv-wrapped `pnpm prisma:seed` script.
- Adjusted the API Jest root from `src` to the API package so the required `prisma/seed.spec.ts` command can discover its test.

No Prisma schema or migration files were changed.

## Seed identities

| Entity | Identity | Values |
| --- | --- | --- |
| Department | `2d2e2c8a-f9bd-4d96-99bf-69cfb4950031` | Engineering |
| Department | `601dc8c4-2479-4af0-a32a-4b8f71b3d5d4` | Operations |
| User | `ada.lovelace@enterprise-hub.local` | Ada Lovelace, Engineering |
| User | `grace.hopper@enterprise-hub.local` | Grace Hopper, Operations |
| User | `linus.torvalds@enterprise-hub.local` | Linus Torvalds, Engineering |

## TDD evidence

### JWT validation

RED command:

```text
pnpm --filter @enterprise-hub/api test -- env.validation.spec.ts
```

Observed RED: the two newly added tests failed as expected before implementation. `validateEnvironment(baseEnvironment)` did not throw for a missing `JWT_SECRET`, and the valid secret result did not contain `JWT_EXPIRES_IN`.

GREEN command:

```text
pnpm --filter @enterprise-hub/api test -- env.validation.spec.ts
```

Observed GREEN: 1 suite passed, 7 tests passed.

### Idempotent seed

RED command:

```text
pnpm --filter @enterprise-hub/api test -- prisma/seed.spec.ts
```

The existing Jest `rootDir: 'src'` first reported no discoverable tests. After expanding it to the API package root, the required command failed as expected with `TS2307: Cannot find module './seed'`.

GREEN command:

```text
PATH="/Users/fhj/.nvm/versions/node/v22.23.2/bin:$PATH" pnpm --filter @enterprise-hub/api test -- env.validation.spec.ts prisma/seed.spec.ts
```

Observed GREEN: 2 suites passed, 8 tests passed. The seed test calls `seedDatabase` twice against a complete fake Prisma boundary and verifies four department upserts, six user upserts, and all three fixed email identities.

## Final verification

Commands were run with Node `v22.23.2` and pnpm `8.3.1`:

```text
pnpm prisma:generate
pnpm --filter @enterprise-hub/api test -- env.validation.spec.ts prisma/seed.spec.ts
pnpm --filter @enterprise-hub/api typecheck
pnpm prisma:migrate
pnpm prisma:seed
pnpm prisma:seed
pnpm --filter @enterprise-hub/api test
pnpm typecheck
git diff --check
```

Results:

- Prisma Client generated successfully.
- Targeted tests passed: 2 suites, 8 tests.
- API typecheck passed.
- A temporary isolated PostgreSQL 16 container on `127.0.0.1:55432` received the existing migration successfully, then the root dotenv-wrapped `pnpm prisma:seed` command completed twice successfully.
- Full API unit suite passed: 7 suites, 29 tests.
- Workspace typecheck passed for shared, API, and web packages.
- `git diff --check` completed without whitespace errors.

## Files changed

- `.env.example`
- `apps/api/jest.config.js`
- `apps/api/package.json`
- `apps/api/prisma/seed.spec.ts`
- `apps/api/prisma/seed.ts`
- `apps/api/src/common/config/env.validation.spec.ts`
- `apps/api/src/common/config/env.validation.ts`
- `package.json`
- `packages/shared/src/auth.ts`
- `packages/shared/src/index.ts`
- `pnpm-lock.yaml`

## Self-review

- `seedDatabase` is exported and import-safe; `main()` executes only when `seed.ts` is run directly.
- `main()` always disconnects the Prisma client via `finally`.
- Seed behavior is local-only and introduces no password, external provider, Passport, guard, role, task CRUD, SaaS credential, schema, or migration functionality.
- The fixed department UUIDs avoid relying on non-unique `Department.name`; user upserts rely on unique `User.email`.
- The added tests exercise configuration behavior and the Prisma boundary contract rather than source-text implementation details.

## Concerns

- The default root `.env` points to port 5432, which was occupied by an unrelated local PostgreSQL container. The required real migration and two seed executions were therefore verified through the unchanged root wrapper with a process-level `DATABASE_URL` override to an isolated temporary PostgreSQL instance on port 55432. The temporary container was removed afterward.
- The shell defaulted to Node 16, so the final dependency install and all final verification commands explicitly used the required Node 22.23.2 runtime.
