'use strict';

const express     = require('express');
const router      = express.Router();
const { v4: uuidv4 } = require('uuid');
const requireAuth = require('../middleware/requireAuth');
const { getDb }   = require('../db/database');

// POST /api/credentials/issue
router.post('/issue', requireAuth, (req, res) => {
  const { agentId, permissions, expiresInHours = 24 } = req.body;

  if (!agentId || !Array.isArray(permissions) || permissions.length === 0) {
    return res.status(400).json({ error: 'agentId and permissions[] are required' });
  }

  const db    = getDb();
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });

  // Validate all requested permissions exist
  const validActions = new Set(
    db.prepare('SELECT action FROM permissions').all().map(p => p.action)
  );
  const invalid = permissions.filter(p => !validActions.has(p));
  if (invalid.length > 0) {
    return res.status(400).json({ error: `Unknown permissions: ${invalid.join(', ')}` });
  }

  // Revoke any existing active credentials for this agent from this issuer
  db.prepare(
    `UPDATE delegation_credentials SET status = 'revoked'
     WHERE agent_id = ? AND issuer = ? AND status = 'active'`
  ).run(agentId, req.authority.id);

  const credentialId = `VC-2026-${uuidv4().toUpperCase().slice(0, 8)}`;
  const issuedAt     = new Date().toISOString();
  const expiresAt    = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();

  db.prepare(
    `INSERT INTO delegation_credentials
       (credential_id, issuer, issuer_role, agent_id, agent_did, permissions, issued_at, expires_at, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`
  ).run(
    credentialId,
    req.authority.id,
    req.authority.name,
    agentId,
    agent.did,
    JSON.stringify(permissions),
    issuedAt,
    expiresAt
  );

  // Audit event
  db.prepare(
    `INSERT INTO audit_events (id, timestamp, agent, credential_id, action, result, approval, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    uuidv4(), issuedAt, agent.did, credentialId,
    'CREDENTIAL_ISSUED', 'SUCCESS',
    req.authority.id,
    JSON.stringify({ issuer: req.authority.name, agentId, permissionCount: permissions.length })
  );

  const credential = db.prepare('SELECT * FROM delegation_credentials WHERE credential_id = ?').get(credentialId);
  res.status(201).json({ success: true, credential });
});

// GET /api/credentials — all credentials (optionally filtered)
router.get('/', requireAuth, (req, res) => {
  const db    = getDb();
  const creds = db.prepare(
    `SELECT * FROM delegation_credentials ORDER BY issued_at DESC LIMIT 100`
  ).all();
  res.json(creds);
});

// GET /api/credentials/active/:agentId — active credential for agent
router.get('/active/:agentId', (req, res) => {
  const db   = getDb();
  const cred = db.prepare(
    `SELECT * FROM delegation_credentials
     WHERE agent_id = ? AND status = 'active' AND expires_at > ?
     ORDER BY issued_at DESC LIMIT 1`
  ).get(req.params.agentId, new Date().toISOString());

  if (!cred) return res.json({ credential: null });

  let perms = [];
  try { perms = JSON.parse(cred.permissions); } catch {}
  res.json({ credential: cred, permissions: perms });
});

// POST /api/credentials/revoke/:credentialId
router.post('/revoke/:credentialId', requireAuth, (req, res) => {
  const db   = getDb();
  const cred = db.prepare('SELECT * FROM delegation_credentials WHERE credential_id = ?').get(req.params.credentialId);
  if (!cred) return res.status(404).json({ error: 'Credential not found' });

  db.prepare(`UPDATE delegation_credentials SET status = 'revoked' WHERE credential_id = ?`).run(req.params.credentialId);
  res.json({ success: true });
});

// GET /api/credentials/audit — audit events
router.get('/audit', requireAuth, (req, res) => {
  const db     = getDb();
  const events = db.prepare('SELECT * FROM audit_events ORDER BY timestamp DESC LIMIT 200').all();
  res.json(events);
});

module.exports = router;
