'use strict';

const express  = require('express');
const { v4: uuidv4 } = require('uuid');
const router   = express.Router();

const t3n       = require('../agent/t3nClient');
const reasoning = require('../agent/reasoningEngine');
const playbook  = require('../agent/playbook');
const { checkCredentialPermission, recordAuditEvent, SCENARIO_AGENT_MAP } = require('../middleware/checkPermission');
const { getActiveCredential } = require('../db/database');

// ─── In-Memory Incident Store with TTL ───────────────────────────────────────

const incidentStore = new Map(); // incidentId → IncidentState

// Clean up incidents older than 2 hours to prevent memory leak
const INCIDENT_TTL_MS = 2 * 60 * 60 * 1000;
setInterval(() => {
  const cutoff = Date.now() - INCIDENT_TTL_MS;
  for (const [id, inc] of incidentStore.entries()) {
    const age = new Date(inc.startTime).getTime();
    if (age < cutoff) {
      incidentStore.delete(id);
      console.log(`[TTL] Evicted stale incident ${id}`);
    }
  }
}, 30 * 60 * 1000); // run every 30 min

function getIncident(id)       { return incidentStore.get(id); }
function setIncident(id, data) { incidentStore.set(id, data); }

// ─── POST /api/incident/start ─────────────────────────────────────────────────
router.post('/start', async (req, res) => {
  try {
    const { scenarioId } = req.body;
    if (!scenarioId || typeof scenarioId !== 'string') {
      return res.status(400).json({ error: 'scenarioId is required' });
    }

    const VALID_SCENARIOS = new Set(['INC-001', 'INC-002', 'INC-003']);
    if (!VALID_SCENARIOS.has(scenarioId)) {
      return res.status(400).json({ error: `Invalid scenarioId. Must be one of: ${[...VALID_SCENARIOS].join(', ')}` });
    }

    // Limit concurrent active incidents per session (prevent resource exhaustion)
    let activeCount = 0;
    for (const inc of incidentStore.values()) {
      if (inc.status !== 'complete' && inc.status !== 'cancelled') activeCount++;
    }
    if (activeCount >= 5) {
      return res.status(429).json({ error: 'Too many active incidents. Cancel existing incidents first.' });
    }

    const scenario   = playbook.getScenario(scenarioId);
    if (!scenario) return res.status(404).json({ error: `Scenario ${scenarioId} not found` });

    const incidentId = `INC-${Date.now()}`;

    // ── T3N Gatekeeper: Verify agent identity before starting ───────────────
    console.log(`🔐 T3N: Verifying Phoenix Agent identity for incident ${incidentId}...`);
    const agentIdentity = await t3n.verifyAgentIdentity();

    const plan = reasoning.analyzeIncident(scenario, scenario.telemetry);
    plan.incidentId = incidentId;

    // ── Credential lookup for permission enforcement ────────────────────────
    const agentId   = SCENARIO_AGENT_MAP[scenarioId] || null;
    const activeCred = agentId ? getActiveCredential(agentId) : null;
    let activeCredPerms = [];
    if (activeCred) {
      try { activeCredPerms = JSON.parse(activeCred.permissions); } catch {}
    }

    recordAuditEvent({
      agent:        agentIdentity?.did,
      credentialId: activeCred?.credential_id || null,
      action:       'INCIDENT_STARTED',
      result:       'SUCCESS',
      metadata:     { incidentId, scenarioId, agentId, credentialId: activeCred?.credential_id }
    });

    const incident = {
      id:                incidentId,
      scenarioId,
      scenario:          { ...scenario },
      status:            'executing',
      phase:             'Agent analyzing situation — T3N identity verified',
      completedSteps:    [],
      pendingEscalation: null,
      auditTrail:        [],
      t3nOperations:     [],
      telemetry:         { ...scenario.telemetry },
      telemetryHistory:  [{ timestamp: Date.now(), ...scenario.telemetry }],
      recoveryProgress:  0,
      plan,
      agentIdentity,
      agentId,
      activeCredential:  activeCred || null,
      activeCredPerms,
      startTime:         new Date().toISOString(),
      completeTime:      null
    };

    setIncident(incidentId, incident);
    setImmediate(() => executeNextStep(incidentId));

    res.json({
      incidentId,
      incident:  sanitizeIncident(incident),
      agentIdentity,
      plan,
      t3nStatus: t3n.getAgentStatus()
    });
  } catch (err) {
    console.error('[incident/start]', err.message);
    res.status(500).json({ error: 'Failed to start incident' });
  }
});

