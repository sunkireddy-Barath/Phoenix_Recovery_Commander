'use strict';

const express = require('express');
const router  = express.Router();

const t3n       = require('../agent/t3nClient');
const reasoning = require('../agent/reasoningEngine');
const playbook  = require('../agent/playbook');

const incidentRoutes  = require('./incident');
const getIncident     = incidentRoutes.getIncident;
const executeNextStep = incidentRoutes.executeNextStep;

// ─── Input Sanitization ───────────────────────────────────────────────────────

const VALID_APPROVER_ROLES = new Set([
  'plant_manager', 'supervisor', 'ciso', 'legal',
  'port_authority', 'harbor_master', 'facility_manager'
]);

const VALID_ACTION_NAMES = new Set([
  'ISOLATE_ZONE_4', 'NOTIFY_SAFETY_TEAM', 'SWITCH_BACKUP_COOLING', 'CHECK_BACKUP_POWER',
  'RESTART_PRIMARY_COOLING', 'NOTIFY_REGULATOR',
  'ISOLATE_CLUSTER_B', 'SNAPSHOT_CLEAN_STATE', 'NOTIFY_SECURITY_TEAM', 'BLOCK_EXTERNAL_TRAFFIC',
  'RESTORE_FROM_BACKUP', 'NOTIFY_AFFECTED_CLIENTS',
  'HALT_BERTH_7_OPERATIONS', 'REDIRECT_VESSELS_BERTH_9', 'DISPATCH_MAINTENANCE_TEAM',
  'NOTIFY_VESSEL_OPERATORS', 'ENGAGE_BACKUP_CRANE', 'NOTIFY_CUSTOMS_AUTHORITY'
]);

