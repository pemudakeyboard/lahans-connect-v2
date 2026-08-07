#!/usr/bin/env bash
# =============================================================================
# LAHANS CONNECT — Quality gates (BRD §13 "Aturan Tegas")
#
# Runs every gate that a merge/release must pass. A failure here is a blocker.
#
# Gates:
#   1. ESLint (custom rules enforce BRD §13 #1 no-policy-literals, #2 no-groups)
#   2. Prettier format check
#   3. Unit tests (Jest)
#   4. TypeScript build (API: tsc; Web: next build)
#   5. DI boot check (API wires all modules/guards)
#
# Exit code 0 = all gates green. Non-zero = blocker; fix before merge.
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0

step() {
  echo ""
  echo "────────────────────────────────────────────────────────────"
  echo "  ▶ $1"
  echo "────────────────────────────────────────────────────────────"
}

ok()   { echo "  ✔ $1"; PASS=$((PASS + 1)); }
fail() { echo "  ✖ $1"; FAIL=$((FAIL + 1)); }

# --- 1. Lint (whole monorepo) ----------------------------------------------
step "Lint (BRD §13 #1, #2 via custom rules)"
if pnpm -r lint; then ok "lint"; else fail "lint"; fi

# --- 2. Format check --------------------------------------------------------
step "Prettier format check"
if pnpm format:check; then ok "format"; else fail "format"; fi

# --- 3. Unit tests ----------------------------------------------------------
step "Unit tests"
if pnpm -r test; then ok "unit tests"; else fail "unit tests"; fi

# --- 4. Builds --------------------------------------------------------------
step "Build: API + web"
if pnpm -r build; then ok "build"; else fail "build"; fi

# --- 5. API DI boot check ---------------------------------------------------
step "API DI boot (all modules/guards resolve)"
if (cd apps/api && node -e "
  require('ts-node/register');
  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require('./src/app.module');
  NestFactory.create(AppModule)
    .then((app) => { console.log('DI_RESOLUTION_OK'); return app.close(); })
    .catch((e) => { console.error('DI_RESOLUTION_FAIL', e.message); process.exit(1); });
"); then ok "DI boot"; else fail "DI boot"; fi

echo ""
echo "════════════════════════════════════════════════════════"
echo "  GATES: ${PASS} passed, ${FAIL} failed"
echo "════════════════════════════════════════════════════════"
[ "$FAIL" -eq 0 ]