// ─── GET /api/incident/status/:id ─────────────────────────────────────────────
router.get('/status/:id', (req, res) => {
  const incident = getIncident(req.params.id);
  if (!incident) return res.status(404).json({ error: 'Incident not found' });
  res.json(sanitizeIncident(incident));
});

// ─── POST /api/incident/cancel ────────────────────────────────────────────────
router.post('/cancel', (req, res) => {
  const { incidentId } = req.body;
  if (!incidentId) return res.status(400).json({ error: 'incidentId is required' });

  const incident = getIncident(incidentId);
  if (!incident) return res.status(404).json({ error: 'Incident not found' });
  if (incident.status === 'complete') {
    return res.status(409).json({ error: 'Cannot cancel a completed incident' });
  }

  incident.status       = 'cancelled';
  incident.phase        = 'Cancelled by operator';
  incident.completeTime = new Date().toISOString();

  console.log(`🛑 Incident ${incidentId} cancelled by operator`);
  res.json({ success: true, message: `Incident ${incidentId} cancelled` });
});

// ─── GET /api/incident/active ─────────────────────────────────────────────────
router.get('/active', (_req, res) => {
  const active = [];
  for (const [id, inc] of incidentStore.entries()) {
    if (inc.status !== 'complete' && inc.status !== 'cancelled') {
      active.push({
        id,
        scenarioId:    inc.scenarioId,
        scenarioTitle: inc.scenario.title,
        status:        inc.status,
        progress:      inc.recoveryProgress,
        startTime:     inc.startTime
      });
    }
  }
  res.json(active);
});

// ─── GET /api/incident/audit-trail/:id ───────────────────────────────────────
router.get('/audit-trail/:id', (req, res) => {
  const incident = getIncident(req.params.id);
  if (!incident) return res.status(404).json({ error: 'Incident not found' });
  res.json({
    incidentId:    incident.id,
    scenarioId:    incident.scenarioId,
    facility:      incident.scenario.facility,
    agentDID:      incident.agentIdentity?.did,
    auditTrail:    incident.auditTrail,
    t3nOperations: incident.t3nOperations,
    generatedAt:   new Date().toISOString()
  });
});

// ─── GET /api/incident/scenarios ─────────────────────────────────────────────
router.get('/scenarios', (_req, res) => {
  res.json(playbook.getAllScenarios());
});

// ─── Step Execution Engine ────────────────────────────────────────────────────

