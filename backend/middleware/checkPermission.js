'use strict';

const { getDb, isPermitted } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

// SCENARIO → AGENT mapping (matches playbook IDs)
const SCENARIO_AGENT_MAP = {
  'INC-001': 'phoenix-powerplant-01',
  'INC-002': 'phoenix-datacenter-01',
  'INC-003': 'phoenix-port-01'
};

/**
 * Check if the action is permitted under the active delegation credential.
 * Returns { permitted, credential, reason }
 */
function checkCredentialPermission(scenarioId, action) {
  const agentId = SCENARIO_AGENT_MAP[scenarioId];
  if (!agentId) return { permitted: true, credential: null, reason: 'No agent mapping — default allow' };
  return isPermitted(agentId, action);
}

/**
 * Record an approval in the DB.
 */
function recordApproval({ credentialId, incidentId, action, agent, approver, approverRole, reason, status }) {
  const db = getDb();
  db.prepare(
    `INSERT INTO approval_records
       (id, credential_id, incident_id, action, agent, approver, approver_role, reason, timestamp, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(uuidv4(), credentialId || null, incidentId || null, action, agent, approver, approverRole || null, reason || null, new Date().toISOString(), status);
}

/**
 * Record a generic audit event in the DB.
 */
function recordAuditEvent({ agent, credentialId, action, result, approval, metadata }) {
  const db = getDb();
  db.prepare(
    `INSERT INTO audit_events (id, timestamp, agent, credential_id, action, result, approval, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    uuidv4(),
    new Date().toISOString(),
    agent || null,
    credentialId || null,
    action,
    result,
    approval || null,
    metadata ? JSON.stringify(metadata) : null
  );
}

module.exports = { checkCredentialPermission, recordApproval, recordAuditEvent, SCENARIO_AGENT_MAP };
