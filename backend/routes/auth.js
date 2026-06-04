'use strict';

const express = require('express');
const router  = express.Router();
const { getDb } = require('../db/database');

// GET /api/auth/session
router.get('/session', (req, res) => {
  if (!req.session || !req.session.authorityId) {
    return res.status(401).json({ authenticated: false });
  }
  const authority = getDb().prepare('SELECT * FROM authorities WHERE id = ?').get(req.session.authorityId);
  if (!authority) {
    req.session.destroy(() => {});
    return res.status(401).json({ authenticated: false });
  }
  res.json({ authenticated: true, authority });
});

// GET /api/auth/roles
router.get('/roles', (_req, res) => {
  res.json(getDb().prepare('SELECT * FROM authorities ORDER BY authority_level DESC').all());
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { roleId } = req.body;
  if (!roleId || typeof roleId !== 'string') {
    return res.status(400).json({ error: 'roleId is required' });
  }
  const authority = getDb().prepare('SELECT * FROM authorities WHERE id = ?').get(roleId);
  if (!authority) return res.status(404).json({ error: 'Role not found' });

  req.session.authorityId = authority.id;
  req.session.save(err => {
    if (err) return res.status(500).json({ error: 'Session error' });
    res.json({ success: true, authority });
  });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

module.exports = router;
