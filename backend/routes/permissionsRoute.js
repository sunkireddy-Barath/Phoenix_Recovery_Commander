'use strict';

const express     = require('express');
const router      = express.Router();
const requireAuth = require('../middleware/requireAuth');
const { getDb }   = require('../db/database');

// GET /api/permissions — all permissions, optionally filtered by industry
router.get('/', requireAuth, (req, res) => {
  const { industry } = req.query;
  const db = getDb();
  const perms = industry
    ? db.prepare('SELECT * FROM permissions WHERE industry = ? ORDER BY risk_level, action').all(industry)
    : db.prepare('SELECT * FROM permissions ORDER BY industry, risk_level, action').all();
  res.json(perms);
});

// GET /api/permissions/for-agent/:agentId
router.get('/for-agent/:agentId', requireAuth, (req, res) => {
  const db    = getDb();
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.agentId);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });

  const perms = db.prepare('SELECT * FROM permissions WHERE industry = ? ORDER BY risk_level, action').all(agent.industry);
  res.json(perms);
});

module.exports = router;
