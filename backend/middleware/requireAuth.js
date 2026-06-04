'use strict';

const { getDb } = require('../db/database');

function requireAuth(req, res, next) {
  if (!req.session || !req.session.authorityId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const authority = getDb().prepare('SELECT * FROM authorities WHERE id = ?').get(req.session.authorityId);
  if (!authority) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: 'Session expired' });
  }
  req.authority = authority;
  next();
}

module.exports = requireAuth;
