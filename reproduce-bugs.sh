#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# Phoenix Industrial Recovery Commander — Bug Reproduction Test Suite
# ═══════════════════════════════════════════════════════════════════════════
#
# Usage:  bash reproduce-bugs.sh
#
# Pre-requisites:
#   • Backend running:  cd backend && npm run dev
#   • Python 3 available (for JSON parsing)
#   • No special auth required — the bugs allow unauthenticated access
#
# The script tests each confirmed bug and exits 1 if any still present.
# ═══════════════════════════════════════════════════════════════════════════

set -uo pipefail
BASE="${BACKEND_URL:-http://localhost:3001}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PASS=0
FAIL=0
SKIP=0
JAR=$(mktemp /tmp/phoenix-cookie-XXXXXX.jar)
trap 'rm -f "$JAR"' EXIT

# ── Helpers ──────────────────────────────────────────────────────────────────
grn()  { echo -e "\033[32m  ✓ PASS\033[0m  $1"; ((PASS++)); }
red()  { echo -e "\033[31m  ✗ FAIL\033[0m  $1"; ((FAIL++)); }
warn() { echo -e "\033[33m  ⚠ SKIP\033[0m  $1"; ((SKIP++)); }
hdr()  { echo ""; echo -e "\033[34m══ $1 \033[0m"; }
info() { echo -e "       \033[2m$1\033[0m"; }

json_get() {
  # json_get <json_string> <key>  — simple extraction, no jq dependency
  python3 -c "import sys,json; d=json.loads(sys.argv[1]); print(d.get(sys.argv[2],''))" "$1" "$2" 2>/dev/null || echo ""
}

http_status() {
  curl -s -o /dev/null -w "%{http_code}" "$@"
}

# ── Connectivity check ────────────────────────────────────────────────────────
hdr "PRE-CHECK: Backend connectivity"
if ! STATUS=$(http_status "$BASE/health"); then
  echo -e "\033[31m  ERROR: Cannot reach $BASE/health — is the backend running?\033[0m"
  echo "  Run: cd backend && npm run dev"
  exit 1
fi
if [ "$STATUS" = "200" ]; then
  grn "Backend is reachable at $BASE"
else
  echo -e "\033[31m  ERROR: /health returned HTTP $STATUS\033[0m"
  exit 1
fi

# ─────────────────────────────────────────────────────────────────────────────
# BUG-001: GET /api/credentials/active/:agentId — no requireAuth
# Expected (fixed): 401
# Current (broken): 200 with full credential JSON
# ─────────────────────────────────────────────────────────────────────────────
hdr "BUG-001 · Unauthenticated Active Credential Endpoint"
info "File: backend/routes/credentials.js:80"
info "Calling GET /api/credentials/active/phoenix-port-01 without any session"

S=$(http_status "$BASE/api/credentials/active/phoenix-port-01")
BODY=$(curl -s "$BASE/api/credentials/active/phoenix-port-01")
info "Response HTTP $S: $(echo "$BODY" | python3 -c 'import sys,json; d=json.load(sys.stdin); print("credential_id=" + str(d.get("credential",{}).get("credential_id","null") if d.get("credential") else "null"))' 2>/dev/null || echo "$BODY" | head -c 80)"

if [ "$S" = "200" ]; then
  red "BUG-001 PRESENT: Credential data returned without authentication (HTTP 200)"
elif [ "$S" = "401" ]; then
  grn "BUG-001 FIXED: requireAuth returns 401 as expected"
else
  warn "BUG-001: Unexpected status $S"
fi

# ─────────────────────────────────────────────────────────────────────────────
# BUG-002a: GET /api/incident/active — no requireAuth
# ─────────────────────────────────────────────────────────────────────────────
hdr "BUG-002a · Unauthenticated GET /api/incident/active"
info "File: backend/routes/incident.js:147"

S=$(http_status "$BASE/api/incident/active")
if [ "$S" = "200" ]; then
  red "BUG-002a PRESENT: Incident list exposed without authentication (HTTP 200)"
