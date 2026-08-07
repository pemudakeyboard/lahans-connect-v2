# LAHANS Connect

HRIS PT Lahan Mekar Niaga (LMN Group) — monorepo.

| Layer  | Stack                                          | Path        |
| ------ | ---------------------------------------------- | ----------- |
| API    | NestJS 11 + Prisma 6 + PostgreSQL 16           | `apps/api`  |
| Web    | Next.js 15 (App Router) + React 19 + shadcn/ui | `apps/web`  |
| Mobile | Flutter — **deferred** (seam only)             | —           |
| Shared | workspace packages                             | `packages/` |

## Scope (milestone 1)

Foundation (BRD S0+S0b) + unblocked modules:

- **M8B — Format & Validasi**: format settings, validation rules, number sequences
- **M1B — Master Data**: generic schema-driven CRUD

Features baked in from the BRD:

- **ZERO HARDCODE** — policy numbers (`173`, `25`, `12`, `150000`, `2`, `7`, `30`) live in `system_parameters`, read via `ParameterService.resolve(key, asOf)`. Enforced by a custom ESLint rule (`lahans/no-magic-policy-numbers`).
- **Effective-dated parameters** (Class A/B) — `effective_from`/`effective_to` + gist `EXCLUDE` anti-overlap; every read requires `asOf`.
- **RBAC + ABAC** — permission registry `{module}.{resource}.{action}`, `data_scope`, deny-by-default, field masking.
- **calculation_trace** — JSONB trace for every financial number.
- **Append-only audit_logs** — `REVOKE UPDATE/DELETE`, partition-ready.
- **Indexing** — BRD §6.4 critical indexes + `effective_from` lookup indexes baked into migrations.

## Prerequisites

- Node.js ≥ 22 (built on **v24.13.1**)
- pnpm ≥ 9 (built on **11.9.0**)
- PostgreSQL 16 (local, via winget)

## Setup

```bash
pnpm install

# 1. Create the DB role + database once (needs superuser password)
psql -U postgres -c "CREATE ROLE lahans_app LOGIN PASSWORD 'LAHANS_DB_PASSWORD';"
psql -U postgres -c "CREATE DATABASE lahans_dev OWNER lahans_app;"

# 2. Point env at your DB
cp apps/api/.env.example apps/api/.env   # edit DATABASE_URL password

# 3. Migrate + seed
pnpm db:migrate
pnpm db:seed
```

## Run

```bash
pnpm dev            # API on :3001, web on :3000
```

- API docs (OpenAPI): `http://localhost:3001/api/docs`
- Web: `http://localhost:3000`
- Demo login: `admin@lahans.dev` / `Lahans@2026`

The web dev server proxies `/api/*` → `http://localhost:3001/api/v1/*` (BRD 7 global prefix).

## Quality gates (BRD §13)

```bash
pnpm gates          # lint + format + tests + build + DI boot
```

Gates enforced:

| Gate                  | Tool                              |
| --------------------- | --------------------------------- |
| Lint (BRD §13 #1, #2) | ESLint 9 + custom `lahans/` rules |
| Format                | Prettier (`format:check`)         |
| Unit tests            | Jest + ts-jest                    |
| Build API + web       | `tsc` + `next build`              |
| DI boot               | Nest app resolves all modules     |

Custom ESLint rules:

- `lahans/no-magic-policy-numbers` — flags `173`, `25`, `12`, `150000`, `2`, `7`, `30` as literals in production code (BRD §13 #1). Seed + tests exempt; structural uses (slicing, padStart, page size) exonerated.
- `lahans/no-group-name-checks` — flags `=== 'COMBEN'`-style group-code logic (BRD §13 #2); permission checks only.

## Docs

- [BRD](docs/BRD_LAHANS_Connect_v1.0.md) — including §13 Aturan Tegas
- [PRD](docs/PRD_LAHANS_Connect_v1.0.md)
- [Technical Decisions](docs/TECHNICAL_DECISIONS.md) — decisions locked during grilling
- [FR ↔ BR Mapping](docs/FR_BR_MAPPING.md) — functional requirements to build/BRD sections