async function executeNextStep(incidentId) {
  const incident = getIncident(incidentId);
  if (!incident) return;
  if (incident.status === 'complete' || incident.status === 'cancelled') return;
  if (incident.status === 'blocked') return;

  const nextStep = playbook.getNextStep(incident.scenario, incident.completedSteps);
  if (!nextStep) {
    finalizeIncident(incidentId);
    return;
  }

  incident.phase = `T3N: Checking delegation for ${nextStep.action}...`;

  // ── T3N Gatekeeper Step 1: Delegation proof ──────────────────────────────

  incident.t3nOperations.push({
    type:      'DELEGATION_CHECK',
    status:    'PENDING',
    action:    nextStep.action,
    timestamp: new Date().toISOString()
  });

  console.log(`🔐 T3N: Delegation check — ${nextStep.action}`);
  const delegResult = await t3n.checkDelegationAuthority(nextStep.action);

  incident.t3nOperations[incident.t3nOperations.length - 1] = {
    type:        'DELEGATION_CHECK',
    status:      delegResult.authorized ? 'AUTHORIZED' : 'DENIED',
    action:      nextStep.action,
    authorized:  delegResult.authorized,
    proof:       delegResult.proof,
    block_hash:  delegResult.block_hash,
    simulation:  delegResult.simulation,
    timestamp:   new Date().toISOString()
  };

  // ── Credential Permission Check (Phoenix Authority platform) ────────────
  // Refresh the active credential in case it changed since incident start
  const credCheck = checkCredentialPermission(incident.scenarioId, nextStep.action);

  // ── T3N Gatekeeper Step 2: Block if not in delegation scope ──────────────
  // CRITICAL: T3N AND credential checks both must pass.
  const credDenied = !credCheck.permitted;
  if (!delegResult.authorized || !nextStep.authorized || credDenied) {
    incident.status = 'blocked';
    incident.phase  = `Delegation boundary: ${nextStep.action} requires human approval`;

    const blockReason = credDenied
      ? `Outside credential scope: ${credCheck.reason}`
      : nextStep.reason;

    incident.pendingEscalation = {
      action:       nextStep.action,
      label:        nextStep.label,
      reason:       blockReason,
      reasoning:    nextStep.reasoning,
      approver:     nextStep.approver,
      approverRole: nextStep.approverRole,
      stepIndex:    nextStep.step,
      urgency:      'HIGH',
      blockedAt:    new Date().toISOString(),
      t3nDenied:    !delegResult.authorized,
      credDenied,
      credential:   credCheck.credential?.credential_id || null
    };

    incident.auditTrail.push({
      id:          `audit-blocked-${Date.now()}`,
      type:        'ACTION_BLOCKED',
      action:      nextStep.action,
      label:       nextStep.label,
      status:      'BLOCKED',
      reason:      blockReason,
      approver:    nextStep.approver,
      agentDID:    incident.agentIdentity?.did,
      t3nDenied:   !delegResult.authorized,
      credDenied,
      credentialId: credCheck.credential?.credential_id || null,
      timestamp:   new Date().toISOString(),
      t3nVerified: true,
      simulation:  delegResult.simulation
    });

    recordAuditEvent({
      agent:        incident.agentIdentity?.did,
      credentialId: credCheck.credential?.credential_id || null,
      action:       nextStep.action,
      result:       'BLOCKED',
      metadata:     { incidentId, credDenied, t3nDenied: !delegResult.authorized }
    });

    console.log(`🔒 BLOCKED: ${nextStep.action} — credDenied=${credDenied} t3nDenied=${!delegResult.authorized}`);
    return;
  }

  // ── Execute action ────────────────────────────────────────────────────────
  incident.phase = `Executing: ${nextStep.action}`;
  await new Promise(r => setTimeout(r, (nextStep.executionSeconds || 3) * 1000));
  const execResult = playbook.simulateStepExecution(nextStep, incident.scenario);

  // ── T3N Gatekeeper Step 3: Record tamper-proof audit VC ──────────────────
  incident.t3nOperations.push({
    type:      'AUDIT_LOG',
    status:    'LOGGING',
    action:    nextStep.action,
    timestamp: new Date().toISOString()
  });

  const auditResult = await t3n.logAuditTrail(
    nextStep.action,
    incident.agentIdentity?.did,
    execResult.success ? 'SUCCESS' : 'FAILURE',
    {
      incidentId, scenarioId: incident.scenarioId,
      facilityId: incident.scenario.facility,
      stepIndex:  nextStep.step,
      telemetry:  incident.telemetry
    }
  );

  incident.t3nOperations[incident.t3nOperations.length - 1] = {
    type:       'AUDIT_LOG',
    status:     'LOGGED',
    action:     nextStep.action,
    vcId:       auditResult.vcId,
    cid:        auditResult.cid,
    block_hash: auditResult.block_hash,
    simulation: auditResult.simulation,
    timestamp:  new Date().toISOString()
  };

  // Record completed step
  incident.completedSteps.push({
    id:              `step-${Date.now()}`,
    action:          nextStep.action,
    label:           nextStep.label,
    step:            nextStep.step,
    category:        nextStep.category,
    status:          'COMPLETE',
    reasoning:       reasoning.getStepReasoning(incident.scenario, nextStep, incident.telemetry, incident.completedSteps),
    expectedOutcome: nextStep.expectedOutcome,
    executionLog:    execResult.log,
    executedAt:      new Date().toISOString(),
    t3nVerified:     auditResult.logged,
    teeVerified:     auditResult.tee_verified,
    blockHash:       auditResult.block_hash,
    vcId:            auditResult.vcId,
    cid:             auditResult.cid,
    simulation:      auditResult.simulation,
    delegProof:      delegResult.proof,
    authorized:      true
  });

  incident.auditTrail.push({
    id:          auditResult.vcId,
    type:        'ACTION_EXECUTED',
    action:      nextStep.action,
    label:       nextStep.label,
    status:      'SUCCESS',
    agentDID:    incident.agentIdentity?.did,
    blockHash:   auditResult.block_hash,
    cid:         auditResult.cid,
    timestamp:   new Date().toISOString(),
    t3nVerified: auditResult.logged,
    teeVerified: auditResult.tee_verified,
    simulation:  auditResult.simulation
  });

  // Update telemetry + progress
  incident.telemetry = reasoning.computeUpdatedTelemetry(incident.scenario, incident.completedSteps, incident.telemetry);
  incident.telemetryHistory.push({ timestamp: Date.now(), ...incident.telemetry });
  incident.recoveryProgress = reasoning.computeRecoveryProgress(incident.scenario, incident.completedSteps);

  console.log(`✅ Step ${nextStep.step} complete: ${nextStep.action} — progress: ${incident.recoveryProgress}%`);

  // Schedule next step with a short pause
  setTimeout(() => executeNextStep(incidentId), 3200);
}