elif [ "$S" = "401" ]; then
  grn "BUG-002a FIXED: Returns 401"
else
  warn "BUG-002a: Unexpected status $S"
fi

# ─────────────────────────────────────────────────────────────────────────────
# BUG-002b: POST /api/incident/start — no requireAuth
# ─────────────────────────────────────────────────────────────────────────────
hdr "BUG-002b · Unauthenticated POST /api/incident/start"
info "File: backend/routes/incident.js:34"
info "Starting INC-003 (port crane) without any login session"

RESP=$(curl -s -X POST "$BASE/api/incident/start" \
  -H "Content-Type: application/json" \
  -d '{"scenarioId":"INC-003"}')

ANON_INC=$(json_get "$RESP" "incidentId")
if [ -n "$ANON_INC" ]; then
  red "BUG-002b PRESENT: Incident $ANON_INC started without authentication"
  info "Cancelling the leaked incident..."
  curl -s -X POST "$BASE/api/incident/cancel" \
    -H "Content-Type: application/json" \
    -d "{\"incidentId\":\"$ANON_INC\"}" > /dev/null
elif echo "$RESP" | grep -q "401\|Authentication"; then
  grn "BUG-002b FIXED: Returns 401 for unauthenticated request"
else
  warn "BUG-002b: Unexpected response: $(echo "$RESP" | head -c 80)"
fi

# ─────────────────────────────────────────────────────────────────────────────
# BUG-002c: GET /api/incident/scenarios — no requireAuth
# ─────────────────────────────────────────────────────────────────────────────
hdr "BUG-002c · Unauthenticated GET /api/incident/scenarios"
info "File: backend/routes/incident.js:181"

S=$(http_status "$BASE/api/incident/scenarios")
if [ "$S" = "200" ]; then
  warn "BUG-002c NOTE: Scenarios are publicly readable (may be intentional)"
else
  grn "BUG-002c: Scenarios require auth (HTTP $S)"
fi

# ─────────────────────────────────────────────────────────────────────────────
# BUG-004: Hardcoded session secret fallback
# ─────────────────────────────────────────────────────────────────────────────
hdr "BUG-004 · Hardcoded Session Secret Fallback"
info "File: backend/server.js:37"

if grep -q "phoenix-secret-change-me" "$ROOT/backend/server.js" 2>/dev/null; then
  red "BUG-004 PRESENT: Hardcoded fallback secret 'phoenix-secret-change-me' in server.js:37"
else
  grn "BUG-004 FIXED: No hardcoded fallback secret found"
fi

# ─────────────────────────────────────────────────────────────────────────────
# BUG-006: Session cookie missing secure flag
# ─────────────────────────────────────────────────────────────────────────────
hdr "BUG-006 · Session Cookie Missing 'secure' Flag"
info "File: backend/server.js:39-43"

if grep -qE "secure\s*:" "$ROOT/backend/server.js" 2>/dev/null; then
  grn "BUG-006 FIXED: 'secure:' flag present in session cookie config"
else
  red "BUG-006 PRESENT: Session cookie config has no 'secure:' field (server.js:39-43)"
fi

# ─────────────────────────────────────────────────────────────────────────────
# BUG-005: checkPermission fail-open for unknown scenarios
# ─────────────────────────────────────────────────────────────────────────────
hdr "BUG-005 · Permission Check Fail-Open for Unknown Scenario"
info "File: backend/middleware/checkPermission.js:18-19"

