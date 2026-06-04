'use strict';

const express      = require('express');
const router       = express.Router();
const requireAuth  = require('../middleware/requireAuth');
const { getDb }    = require('../db/database');

// GET /api/authority/me — current authority profile + stats
router.get('/me', requireAuth, (req, res) => {
  const db = getDb();

  const activeDelegations = db.prepare(
    `SELECT COUNT(*) as count FROM delegation_credentials
     WHERE issuer = ? AND status = 'active' AND expires_at > ?`
  ).get(req.authority.id, new Date().toISOString());

  const activeAgents = db.prepare(
    `SELECT COUNT(DISTINCT agent_id) as count FROM delegation_credentials
     WHERE issuer = ? AND status = 'active' AND expires_at > ?`
  ).get(req.authority.id, new Date().toISOString());

  const actionsAuthorized = db.prepare(
    `SELECT COUNT(*) as count FROM audit_events
     WHERE approval = ? AND result = 'APPROVED'`
  ).get(req.authority.id);

  const approvalsGranted = db.prepare(
    `SELECT COUNT(*) as count FROM approval_records
     WHERE approver = ? AND status = 'approved'`
  ).get(req.authority.id);

  res.json({
    authority:        req.authority,
    stats: {
      activeDelegations: activeDelegations.count,
      activeAgents:      activeAgents.count,
      actionsAuthorized: actionsAuthorized.count,
      approvalsGranted:  approvalsGranted.count
    }
  });
});

module.exports = router;