function finalizeIncident(incidentId) {
  const incident = getIncident(incidentId);
  if (!incident) return;

  const endTime  = new Date();
  const startMs  = new Date(incident.startTime).getTime();
  const durationMs = endTime.getTime() - startMs;
  const mins = Math.max(1, Math.round(durationMs / 60000));

  incident.status           = 'complete';
  incident.phase            = 'Recovery complete — all actions verified by T3N';
  incident.completeTime     = endTime.toISOString();
  incident.recoveryProgress = 100;
  incident.telemetry        = { ...incident.scenario.telemetryTargets };
  incident.recovery         = reasoning.estimateCostSaved(incident.scenario, mins);

  console.log(`🎉 Incident ${incidentId} COMPLETE — ${mins} min | Saved: $${incident.recovery.costSaved.toLocaleString()}`);
}

function sanitizeIncident(inc) {
  return {
    id:                inc.id,
    scenarioId:        inc.scenarioId,
    scenarioTitle:     inc.scenario.title,
    scenarioFacility:  inc.scenario.facility,
    scenarioSeverity:  inc.scenario.severity,
    scenarioIcon:      inc.scenario.icon,
    costPerMinute:     inc.scenario.costPerMinute,
    status:            inc.status,
    phase:             inc.phase,
    completedSteps:    inc.completedSteps,
    pendingEscalation: inc.pendingEscalation,
    auditTrail:        inc.auditTrail,
    t3nOperations:     inc.t3nOperations,
    telemetry:         inc.telemetry,
    telemetryHistory:  inc.telemetryHistory,
    telemetryLimits:   inc.scenario.telemetryLimits,
    recoveryProgress:  inc.recoveryProgress,
    plan:              inc.plan,
    agentIdentity:     inc.agentIdentity,
    agentId:           inc.agentId || null,
    activeCredential:  inc.activeCredential || null,
    activeCredPerms:   inc.activeCredPerms || [],
    startTime:         inc.startTime,
    completeTime:      inc.completeTime,
    recovery:          inc.recovery || null,
    playbookLength:    inc.scenario.playbook.length
  };
}

module.exports = router;
module.exports.getIncident     = getIncident;
module.exports.setIncident     = setIncident;
module.exports.executeNextStep = executeNextStep;
