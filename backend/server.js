'use strict';

require('dotenv').config();

const express = require('express');
const cors    = require('cors');

const t3n           = require('./agent/t3nClient');
const incidentRoutes = require('./routes/incident');
const agentRoutes    = require('./routes/agent');

const app  = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());

// Request logger
app.use((req, _res, next) => {
  if (req.path !== '/health') {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  }
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/incident', incidentRoutes);
app.use('/api/agent',    agentRoutes);

app.get('/health', (_req, res) => {
  res.json({
    status:    'ok',
    agent:     t3n.getAgentStatus(),
    timestamp: new Date().toISOString()
  });
});

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
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
    console.log(`║  T3N Status: ${(status.simulationMode ? 'Simulation (add T3N_API_KEY for live)' : 'LIVE — Connected to staging.terminal3.io').padEnd(49)}║`);
    console.log(`║  Port:       ${String(PORT).padEnd(49)}║`);
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`🔐 T3N Agent Auth: ${status.mode} mode`);
      console.log('');
    });
  } catch (err) {
    console.error('Boot failed:', err);
    process.exit(1);
  }
}

boot();