function sanitizeString(val, maxLen = 120) {
  if (typeof val !== 'string') return '';
  // Remove HTML tags and control characters; trim whitespace
  return val
    .replace(/<[^>]*>/g, '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim()
    .slice(0, maxLen);
}

function validateIncidentId(id) {
  return typeof id === 'string' && /^INC-\d{10,}$/.test(id);
}

// ─── GET /api/agent/identity ──────────────────────────────────────────────────
router.get('/identity', async (req, res) => {
  try {
    const identity = await t3n.verifyAgentIdentity();
    const status   = t3n.getAgentStatus();
    // Merge with status having precedence for named fields
    res.json({ ...identity, ...status });
  } catch (err) {
    console.error('[agent/identity]', err.message);
    res.status(500).json({ error: 'Failed to retrieve agent identity' });
  }
});

// ─── POST /api/agent/approve-escalation ──────────────────────────────────────
router.post('/approve-escalation', async (req, res) => {
  try {
    const rawIncidentId  = req.body.incidentId;
    const rawAction      = req.body.action;
    const rawApprovedBy  = req.body.approvedBy;
    const rawApproverRole = req.body.approverRole;

    // Validate and sanitize
    if (!rawIncidentId || !rawAction || !rawApprovedBy) {
      return res.status(400).json({ error: 'incidentId, action, and approvedBy are required' });
    }
    if (!validateIncidentId(rawIncidentId)) {
      return res.status(400).json({ error: 'Invalid incidentId format' });
    }
    if (!VALID_ACTION_NAMES.has(rawAction)) {
      return res.status(400).json({ error: `Invalid action: ${rawAction}` });
    }

    const incidentId  = rawIncidentId;
    const action      = rawAction; // already validated from enum
    const approvedBy  = sanitizeString(rawApprovedBy, 80);
    const approverRole = VALID_APPROVER_ROLES.has(rawApproverRole) ? rawApproverRole : 'facility_manager';

    if (!approvedBy) {
      return res.status(400).json({ error: 'approvedBy cannot be empty' });
    }

    const incident = getIncident(incidentId);
    if (!incident) return res.status(404).json({ error: 'Incident not found' });
    if (incident.status !== 'blocked') {
      return res.status(409).json({ error: 'Incident is not awaiting approval' });
    }
    if (!incident.pendingEscalation || incident.pendingEscalation.action !== action) {
      return res.status(409).json({ error: `No pending escalation for action ${action}` });
    }

    console.log(`👤 T3N: Human approval — ${action} by ${approvedBy} (${approverRole})`);

    // ── T3N: Record human approval VC ────────────────────────────────────────
    // Push PENDING op so the live gatekeeper feed shows this immediately
    incident.t3nOperations.push({
      type:      'HUMAN_APPROVAL_AUDIT',
      status:    'LOGGING',
      action:    'HUMAN_APPROVAL',
      approvedBy,
      timestamp: new Date().toISOString()
    });

    const approvalAudit = await t3n.logAuditTrail(
      'HUMAN_APPROVAL',
      incident.agentIdentity?.did,
      'APPROVED',
      { incidentId, scenarioId: incident.scenarioId, approvedBy, approverRole, action, telemetry: incident.telemetry }
    );

    // Update op to LOGGED
    incident.t3nOperations[incident.t3nOperations.length - 1] = {
      type:       'HUMAN_APPROVAL_AUDIT',
      status:     'LOGGED',
      action:     'HUMAN_APPROVAL',
      approvedBy,
      vcId:       approvalAudit.vcId,
      cid:        approvalAudit.cid,
      block_hash: approvalAudit.block_hash,
      simulation: approvalAudit.simulation,
      timestamp:  new Date().toISOString()
    };

    incident.auditTrail.push({
      id:             approvalAudit.vcId,
      type:           'HUMAN_APPROVAL',
      action:         'HUMAN_APPROVAL',
      label:          `Approved by ${approvedBy}`,
      status:         'APPROVED',
      approvedBy,
      approverRole,
      approvedAction: action,
      agentDID:       incident.agentIdentity?.did,
      blockHash:      approvalAudit.block_hash,
      cid:            approvalAudit.cid,
      timestamp:      new Date().toISOString(),
      t3nVerified:    approvalAudit.logged,
      teeVerified:    approvalAudit.tee_verified,
      simulation:     approvalAudit.simulation
    });

    // Execute the now-approved step
    const blockedStep = incident.scenario.playbook.find(s => s.action === action);
    if (blockedStep) {
      const approvedStep = { ...blockedStep, authorized: true };
      const execResult   = playbook.simulateStepExecution(approvedStep, incident.scenario);

      // ── T3N: Record execution audit VC ─────────────────────────────────────
      incident.t3nOperations.push({
        type:      'AUDIT_LOG',
        status:    'LOGGING',
        action:    approvedStep.action,
        humanApproved: true,
        timestamp: new Date().toISOString()
      });

      const execAudit = await t3n.logAuditTrail(
        action,
        incident.agentIdentity?.did,
        'SUCCESS',
        { incidentId, scenarioId: incident.scenarioId, stepIndex: approvedStep.step, approvedBy, approverRole, telemetry: incident.telemetry }
      );

      incident.t3nOperations[incident.t3nOperations.length - 1] = {
        type:       'AUDIT_LOG',
        status:     'LOGGED',
        action:     approvedStep.action,
        humanApproved: true,
        vcId:       execAudit.vcId,
        cid:        execAudit.cid,
        block_hash: execAudit.block_hash,
        simulation: execAudit.simulation,
        timestamp:  new Date().toISOString()
      };

      incident.completedSteps.push({
        id:              `step-approved-${Date.now()}`,
        action:          approvedStep.action,
        label:           approvedStep.label,
        step:            approvedStep.step,
        category:        approvedStep.category,
        status:          'COMPLETE',
        reasoning:       approvedStep.reasoning,
        expectedOutcome: approvedStep.expectedOutcome,
        executionLog:    execResult.log,
        executedAt:      new Date().toISOString(),
        t3nVerified:     execAudit.logged,
        teeVerified:     execAudit.tee_verified,
        blockHash:       execAudit.block_hash,
        vcId:            execAudit.vcId,
        cid:             execAudit.cid,
        simulation:      execAudit.simulation,
        authorized:      true,
        humanApproved:   true,
        approvedBy,
        approverRole
      });

      incident.auditTrail.push({
        id:            execAudit.vcId,
        type:          'ACTION_EXECUTED',
        action:        approvedStep.action,
        label:         approvedStep.label,
        status:        'SUCCESS',
        agentDID:      incident.agentIdentity?.did,
        blockHash:     execAudit.block_hash,
        cid:           execAudit.cid,
        timestamp:     new Date().toISOString(),
        t3nVerified:   execAudit.logged,
        teeVerified:   execAudit.tee_verified,
        humanApproved: true,
        approvedBy,
        simulation:    execAudit.simulation
      });

      incident.telemetry = reasoning.computeUpdatedTelemetry(incident.scenario, incident.completedSteps, incident.telemetry);
      incident.telemetryHistory.push({ timestamp: Date.now(), ...incident.telemetry });
      incident.recoveryProgress = reasoning.computeRecoveryProgress(incident.scenario, incident.completedSteps);
    }

    incident.pendingEscalation = null;
    incident.status = 'executing';
    incident.phase  = `Approved by ${approvedBy} — Resuming recovery...`;

    setTimeout(() => executeNextStep(incidentId), 2500);

    res.json({ success: true, message: `${action} approved and executed`, approvalAudit });
  } catch (err) {
    console.error('[approve-escalation]', err.message);
    res.status(500).json({ error: 'Approval failed — see server logs' });
  }
});

// ─── POST /api/agent/reject-escalation ───────────────────────────────────────
router.post('/reject-escalation', async (req, res) => {
  try {
    const rawIncidentId = req.body.incidentId;
    const rawAction     = req.body.action;
    const rawRejectedBy = req.body.rejectedBy;
    const rawReason     = req.body.reason;

    if (!rawIncidentId || !rawAction) {
      return res.status(400).json({ error: 'incidentId and action are required' });
    }
    if (!validateIncidentId(rawIncidentId)) {
      return res.status(400).json({ error: 'Invalid incidentId format' });
    }
    if (!VALID_ACTION_NAMES.has(rawAction)) {
      return res.status(400).json({ error: `Invalid action: ${rawAction}` });
    }

    const incidentId = rawIncidentId;
    const action     = rawAction;
    const rejectedBy = sanitizeString(rawRejectedBy || 'Unknown', 80);
    const reason     = sanitizeString(rawReason || 'No reason provided', 240);

    const incident = getIncident(incidentId);
    if (!incident) return res.status(404).json({ error: 'Incident not found' });

    const rejectAudit = await t3n.logAuditTrail(
      'HUMAN_REJECTION', incident.agentIdentity?.did, 'REJECTED',
      { incidentId, action, rejectedBy, reason }
    );

    incident.auditTrail.push({
      id:             rejectAudit.vcId,
      type:           'HUMAN_REJECTION',
      action:         'HUMAN_REJECTION',
      label:          `Rejected by ${rejectedBy}`,
      status:         'REJECTED',
      rejectedBy,
      rejectedAction: action,
      reason,
      timestamp:      new Date().toISOString(),
      t3nVerified:    rejectAudit.logged,
      simulation:     rejectAudit.simulation
    });

    incident.pendingEscalation = null;
    incident.status = 'blocked';
    incident.phase  = `Step rejected by ${rejectedBy}. Manual intervention required.`;

    res.json({ success: true, message: `${action} rejected and recorded in T3N audit trail` });
  } catch (err) {
    console.error('[reject-escalation]', err.message);
    res.status(500).json({ error: 'Rejection failed — see server logs' });
  }
});

// ─── POST /api/agent/replan ───────────────────────────────────────────────────
router.post('/replan', async (req, res) => {
  try {
    const { incidentId, newTelemetry } = req.body;

    if (!incidentId || !validateIncidentId(incidentId)) {
      return res.status(400).json({ error: 'Valid incidentId is required' });
    }

    const incident = getIncident(incidentId);
    if (!incident) return res.status(404).json({ error: 'Incident not found' });

    if (newTelemetry && typeof newTelemetry === 'object') {
      // Only allow numeric telemetry values
      const safeTelemetry = {};
      for (const [k, v] of Object.entries(newTelemetry)) {
        if (typeof v === 'number' && isFinite(v)) safeTelemetry[k] = v;
      }
      incident.telemetry = { ...incident.telemetry, ...safeTelemetry };
      incident.telemetryHistory.push({ timestamp: Date.now(), ...incident.telemetry });
    }

    const newPlan = reasoning.analyzeIncident(incident.scenario, incident.telemetry);
    newPlan.incidentId = incidentId;
    incident.plan = newPlan;

    res.json({ success: true, plan: newPlan, telemetry: incident.telemetry });
  } catch (err) {
    console.error('[replan]', err.message);
    res.status(500).json({ error: 'Replan failed' });
  }
});

module.exports = router;
