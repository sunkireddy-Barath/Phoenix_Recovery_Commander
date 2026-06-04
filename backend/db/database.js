'use strict';

const Database = require('better-sqlite3');
const path     = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, '..', 'phoenix.db');
let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
    seedData();
  }
  return db;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS authorities (
      id             TEXT PRIMARY KEY,
      name           TEXT NOT NULL,
      description    TEXT NOT NULL,
      authority_level TEXT NOT NULL,
      industry       TEXT NOT NULL DEFAULT 'general'
    );

    CREATE TABLE IF NOT EXISTS agents (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      did        TEXT NOT NULL UNIQUE,
      industry   TEXT NOT NULL,
      status     TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id                TEXT PRIMARY KEY,
      action            TEXT NOT NULL UNIQUE,
      label             TEXT NOT NULL,
      industry          TEXT NOT NULL,
      risk_level        TEXT NOT NULL DEFAULT 'medium',
      requires_approval INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS delegation_credentials (
      credential_id TEXT PRIMARY KEY,
      issuer        TEXT NOT NULL,
      issuer_role   TEXT NOT NULL,
      agent_id      TEXT NOT NULL,
      agent_did     TEXT NOT NULL,
      permissions   TEXT NOT NULL,
      issued_at     TEXT NOT NULL,
      expires_at    TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS approval_records (
      id            TEXT PRIMARY KEY,
      credential_id TEXT,
      incident_id   TEXT,
      action        TEXT NOT NULL,
      agent         TEXT NOT NULL,
      approver      TEXT NOT NULL,
      approver_role TEXT,
      reason        TEXT,
      timestamp     TEXT NOT NULL,
      status        TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id            TEXT PRIMARY KEY,
      timestamp     TEXT NOT NULL,
      agent         TEXT,
      credential_id TEXT,
      action        TEXT NOT NULL,
      result        TEXT NOT NULL,
      approval      TEXT,
      metadata      TEXT
    );
  `);
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const AUTHORITIES = [
  {
    id: 'harbor_master',
    name: 'Harbor Master',
    description: 'Senior authority for all port operations. Full control over vessel traffic, berth management, and port safety systems.',
    authority_level: 'LEVEL_3',
    industry: 'port'
  },
  {
    id: 'port_operations_director',
    name: 'Port Operations Director',
    description: 'Oversees day-to-day port operations and logistics. Can delegate most operational and maintenance actions.',
    authority_level: 'LEVEL_2',
    industry: 'port'
  },
  {
    id: 'safety_supervisor',
    name: 'Safety Supervisor',
    description: 'Responsible for safety compliance and emergency protocols across all facility types and operational zones.',
    authority_level: 'LEVEL_2',
    industry: 'general'
  },
  {
    id: 'datacenter_ops_manager',
    name: 'Datacenter Operations Manager',
    description: 'Manages datacenter infrastructure, disaster recovery procedures, and security incident response.',
    authority_level: 'LEVEL_3',
    industry: 'datacenter'
  },
  {
    id: 'utility_control_supervisor',
    name: 'Utility Control Supervisor',
    description: 'Controls utility grid operations, power plant management systems, and regulatory compliance reporting.',
    authority_level: 'LEVEL_3',
    industry: 'utility'
  }
];

const AGENTS = [
  {
    id: 'phoenix-port-01',
    name: 'Phoenix-Port-01',
    did: 'did:key:phoenix-port-z6MkpTHR8VNsBxYAAWHut2Lcvo1',
    industry: 'port',
    status: 'active'
  },
  {
    id: 'phoenix-datacenter-01',
    name: 'Phoenix-Datacenter-01',
    did: 'did:key:phoenix-dc-z6MkhaXgBZDvotDkL5257faizCJs',
    industry: 'datacenter',
    status: 'active'
  },
  {
    id: 'phoenix-powerplant-01',
    name: 'Phoenix-PowerPlant-01',
    did: 'did:key:phoenix-pp-z6MknGc3oCHULqNAxLFSRe9bHn3',
    industry: 'utility',
    status: 'active'
  },
  {
    id: 'phoenix-utility-01',
    name: 'Phoenix-Utility-01',
    did: 'did:key:phoenix-util-z6MkwDDvS5pHbSBxmXKX6pn7J5',
    industry: 'utility',
    status: 'active'
  }
];

// Permission actions match the exact playbook action names so the check is trivial
const PERMISSIONS = [
  // ── Power Plant / Utility (INC-001) ──────────────────────────────────────
  { id: 'perm-isolate-zone-4',       action: 'ISOLATE_ZONE_4',          label: 'Isolate Zone 4',              industry: 'utility',    risk_level: 'high',     requires_approval: 0 },
  { id: 'perm-notify-safety-team',   action: 'NOTIFY_SAFETY_TEAM',      label: 'Notify Safety Team',          industry: 'utility',    risk_level: 'low',      requires_approval: 0 },
  { id: 'perm-switch-backup-cool',   action: 'SWITCH_BACKUP_COOLING',   label: 'Switch Backup Cooling',       industry: 'utility',    risk_level: 'medium',   requires_approval: 0 },
  { id: 'perm-check-backup-power',   action: 'CHECK_BACKUP_POWER',      label: 'Check Backup Power',          industry: 'utility',    risk_level: 'low',      requires_approval: 0 },
  { id: 'perm-restart-primary-cool', action: 'RESTART_PRIMARY_COOLING', label: 'Restart Primary Cooling',     industry: 'utility',    risk_level: 'critical', requires_approval: 1 },
  { id: 'perm-notify-regulator',     action: 'NOTIFY_REGULATOR',        label: 'Notify Regulator',            industry: 'utility',    risk_level: 'medium',   requires_approval: 0 },
  // ── Datacenter (INC-002) ─────────────────────────────────────────────────
  { id: 'perm-isolate-cluster-b',    action: 'ISOLATE_CLUSTER_B',       label: 'Isolate Server Cluster',      industry: 'datacenter', risk_level: 'high',     requires_approval: 0 },
  { id: 'perm-snapshot-clean',       action: 'SNAPSHOT_CLEAN_STATE',    label: 'Snapshot Clean State',        industry: 'datacenter', risk_level: 'low',      requires_approval: 0 },
  { id: 'perm-notify-security',      action: 'NOTIFY_SECURITY_TEAM',    label: 'Notify Security Team',        industry: 'datacenter', risk_level: 'low',      requires_approval: 0 },
  { id: 'perm-block-ext-traffic',    action: 'BLOCK_EXTERNAL_TRAFFIC',  label: 'Block External Traffic',      industry: 'datacenter', risk_level: 'high',     requires_approval: 0 },
  { id: 'perm-restore-backup',       action: 'RESTORE_FROM_BACKUP',     label: 'Restore from Backup',         industry: 'datacenter', risk_level: 'critical', requires_approval: 1 },
  { id: 'perm-notify-clients',       action: 'NOTIFY_AFFECTED_CLIENTS', label: 'Notify Affected Clients',     industry: 'datacenter', risk_level: 'medium',   requires_approval: 1 },
  // ── Port (INC-003) ───────────────────────────────────────────────────────
  { id: 'perm-halt-berth',           action: 'HALT_BERTH_7_OPERATIONS', label: 'Halt Berth Operations',       industry: 'port',       risk_level: 'medium',   requires_approval: 0 },
  { id: 'perm-redirect-vessels',     action: 'REDIRECT_VESSELS_BERTH_9',label: 'Redirect Vessels',            industry: 'port',       risk_level: 'medium',   requires_approval: 0 },
  { id: 'perm-dispatch-maint',       action: 'DISPATCH_MAINTENANCE_TEAM',label: 'Dispatch Maintenance Team', industry: 'port',       risk_level: 'low',      requires_approval: 0 },
  { id: 'perm-notify-vessel-ops',    action: 'NOTIFY_VESSEL_OPERATORS', label: 'Notify Vessel Operators',     industry: 'port',       risk_level: 'low',      requires_approval: 0 },
  { id: 'perm-engage-crane',         action: 'ENGAGE_BACKUP_CRANE',     label: 'Engage Backup Crane',         industry: 'port',       risk_level: 'high',     requires_approval: 1 },
  { id: 'perm-notify-customs',       action: 'NOTIFY_CUSTOMS_AUTHORITY',label: 'Notify Customs Authority',    industry: 'port',       risk_level: 'medium',   requires_approval: 1 }
];

function seedData() {
  const tx = db.transaction(() => {
    const insertAuth = db.prepare(
      `INSERT OR IGNORE INTO authorities (id, name, description, authority_level, industry) VALUES (?, ?, ?, ?, ?)`
    );
    for (const a of AUTHORITIES) {
      insertAuth.run(a.id, a.name, a.description, a.authority_level, a.industry);
    }

    const insertAgent = db.prepare(
      `INSERT OR IGNORE INTO agents (id, name, did, industry, status, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const a of AGENTS) {
      insertAgent.run(a.id, a.name, a.did, a.industry, a.status, new Date().toISOString());
    }

    const insertPerm = db.prepare(
      `INSERT OR IGNORE INTO permissions (id, action, label, industry, risk_level, requires_approval) VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const p of PERMISSIONS) {
      insertPerm.run(p.id, p.action, p.label, p.industry, p.risk_level, p.requires_approval);
    }
  });
  tx();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getActiveCredential(agentId) {
  const db = getDb();
  return db.prepare(
    `SELECT * FROM delegation_credentials
     WHERE agent_id = ? AND status = 'active' AND expires_at > ?
     ORDER BY issued_at DESC LIMIT 1`
  ).get(agentId, new Date().toISOString());
}

function credentialPermissions(credential) {
  if (!credential) return [];
  try { return JSON.parse(credential.permissions); } catch { return []; }
}

function isPermitted(agentId, action) {
  const cred = getActiveCredential(agentId);
  if (!cred) return { permitted: false, reason: 'No active delegation credential found', credential: null };
  const perms = credentialPermissions(cred);
  if (perms.includes(action)) {
    return { permitted: true, credential: cred };
  }
  return { permitted: false, reason: `Action ${action} not in delegation scope`, credential: cred };
}

module.exports = { getDb, getActiveCredential, credentialPermissions, isPermitted, AUTHORITIES, AGENTS, PERMISSIONS };
