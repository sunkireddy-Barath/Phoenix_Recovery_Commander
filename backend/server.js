'use strict';

require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');

const t3n            = require('./agent/t3nClient');
const incidentRoutes = require('./routes/incident');
const agentRoutes    = require('./routes/agent');

const app  = express();
const PORT = process.env.PORT || 3001;

// ─── Security Middleware ──────────────────────────────────────────────────────

// Helmet: sets X-Frame-Options, X-Content-Type-Options, HSTS, CSP, etc.
app.use(helmet({
  contentSecurityPolicy: false, // disabled for API-only server
  crossOriginEmbedderPolicy: false
}));

// CORS: allow only known origins
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:4173').split(',');
app.use(cors({
  origin: (origin, cb) => {
    // Allow no-origin (curl, Postman) and whitelisted origins
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    // Reject with null (not an Error) so express returns 204 with no CORS headers,
    // effectively blocking the browser from reading the response
    cb(null, false);
  },
  credentials: false
}));

// Body parsing with size limit to prevent abuse
app.use(express.json({ limit: '64kb' }));

// Global rate limit: 200 req/min per IP
const globalLimiter = rateLimit({
  windowMs:        60 * 1000,
  max:             200,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { error: 'Too many requests — please slow down' }
});
app.use(globalLimiter);

// Stricter limiter on incident-start (prevents storm of incidents)
const incidentStartLimiter = rateLimit({
  windowMs: 60 * 1000,
  max:      10,
  message:  { error: 'Too many incident starts — max 10/min' }
});
app.use('/api/incident/start', incidentStartLimiter);

// ─── Logging ─────────────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  if (req.path !== '/health') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} — ${req.ip}`);
  }
  next();
});

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/incident', incidentRoutes);
app.use('/api/agent',    agentRoutes);

app.get('/health', (_req, res) => {
  res.json({
    status:    'ok',
    agent:     t3n.getAgentStatus(),
    timestamp: new Date().toISOString()
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  // Don't expose internal details in production
  const isDev = process.env.NODE_ENV !== 'production';
  console.error('[ERROR]', err.message);
  res.status(500).json({
    error: 'Internal server error',
    ...(isDev && { message: err.message })
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
async function boot() {
  try {
    await t3n.initAgent();
    const status = t3n.getAgentStatus();

    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║       PHOENIX INDUSTRIAL RECOVERY COMMANDER — BACKEND        ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log(`║  Mode:       ${status.mode.padEnd(49)}║`);
    console.log(`║  Agent DID:  ${status.did.padEnd(49)}║`);
    console.log(`║  T3N:        ${(status.simulationMode ? 'SIMULATION — add T3N_API_KEY for live' : 'LIVE — staging.terminal3.io').padEnd(49)}║`);
    console.log(`║  Port:       ${String(PORT).padEnd(49)}║`);
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');

    app.listen(PORT, () => {
      console.log(`🚀 Backend: http://localhost:${PORT}`);
      console.log(`🔐 T3N:     ${status.mode} mode — DID: ${status.did}`);
      if (status.simulationMode) {
        console.log(`⚠️  Add T3N_API_KEY to .env to switch to live T3N mode`);
      }
      console.log('');
    });
  } catch (err) {
    console.error('Boot failed:', err);
    process.exit(1);
  }
}

boot();
