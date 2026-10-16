# Task 2 Report: NestJS mock-login API and JWT guard

## Outcome

Implemented the local-development mock JWT API:

- Public `GET /auth/mock-users` and `POST /auth/mock-login`.
- Endpoint-scoped JWT protection for `GET /auth/me` only.
- Shared-shape DTOs with Swagger documentation, including Bearer security only on `/auth/me`.
- `AuthService` mapping that selects and returns only public user/department fields.
- Complete fixture-based e2e coverage with the real JWT module and guard; no live database is required.

## RED/GREEN evidence

### Service tests

1. RED command:

   ```sh
   pnpm --filter @enterprise-hub/api test -- auth.service.spec.ts
   ```

   Result: failed at test compilation because `@nestjs/jwt` and `./auth.service` did not exist (`TS2307`).

2. GREEN command:

   ```sh
   PATH="/Users/fhj/.nvm/versions/node/v22.23.2/bin:$PATH" pnpm --filter @enterprise-hub/api test -- auth.service.spec.ts
   ```

   Result: `PASS src/auth/auth.service.spec.ts`, 5 tests passed. This covers public mapping without timestamps, login JWT payload/response, unknown login, current user, and missing current user.

### Guard and endpoint tests

1. RED command:

   ```sh
   pnpm --filter @enterprise-hub/api test -- jwt-auth.guard.spec.ts
   ```

   Result: failed at test compilation because `./jwt-auth.guard` did not exist (`TS2307`).

2. Endpoint test setup was created before controller implementation. Its first in-sandbox execution exposed the platform's temporary-listener restriction (`listen EPERM: operation not permitted 0.0.0.0`), not an application behavior result. The same fixture-based test was then run outside the sandbox, with no database connection.

3. Mutation check (RED): temporarily unregistered `AuthController` from `AuthModule`, then ran:

   ```sh
   PATH="/Users/fhj/.nvm/versions/node/v22.23.2/bin:$PATH" pnpm --filter @enterprise-hub/api test:e2e -- auth.e2e-spec.ts
   ```

   Result: all seven e2e checks failed as expected: the route checks received `404` instead of `200`/`201`/`401`, and Swagger lacked `/auth/mock-users`. The controller registration was immediately restored.

4. Final GREEN command/output:

   ```sh
   PATH="/Users/fhj/.nvm/versions/node/v22.23.2/bin:$PATH" pnpm --filter @enterprise-hub/api test -- auth.service.spec.ts jwt-auth.guard.spec.ts
   PATH="/Users/fhj/.nvm/versions/node/v22.23.2/bin:$PATH" pnpm --filter @enterprise-hub/api test:e2e -- auth.e2e-spec.ts
   ```

   Output: unit tests passed `2/2` suites and `8/8` tests; e2e passed `1/1` suite and `7/7` tests. The e2e suite covers mock-user listing, valid/unknown login, missing/valid/invalid token handling, exception-filter response shapes, no leaked JWT verification details, and Swagger endpoint/Bearer security metadata.

## Additional verification

```sh
PATH="/Users/fhj/.nvm/versions/node/v22.23.2/bin:$PATH" pnpm --filter @enterprise-hub/api typecheck
PATH="/Users/fhj/.nvm/versions/node/v22.23.2/bin:$PATH" pnpm --filter @enterprise-hub/api build
git diff --check
```

All commands completed with exit status 0. E2e commands were run outside the filesystem sandbox solely because Supertest needs to bind a temporary local listener.

## Changed files

- `apps/api/package.json` and `pnpm-lock.yaml`: add `@nestjs/jwt`.
- `apps/api/src/app.configuration.ts`: declare the Swagger Bearer scheme.
- `apps/api/src/auth/auth.module.ts`: configure `JwtModule` from validated config and register auth components.
- `apps/api/src/auth/auth.service.ts`: mock-user lookup, login JWT issuance, current-user lookup, and public data mapping.
- `apps/api/src/auth/auth.controller.ts`: the three scoped API endpoints and Swagger metadata.
- `apps/api/src/auth/jwt-auth.guard.ts`: exact single-Bearer parsing, JWT verification, request identity attachment, and safe 401 errors.
- `apps/api/src/auth/dto/*.ts`: validated login input and Swagger response DTOs.
- `apps/api/src/auth/auth.service.spec.ts` and `jwt-auth.guard.spec.ts`: service and guard unit coverage.
- `apps/api/test/auth.e2e-spec.ts`: app-level contract tests with complete Prisma user/department fixtures.

## Self-review

- Verified no Prisma schema or migration changes.
- Verified `/health`, mock-user list, and mock login remain public; `@UseGuards(JwtAuthGuard)` appears only on `/auth/me`.
- Verified the e2e app overrides `PrismaService` with users that include nullable and populated department data, while using the real JWT module/guard.
- Verified raw Prisma timestamps and JWT verification details never reach public responses.
- Verified guard payload contains string `sub` and `email`; malformed or failed verification returns a public `UnauthorizedException`.
- Verified Swagger contains response schemas for all auth endpoints and declares route security only for `/auth/me`.
- Verified diff has no whitespace errors.

## Concerns

- The shell default was Node 16.20.2 while the repository requires Node 22; all final verification used the installed Node 22.23.2 explicitly.
- Supertest cannot bind its temporary listener inside the sandbox. E2e verification therefore required the approved outside-sandbox execution, while still using only in-memory fixtures and no live database.
