'use strict';

const express     = require('express');
const router      = express.Router();
const requireAuth = require('../middleware/requireAuth');
const { getDb }   = require('../db/database');

// GET /api/agents — list all agents with their active credentials
router.get('/', requireAuth, (req, res) => {
  const db     = getDb();
  const agents = db.prepare('SELECT * FROM agents ORDER BY name').all();
  const now    = new Date().toISOString();

  const enriched = agents.map(agent => {
    const cred = db.prepare(
      `SELECT * FROM delegation_credentials
       WHERE agent_id = ? AND status = 'active' AND expires_at > ?
       ORDER BY issued_at DESC LIMIT 1`
    ).get(agent.id, now);

    let permissions = [];
    if (cred) {
      try { permissions = JSON.parse(cred.permissions); } catch { permissions = []; }
    }

    return { ...agent, activeCredential: cred || null, activePermissions: permissions };
  });

  res.json(enriched);
});

// GET /api/agents/:id — single agent
router.get('/:id', requireAuth, (req, res) => {
  const db    = getDb();
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });

  const now   = new Date().toISOString();
  const cred  = db.prepare(
    `SELECT * FROM delegation_credentials
     WHERE agent_id = ? AND status = 'active' AND expires_at > ?
     ORDER BY issued_at DESC LIMIT 1`
  ).get(agent.id, now);

  const allCreds = db.prepare(
    `SELECT * FROM delegation_credentials WHERE agent_id = ? ORDER BY issued_at DESC`
  ).all(agent.id);

  res.json({ ...agent, activeCredential: cred || null, credentials: allCreds });
});

module.exports = router;
