# Technical Decisions — LAHANS Connect

Decisions locked during the grilling pass (31 total). Confirmed by the user before
building. Each decision maps to why + how it's enforced in the code.

## D-01 Scope

**Decision:** Foundation (S0+S0b) + unblocked modules M8B (Format & Validasi) + M1B (Master Data generic CRUD).
**Why:** Deliver real value without waiting on Open Questions. Payroll/attendance/leave modules are shells pending their business inputs.
**How:** `apps/api/src/modules/{config,master}`; `master-registry.ts` is the extension point.

## D-02 Local database

**Decision:** PostgreSQL 16 via winget.
**How:** installed locally; `DATABASE_URL` in `apps/api/.env`.

## D-03 Mobile

**Decision:** Flutter deferred (seam only). Web first.
**How:** `me/navigation` returns `platform` so mobile can consume later; no Flutter code yet.

## D-04 Dev database

**Decision:** Postgres only (no SQLite in API).
**How:** `prisma/schema.prisma` targets Postgres; tests use pg-mem.

## D-05 Repository structure

**Decision:** Monorepo + git init.
**How:** pnpm workspaces (`apps/api`, `apps/web`, `packages/*`).

## D-06 Foundation

**Decision:** Full S0+S0b stack (auth, RBAC, audit, config, temporal, calc trace).
**How:** see `apps/api/src/core/**`.

## D-07 Package manager

**Decision:** pnpm.
**How:** `pnpm-workspace.yaml`; `packageManager: pnpm@11.9.0`.

## D-08 Versions

**Decision:** NestJS 11 + Prisma 6.
**How:** `@nestjs/*@^11`, `prisma@6`.

## D-09 Web stack

**Decision:** Next.js 15 + shadcn/ui.
**How:** `apps/web` App Router, React 19, Tailwind + shadcn base components.

## D-10 Redis

**Decision:** Deferred — seam only.
**How:** no Redis dependency; cache TTL surfaced in API responses (`cache_ttl_seconds`) for a future cache layer.

## D-11 Object storage

**Decision:** LocalDiskDriver + S3 stub.
**How:** `STORAGE_DRIVER` env; `storage-local/` gitignored.

## D-12 CI/CD

**Decision:** Quality gates + GH Actions workflow.
**How:** `.github/workflows/ci.yml`; `scripts/gates.sh`.

## D-13 Testing

**Decision:** Jest + pg-mem + Playwright scaffold.
**How:** `jest.config.js` (ts-jest), pg-mem devDep; Playwright workflows scaffolded but gated off until DB is wired.

## D-14 Auth

**Decision:** JWT + Argon2id + TOTP.
**How:** `@nestjs/jwt`, `@node-rs/argon2`, `otplib`; access/refresh rotation.

## D-15 Modules

**Decision:** M8B + M1B.
**How:** `apps/api/src/modules/config`, `apps/api/src/modules/master`.

## D-16 Lint

**Decision:** ESLint 9 + Prettier + custom gates.
**How:** flat config; two custom rules enforcing BRD §13 #1/#2.

## D-17 Environment config

**Decision:** `@nestjs/config`, infra-only env.
**How:** `ApiConfigService`; `.env` holds credentials only (BRD §13 #1).

## D-18 API conventions

**Decision:** BRD 7.4 conventions + OpenAPI.
**How:** global prefix `api/v1`, error envelope `{ error: { code, message, details } }`, Swagger at `/api/docs`.

## D-19 Seeding

**Decision:** Full idempotent seed.
**How:** `apps/api/prisma/seed.ts` — permissions, groups, reference data, system_parameters, org master data, demo admin.

## D-20 M1B CRUD

**Decision:** Generic schema-driven CRUD.
**How:** `master-registry.ts` + `MasterService` (list/getOne/create/update/remove), per-resource permission enforcement.

## D-21 Effective-dated

**Decision:** Full effective-dated + gist EXCLUDE.
**How:** `temporal-resolver.ts`; `asOf` required (BRD 4.5.1); gist anti-overlap constraint in migrations.

## D-22 Resolver

**Decision:** Typed resolver + lint guard.
**How:** `TemporalResolver.findActive/list`; unit-tested.

## D-23 calculation_trace

**Decision:** Trace builder + JSONB columns.
**How:** `core/rules/calculation-trace.ts`; audit interceptor writes `after_data`.

## D-24 Audit

**Decision:** Append-only + interceptor + partition.
**How:** `audit.interceptor.ts`; `audit_logs` REVOKE UPDATE/DELETE; monthly partition plan.

## D-25 Config API

**Decision:** Full M8B + M1B API.
**How:** `config.controller.ts`, `master.controller.ts`.

## D-26 Web UI

**Decision:** M8B + M1B web screens.
**How:** `apps/web/app/(app)/**` — formats, validation, sequences, master CRUD.

## D-27 Enforcement

**Decision:** Full gate set.
**How:** `scripts/gates.sh` + CI.

## D-28 Docs

**Decision:** Decisions + README + mapping.
**How:** this file + `FR_BR_MAPPING.md`.

## D-29 Argon2

**Decision:** `@node-rs/argon2`.
**How:** native, `outputLen`, memoryCost 64 MiB.

## D-30 Magic rule

**Decision:** Targeted policy-number rule.
**How:** `eslint-rules/no-magic-policy-numbers.js` — flags only the BRD-named numbers in production code.

## D-31 Test data

**Decision:** User provides real dirty fixture.
**How:** pending; seed has demo data as placeholder.

---

## Open Questions deferred (not blockers for this milestone)

- Hosting/environment (D-01)
- Entity scope (LMN only vs + LMI + Pabrik)
- Full employee master data
- Work schedule/shift definitions
