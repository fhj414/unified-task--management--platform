# Enterprise Hub Mock JWT Authentication Design

## Purpose

Introduce a local-only authentication increment that exercises Prisma-backed
identity lookup, NestJS request guards, JWT issuance and verification, and a
minimal Vue login flow. It creates a stable identity boundary for later user,
department, and task APIs without connecting to DingTalk or implementing a
production account system.

## Scope

This increment adds:

- idempotent Prisma seed data for two departments and three demo users;
- mock-user discovery, mock login, and current-user API endpoints;
- short-lived JWTs verified by a focused NestJS guard;
- a Pinia auth store and a small user-selection login screen;
- Swagger, README, environment-template, unit, endpoint, and web-store
  coverage for the new public contract.

It does not add passwords, registration, roles, refresh tokens, real DingTalk
OAuth/callbacks, external SaaS credentials, task CRUD, or a global
authorization policy.

## Existing Data Model and Seed Data

The existing `Department` and `User` models already contain the fields needed
for mock identity. No schema change or migration is required.

`apps/api/prisma/seed.ts` will upsert two departments and three users by their
stable names and unique email addresses. Each user belongs to one seeded
department. The seed command must be repeatable and will be exposed as
`pnpm prisma:seed` after migrations have run.

The seed script is local-development data only. It does not create passwords,
hashes, credentials, or a production administrator.

## Authentication API

The `auth` module will expose these endpoints:

| Endpoint | Access | Request | Response |
| --- | --- | --- | --- |
| `GET /auth/mock-users` | public | none | seeded users with department summary |
| `POST /auth/mock-login` | public | `{ email: string }` | `{ accessToken, user }` |
| `GET /auth/me` | JWT required | Bearer token | current user with department summary |

`POST /auth/mock-login` looks up a seeded user by email and signs a JWT with
the user ID and email. An unknown user returns the existing standardized 401
response. `GET /auth/me` verifies the Bearer token, re-reads the user from
Prisma, and returns 401 when the token is missing, invalid, expired, or refers
to a user that no longer exists.

Health checks and mock-login endpoints remain public. The guard is attached
only to `/auth/me`; later feature endpoints opt in explicitly until an
application-wide authorization policy is deliberately introduced.

## Configuration and Implementation Boundaries

The API gains `JWT_SECRET` and a bounded JWT expiry setting, both validated at
startup. The expiry accepts supported duration syntax from one minute through
24 hours, inclusive, and defaults to one hour. `.env.example` supplies a
clearly local-development secret. Runtime JWT work uses `@nestjs/jwt` plus a
small project guard instead of Passport, so the authentication boundary
remains easy to inspect and replace.

The auth service owns user lookup and token issuance. The guard owns header
parsing and token verification, and it attaches a small authenticated-user
context to the request. Controllers only map validated requests to documented
DTOs. Shared contracts expose only response shapes used by both API and web;
server implementation details stay in the API app.

## Web Flow

The web app receives an auth Pinia store. On first load it checks for a token
in `sessionStorage` and validates it through `/auth/me`. When absent or
invalid, it renders a small login panel that loads `/auth/mock-users` and lets
the developer select an account. A successful login stores the token for the
browser session and switches to the existing preview dashboard, which displays
the current user.

Authentication requests add the Bearer token only when it exists. `/health`
remains anonymous and continues to drive the existing connection-status card.
This increment does not introduce Vue Router, a registration page, or a
full-screen account-management experience.

## Errors, Documentation, and Testing

Authentication failures use the existing global exception format and do not
return token-verification details. Swagger documents the three endpoints,
request/response DTOs, and Bearer security requirement. README documents the
seed command, mock-only boundary, login flow, and required environment values.

Tests cover seed idempotency at the service/script boundary where practical,
auth-service success and unknown-user behavior, guard invalid-token handling,
and endpoint flows for login, unauthenticated `/auth/me`, authenticated
`/auth/me`, and invalid/unknown identities. Web tests cover restoring a valid
session, clearing an invalid one, and login state transitions. The full
typecheck, build, unit, endpoint, and Prisma seed verification commands remain
required before completion.