FAILOPEN=$(node -e "
const { checkCredentialPermission } = require('./backend/middleware/checkPermission');
const r = checkCredentialPermission('INC-UNKNOWN-999', 'ENGAGE_BACKUP_CRANE');
process.stdout.write(String(r.permitted));
" 2>/dev/null || echo "error")

if [ "$FAILOPEN" = "true" ]; then
  red "BUG-005 PRESENT: Unknown scenario 'INC-UNKNOWN-999' returns permitted=true (fail-open)"
elif [ "$FAILOPEN" = "false" ]; then
  grn "BUG-005 FIXED: Unknown scenario returns permitted=false (fail-closed)"
else
  warn "BUG-005: Could not evaluate (node error or module path issue)"
fi

# ─────────────────────────────────────────────────────────────────────────────
# BUG-008: expiresInHours negative value accepted
# ─────────────────────────────────────────────────────────────────────────────
hdr "BUG-008 · Credential Expiry — No Range Validation"
info "File: backend/routes/credentials.js:11"

# Need a valid session first
LOGIN=$(curl -s -c "$JAR" -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"roleId":"harbor_master"}')
LOGGED_IN=$(json_get "$LOGIN" "success")

if [ "$LOGGED_IN" = "True" ] || echo "$LOGIN" | grep -q '"success":true'; then
  info "Logged in as harbor_master — testing negative expiresInHours=-1"

  NEG_RESP=$(curl -s -b "$JAR" -X POST "$BASE/api/credentials/issue" \
    -H "Content-Type: application/json" \
    -d '{"agentId":"phoenix-port-01","permissions":["HALT_BERTH_7_OPERATIONS"],"expiresInHours":-1}')

  if echo "$NEG_RESP" | grep -q '"credential_id"'; then
    red "BUG-008a PRESENT: Credential issued with expiresInHours=-1 (already expired at creation)"
    CRED_ID=$(python3 -c "import sys,json; d=json.loads('$NEG_RESP'); c=d.get('credential',{}); print(c.get('credential_id',''))" 2>/dev/null || echo "")
    [ -n "$CRED_ID" ] && info "Created credential: $CRED_ID (expires_at is in the past)"
  else
    grn "BUG-008a FIXED: Negative expiresInHours rejected"
  fi

  HUGE_RESP=$(curl -s -b "$JAR" -X POST "$BASE/api/credentials/issue" \
    -H "Content-Type: application/json" \
    -d '{"agentId":"phoenix-port-01","permissions":["HALT_BERTH_7_OPERATIONS"],"expiresInHours":876000}')

  if echo "$HUGE_RESP" | grep -q '"credential_id"'; then
    red "BUG-008b PRESENT: Credential issued with expiresInHours=876000 (~100 years)"
  else
    grn "BUG-008b FIXED: Excessive expiresInHours rejected"
  fi
else
  warn "BUG-008: Could not log in to test credential issuance (response: $(echo "$LOGIN" | head -c 80))"
fi

# ─────────────────────────────────────────────────────────────────────────────
# BUG-011: Zero-credential login — all role IDs publicly enumerable
# ─────────────────────────────────────────────────────────────────────────────
hdr "BUG-011 · Zero-Credential Login — Role IDs Publicly Enumerable"
info "File: backend/routes/auth.js:26-38"

ROLES_STATUS=$(http_status "$BASE/api/auth/roles")
if [ "$ROLES_STATUS" = "200" ]; then
  ROLES_BODY=$(curl -s "$BASE/api/auth/roles")
  COUNT=$(echo "$ROLES_BODY" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "?")
  red "BUG-011a PRESENT: GET /api/auth/roles (no auth) returns $COUNT role IDs"

  info "Attempting login as harbor_master using only the role ID string..."
  PWLESS=$(curl -s -X POST "$BASE/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"roleId":"harbor_master"}')
  if echo "$PWLESS" | grep -q '"authority_level":"LEVEL_3"'; then
    red "BUG-011b PRESENT: LEVEL_3 authority granted with zero credentials (no password)"
  else
    grn "BUG-011b FIXED: Login requires more than just roleId"
  fi
else
  grn "BUG-011a FIXED: GET /api/auth/roles requires auth (HTTP $ROLES_STATUS)"
fi

# ─────────────────────────────────────────────────────────────────────────────
# BUG-013: Rejection leaves incident permanently blocked
# ─────────────────────────────────────────────────────────────────────────────
hdr "BUG-013 · Rejection Causes Permanent Deadlock"
info "File: backend/routes/agent.js:280-284"
info "Starting INC-001 and waiting up to 25s for it to reach 'blocked' state..."
info "(INC-001 blocks on RESTART_PRIMARY_COOLING — usually step 5)"

RESP=$(curl -s -X POST "$BASE/api/incident/start" \
  -H "Content-Type: application/json" \
  -d '{"scenarioId":"INC-001"}')
TEST_INC=$(json_get "$RESP" "incidentId")

if [ -n "$TEST_INC" ]; then
  BLOCKED_STATUS=""
  PENDING_ACTION=""
  for i in $(seq 1 25); do
    sleep 1
    SDATA=$(curl -s "$BASE/api/incident/status/$TEST_INC")
    BLOCKED_STATUS=$(json_get "$SDATA" "status")
    if [ "$BLOCKED_STATUS" = "blocked" ]; then
      PENDING_ACTION=$(python3 -c "
import sys, json
d = json.loads('$(echo "$SDATA" | python3 -c "import sys; print(sys.stdin.read().replace(chr(39), chr(34))" 2>/dev/null || echo "{}")')
esc = d.get('pendingEscalation') or {}
print(esc.get('action', ''))
" 2>/dev/null || echo "")
      break
    fi
  done

  if [ "$BLOCKED_STATUS" = "blocked" ] && [ -n "$PENDING_ACTION" ]; then
    info "Incident $TEST_INC blocked on: $PENDING_ACTION — sending rejection..."
    curl -s -X POST "$BASE/api/agent/reject-escalation" \
      -H "Content-Type: application/json" \
      -d "{\"incidentId\":\"$TEST_INC\",\"action\":\"$PENDING_ACTION\",\"rejectedBy\":\"BugTest\"}" > /dev/null
    sleep 4
    AFTER_STATUS=$(json_get "$(curl -s "$BASE/api/incident/status/$TEST_INC")" "status")
    if [ "$AFTER_STATUS" = "blocked" ]; then
      red "BUG-013 PRESENT: Incident $TEST_INC permanently blocked after rejection (status=$AFTER_STATUS)"
    else
      grn "BUG-013 FIXED: Incident continued after rejection (status=$AFTER_STATUS)"
    fi
  elif [ "$BLOCKED_STATUS" = "complete" ]; then
    warn "BUG-013: INC-001 completed before reaching blocked state — cannot test rejection"
  else
    warn "BUG-013: Incident did not reach blocked state in 25s (status=$BLOCKED_STATUS)"
  fi

  curl -s -X POST "$BASE/api/incident/cancel" \
    -H "Content-Type: application/json" \
    -d "{\"incidentId\":\"$TEST_INC\"}" > /dev/null 2>&1 || true
else
  warn "BUG-013: Could not start test incident"
fi

# ─────────────────────────────────────────────────────────────────────────────
# BUG-007: Incident lost after server restart
# ─────────────────────────────────────────────────────────────────────────────
hdr "BUG-007 · Incident Lost on Server Restart"
info "File: backend/routes/incident.js:15"
info "This test cannot auto-restart the server — manual verification needed."
info ""
info "  Manual steps:"
info "  1. Start an incident:  curl -X POST $BASE/api/incident/start -d '{\"scenarioId\":\"INC-001\"}'"
info "  2. Restart the backend (Ctrl+C in backend terminal, npm run dev)"
info "  3. Poll the incident:  curl $BASE/api/incident/status/<incidentId>"
info "  4. Expected (broken): 404 — incident lost from memory"
info "  5. Expected (fixed):  incident state restored from DB"
warn "BUG-007: Manual verification required (see above steps)"

# ─────────────────────────────────────────────────────────────────────────────
# BUG-009: Telemetry overshoot
# ─────────────────────────────────────────────────────────────────────────────
hdr "BUG-009 · Telemetry Computation Overshoot"
info "File: backend/agent/reasoningEngine.js:183-184"

OVERSHOOT=$(node -e "
const { computeUpdatedTelemetry } = require('./backend/agent/reasoningEngine');
const { getScenario } = require('./backend/agent/playbook');
const scenario = getScenario('INC-001');
const initial  = { temperature: 94, pressure: 112, coolant_flow: 12, recovery_progress: 0 };
const fakeSteps = Array(6).fill({ action: 'X' });
const result = computeUpdatedTelemetry(scenario, fakeSteps, initial);
const coolantTarget = scenario.telemetryTargets.coolant_flow;
process.stdout.write(result.coolant_flow > coolantTarget ? 'OVERSHOOT' : 'OK');
" 2>/dev/null || echo "error")

if [ "$OVERSHOOT" = "OVERSHOOT" ]; then
  red "BUG-009 PRESENT: coolant_flow overshoots target of 48 L/min after 6 steps"
elif [ "$OVERSHOOT" = "OK" ]; then
  grn "BUG-009 FIXED: telemetry stays within target bounds"
else
  warn "BUG-009: Could not evaluate (node error)"
fi

# ─────────────────────────────────────────────────────────────────────────────
# BUG-014: Tailwind dynamic class names in production build
# ─────────────────────────────────────────────────────────────────────────────
hdr "BUG-014 · Tailwind Dynamic Class Names Purged From Production Build"
info "File: frontend/src/pages/LandingPage.jsx:117-127"

DIST="$ROOT/frontend/dist/assets"
if [ -d "$DIST" ]; then
  CSS_COUNT=$(grep -rEc "bg-blue-500|bg-purple-500|bg-amber-500|bg-cyan-500|bg-green-500|bg-red-500" "$DIST"/*.css 2>/dev/null | awk -F: '{s+=$2} END {print s+0}')
  if [ "$CSS_COUNT" -eq 0 ]; then
    red "BUG-014 PRESENT: No accent color classes (bg-*-500) found in production CSS — dynamic classes were purged"
  else
    grn "BUG-014 FIXED: $CSS_COUNT accent class references found in production CSS bundle"
  fi
else
  info "No production build found. Run: cd frontend && npm run build"
  warn "BUG-014: Build first to test (cd frontend && npm run build)"
fi

# ─────────────────────────────────────────────────────────────────────────────
# GAP-001: MCP server endpoints
# ─────────────────────────────────────────────────────────────────────────────
hdr "GAP-001 · MCP Server Not Implemented"
info "Document §8 requires /mcp/tools, /mcp/actions, /mcp/incidents, /mcp/audit"

MCP_S=$(http_status "$BASE/mcp/tools")
[ "$MCP_S" = "404" ] \
  && red "GAP-001 PRESENT: /mcp/tools returns 404 — MCP server not implemented" \
  || grn "GAP-001 RESOLVED: /mcp/tools returns HTTP $MCP_S"

# ─────────────────────────────────────────────────────────────────────────────
# GAP-004: Docker/infrastructure files
# ─────────────────────────────────────────────────────────────────────────────
hdr "GAP-004 · Docker / Redis / BullMQ Infrastructure Not Present"
info "Document §12 requires Dockerfile, docker-compose.yml, Redis, BullMQ"

if [ -f "$ROOT/Dockerfile" ] || [ -f "$ROOT/docker-compose.yml" ]; then
  grn "GAP-004 RESOLVED: Docker files found"
else
  red "GAP-004 PRESENT: No Dockerfile or docker-compose.yml in project root"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Results
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════════════════"
echo ""
echo -e "  \033[32mPASS\033[0m  $PASS"
echo -e "  \033[31mFAIL\033[0m  $FAIL"
echo -e "  \033[33mSKIP\033[0m  $SKIP"
echo ""
echo "══════════════════════════════════════════════════════════════════"

if [ "$FAIL" -gt 0 ]; then
  echo -e "\n  \033[31m$FAIL bug(s) confirmed present. See bug-report.html for fixes.\033[0m\n"
  exit 1
else
  echo -e "\n  \033[32mAll tested bugs are fixed or not applicable.\033[0m\n"
  exit 0
fi
