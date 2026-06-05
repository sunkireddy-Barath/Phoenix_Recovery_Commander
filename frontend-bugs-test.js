/**
 * Phoenix IRC — Frontend Bug Analysis Script
 *
 * Usage (from project root):
 *   node frontend-bugs-test.js
 *
 * Checks:
 *   BUG-014 — Dynamic Tailwind class names in LandingPage.jsx
 *   BUG-015 — Polling does not stop on incident completion
 *   GAP-006 — Hardcoded stats on landing page
 */

'use strict';

const fs   = require('fs');
const path = require('path');

let PASS = 0, FAIL = 0;
const grn = (msg) => { console.log(`  \x1b[32m✓ PASS\x1b[0m  ${msg}`); PASS++; };
const red = (msg) => { console.log(`  \x1b[31m✗ FAIL\x1b[0m  ${msg}`); FAIL++; };
const hdr = (msg) => { console.log(`\n\x1b[34m══ ${msg} \x1b[0m`); };
const inf = (msg) => { console.log(`       \x1b[2m${msg}\x1b[0m`); };

const FRONTEND_SRC = path.join(__dirname, 'frontend', 'src');

function readFile(rel) {
  const full = path.join(FRONTEND_SRC, rel);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// BUG-014: Dynamic Tailwind class names
// ─────────────────────────────────────────────────────────────────────────────
hdr('BUG-014 · Dynamic Tailwind Class Names in Source');
inf('File: frontend/src/pages/LandingPage.jsx');

const landing = readFile('pages/LandingPage.jsx');
if (!landing) {
  red('BUG-014: Could not read LandingPage.jsx');
} else {
  // Patterns that break Tailwind JIT
  const dynamicPatterns = [
    /`bg-\${[^}]+}-\d{3}/g,
    /`hover:border-\${[^}]+}-\d{3}/g,
    /`text-\${[^}]+}-\d{3}/g,
    /`border-\${[^}]+}-\d{3}/g,
    /`bg-\${[^}]+}-500\/\d+`/g,
  ];

  const found = [];
  for (const pattern of dynamicPatterns) {
    const matches = landing.match(pattern) || [];
    found.push(...matches);
  }

  if (found.length > 0) {
    red(`BUG-014 PRESENT: ${found.length} dynamic Tailwind class template(s) found:`);
    [...new Set(found)].slice(0, 6).forEach(m => inf(`  → ${m.replace(/\n/g, '')}`));
    inf('These will be stripped from the production CSS bundle.');
    inf('Fix: replace with a static lookup map:');
    inf('  const ACCENT = { blue: "bg-blue-500/10 text-blue-400 border-blue-500/20", ... }');
  } else {
    grn('BUG-014 FIXED: No dynamic Tailwind class template literals found');
  }

  // Also check ArchFlow component
  const archFlowPattern = /\$\{s\.color\}/;
  if (archFlowPattern.test(landing)) {
    red('BUG-014 ALSO in ArchFlow: ${s.color} used in class name template');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BUG-015: Polling continues after incident completion
// ─────────────────────────────────────────────────────────────────────────────
hdr('BUG-015 · Polling Does Not Stop When Incident Completes');
inf('File: frontend/src/App.jsx');

const appJsx = readFile('../App.jsx') || readFile('App.jsx');
if (!appJsx) {
  red('BUG-015: Could not read App.jsx');
} else {
  // Check if there's a clearInterval inside the poll callback
  const pollBlock = appJsx.match(/const poll = async[\s\S]*?setInterval\(poll/)?.[0] || '';
  const hasClearInPoll = /clearInterval/.test(pollBlock);

  if (!hasClearInPoll) {
    // Check if there's any condition to stop polling based on status
    const hasStopCondition = /status.*complete.*clearInterval|clearInterval.*status.*complete/is.test(appJsx);
    if (!hasStopCondition) {
      red('BUG-015 PRESENT: Polling interval never cleared when incident reaches "complete" status');
      inf('The setInterval fires every 1500ms until resetIncident() is called manually.');
      inf('Fix: add clearInterval(pollRef.current) when inc.status === "complete"');
    } else {
      grn('BUG-015 FIXED: Polling has a stop condition for completed incidents');
    }
  } else {
    grn('BUG-015 FIXED: clearInterval called inside poll callback');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GAP-006: Hardcoded landing page stats
// ─────────────────────────────────────────────────────────────────────────────
hdr('GAP-006 · Hardcoded Statistics on Landing Page');
inf('File: frontend/src/pages/LandingPage.jsx');

if (landing) {
  const hardcodedMetrics = [
    { pattern: /'4'\s*,?\s*unit:\s*'ONLINE'|value:\s*'4'.*ONLINE/, label: 'ACTIVE AGENTS: 4 (hardcoded)' },
    { pattern: /'12'\s*,?\s*unit:\s*'RESOLVED'|value:\s*'12'.*RESOLVED/, label: 'INCIDENTS TODAY: 12 (hardcoded)' },
    { pattern: /\$2\.4M/, label: 'COST SAVED: $2.4M (hardcoded)' },
    { pattern: /'847'/, label: 'ACTIONS VERIFIED: 847 (hardcoded)' },
    { pattern: /'99\.98%'/, label: 'UPTIME: 99.98% (hardcoded)' },
  ];

  let hardcodedCount = 0;
  for (const m of hardcodedMetrics) {
    if (m.pattern.test(landing)) {
      inf(`  → ${m.label}`);
      hardcodedCount++;
    }
  }

  if (hardcodedCount >= 3) {
    red(`GAP-006 PRESENT: ${hardcodedCount}/5 landing page metrics are hardcoded strings`);
    inf('Fix: fetch from GET /api/stats/summary on mount, update every 30s');
  } else {
    grn('GAP-006 FIXED: Landing page stats appear to be dynamic');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Additional: AuthContext missing loading state in ProtectedRoute
// ─────────────────────────────────────────────────────────────────────────────
hdr('EXTRA · ProtectedRoute Returns null During Auth Load');
inf('File: frontend/src/App.jsx');

if (appJsx) {
  // Check if ProtectedRoute returns null during loading
  const protectedRouteBlock = appJsx.match(/function ProtectedRoute[\s\S]*?(?=\nfunction|\nexport)/)?.[0] || '';
  if (/if.*authLoading.*return null/.test(protectedRouteBlock)) {
    red('EXTRA PRESENT: ProtectedRoute returns null (blank screen) while auth is loading');
    inf('This causes a white flash before the loading state resolves.');
    inf('Fix: return a loading spinner instead of null');
  } else {
    grn('EXTRA FIXED: ProtectedRoute shows a loading state');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Check for missing ErrorBoundary in AuthorityControlCenter
// ─────────────────────────────────────────────────────────────────────────────
hdr('EXTRA · Error Boundary Coverage');
inf('File: frontend/src/App.jsx');

if (appJsx) {
  const hasBoundary = /ErrorBoundary/.test(appJsx);
  if (!hasBoundary) {
    red('EXTRA: No ErrorBoundary found in App.jsx');
  } else {
    grn('EXTRA: ErrorBoundary present');
    // Check if it wraps all routes
    const wrapsRoutes = /<ErrorBoundary>[\s\S]*<BrowserRouter/.test(appJsx) ||
                        /<ErrorBoundary>[\s\S]*<Routes/.test(appJsx);
    wrapsRoutes
      ? grn('EXTRA: ErrorBoundary wraps the router')
      : red('EXTRA: ErrorBoundary may not wrap all routes — check nesting');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Check for missing TypeScript
// ─────────────────────────────────────────────────────────────────────────────
hdr('GAP-002 · TypeScript Not Used (Document §12 + §9)');
inf('Document requires TypeScript for the SDK and Next.js for the frontend');

const frontendPkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'frontend', 'package.json'), 'utf8'));
if (frontendPkg.devDependencies?.typescript || frontendPkg.dependencies?.typescript) {
  grn('GAP-002 NOTE: TypeScript is a dev dependency');
} else {
  red('GAP-002 PRESENT: TypeScript not installed — frontend is plain JavaScript (document specifies TS)');
  inf('Also: Next.js not used (Vite/React instead, as document specifies Next.js)');
}

// ─────────────────────────────────────────────────────────────────────────────
// Results
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════');
console.log(`  \x1b[32mPASS\x1b[0m  ${PASS}`);
console.log(`  \x1b[31mFAIL\x1b[0m  ${FAIL}`);
console.log('══════════════════════════════════════════\n');

process.exit(FAIL > 0 ? 1 : 0);
