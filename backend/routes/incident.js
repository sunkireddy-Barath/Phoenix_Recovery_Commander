'use strict';

const express  = require('express');
const { v4: uuidv4 } = require('uuid');
const router   = express.Router();

const t3n          = require('../agent/t3nClient');
const reasoning    = require('../agent/reasoningEngine');
const playbook     = require('../agent/playbook');

// In-memory incident store — keyed by incidentId
const incidentStore = new Map();

// ─── Incident Store Accessors (shared with agent routes) ──────────────────────
function getIncident(id)       { return incidentStore.get(id); }
function setIncident(id, data) { incidentStore.set(id, data);  }

// ─── POST /api/incident/start ─────────────────────────────────────────────────
router.post('/start', async (req, res) => {
  try {
    const { scenarioId } = req.body;
    if (!scenarioId) return res.status(400).json({ error: 'scenarioId is required' });

    const scenario = playbook.getScenario(scenarioId);
    if (!scenario) return res.status(404).json({ error: `Scenario ${scenarioId} not found` });

    const incidentId = `INC-${Date.now()}`;

    // T3N Gatekeeper Step 1: Verify agent identity
    console.log(`🔐 T3N: Verifying Phoenix Agent identity for incident ${incidentId}...`);
    const agentIdentity = await t3n.verifyAgentIdentity();

    // Run rule-based reasoning engine
    const plan = reasoning.analyzeIncident(scenario, scenario.telemetry);
    plan.incidentId = incidentId;

    const incident = {
      id:                incidentId,
      scenarioId,
      scenario:          { ...scenario },
      status:            'executing',
      phase:             'Agent analyzing situation...',
      completedSteps:    [],
      pendingEscalation: null,
      auditTrail:        [],
      t3nOperations:     [],
      telemetry:         { ...scenario.telemetry },
      telemetryHistory:  [{ timestamp: Date.now(), ...scenario.telemetry }],
      recoveryProgress:  0,
      plan,
      agentIdentity,
      startTime:         new Date().toISOString(),
      completeTime:      null,
      costAccrued:       0
    };

    setIncident(incidentId, incident);

    // Kick off async step execution (non-blocking)
    setImmediate(() => executeNextStep(incidentId));

    res.json({
      incidentId,
      incident: sanitizeIncident(incident),
      agentIdentity,
      plan,
      t3nStatus: t3n.getAgentStatus()
    });
  } catch (err) {
    console.error('incident/start error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/incident/status/:id ─────────────────────────────────────────────
router.get('/status/:id', (req, res) => {
  const incident = getIncident(req.params.id);
  if (!incident) return res.status(404).json({ error: 'Incident not found' });
  res.json(sanitizeIncident(incident));
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
router.get('/scenarios', (req, res) => {
  res.json(playbook.getAllScenarios());
});

// ─── Step Execution Engine ────────────────────────────────────────────────────

async function executeNextStep(incidentId) {
  const incident = getIncident(incidentId);
  if (!incident || incident.status === 'complete' || incident.status === 'cancelled') return;
  if (incident.status === 'blocked') return; // Waiting for human approval

  const nextStep = playbook.getNextStep(incident.scenario, incident.completedSteps);
  if (!nextStep) {
    // All steps complete
    finalizeIncident(incidentId);
    return;
  }

  incident.phase = `T3N validating delegation for: ${nextStep.action}`;

  // ── T3N Gatekeeper Flow ──────────────────────────────────────────────────

  // Step 1: T3N delegation check
  incident.t3nOperations.push({
    type:      'DELEGATION_CHECK',
    status:    'PENDING',
    action:    nextStep.action,
    timestamp: new Date().toISOString()
  });

  console.log(`🔐 T3N: Checking delegation for ${nextStep.action}...`);
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

  // Step 2: If not authorized → block and wait for human
  if (!nextStep.authorized) {
    incident.status = 'blocked';
    incident.phase  = `Awaiting approval: ${nextStep.action}`;
    incident.pendingEscalation = {
      action:      nextStep.action,
      label:       nextStep.label,
      reason:      nextStep.reason,
      reasoning:   nextStep.reasoning,
      approver:    nextStep.approver,
      approverRole: nextStep.approverRole,
      stepIndex:   nextStep.step,
      urgency:     'HIGH',
      blockedAt:   new Date().toISOString()
    };

    incident.auditTrail.push({
      id:          `audit-blocked-${Date.now()}`,
      type:        'ACTION_BLOCKED',
      action:      nextStep.action,
      label:       nextStep.label,
      status:      'BLOCKED',
      reason:      nextStep.reason,
      approver:    nextStep.approver,
      agentDID:    incident.agentIdentity?.did,
      timestamp:   new Date().toISOString(),
      t3nVerified: true,
      simulation:  delegResult.simulation
    });

    console.log(`🔒 Step ${nextStep.step} BLOCKED: ${nextStep.action} — requires ${nextStep.approver} approval`);
    return;
  }

  // Step 3: Execute action
  incident.phase = `Executing: ${nextStep.action}`;
  await new Promise(r => setTimeout(r, (nextStep.executionSeconds || 3) * 1000));

  const execResult = playbook.simulateStepExecution(nextStep, incident.scenario);

  // Step 4: T3N audit trail recording
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
      incidentId:  incidentId,
      scenarioId:  incident.scenarioId,
      facilityId:  incident.scenario.facility,
      stepIndex:   nextStep.step,
      telemetry:   incident.telemetry
    }
  );

  incident.t3nOperations[incident.t3nOperations.length - 1] = {
    type:        'AUDIT_LOG',
    status:      'LOGGED',
    action:      nextStep.action,
    vcId:        auditResult.vcId,
    cid:         auditResult.cid,
    block_hash:  auditResult.block_hash,
    simulation:  auditResult.simulation,
    timestamp:   new Date().toISOString()
  };

  // Step 5: Record completed step
  const stepEntry = {
    id:          `step-${Date.now()}`,
    action:      nextStep.action,
    label:       nextStep.label,
    step:        nextStep.step,
    category:    nextStep.category,
    status:      'COMPLETE',
    reasoning:   reasoning.getStepReasoning(incident.scenario, nextStep, incident.telemetry, incident.completedSteps),
    expectedOutcome: nextStep.expectedOutcome,
    executionLog:    execResult.log,
    executedAt:  new Date().toISOString(),
    t3nVerified: auditResult.logged,
    teeVerified: auditResult.tee_verified,
    blockHash:   auditResult.block_hash,
    vcId:        auditResult.vcId,
    cid:         auditResult.cid,
    simulation:  auditResult.simulation,
    delegProof:  delegResult.proof,
    authorized:  true
  };

  incident.completedSteps.push(stepEntry);

  // Add to audit trail
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

  // Update telemetry
  incident.telemetry = reasoning.computeUpdatedTelemetry(
    incident.scenario, incident.completedSteps, incident.telemetry
  );
  incident.telemetryHistory.push({ timestamp: Date.now(), ...incident.telemetry });
  incident.recoveryProgress = reasoning.computeRecoveryProgress(incident.scenario, incident.completedSteps);

  console.log(`✅ Step ${nextStep.step} complete: ${nextStep.action}`);

  // Schedule next step
  setTimeout(() => executeNextStep(incidentId), 3200);
}

function finalizeIncident(incidentId) {
  const incident = getIncident(incidentId);
  if (!incident) return;

  incident.status       = 'complete';
  incident.phase        = 'Recovery complete';
  incident.completeTime = new Date().toISOString();
  incident.recoveryProgress = 100;
  incident.telemetry    = { ...incident.scenario.telemetryTargets };

  const mins = Math.round((new Date(incident.completeTime) - new Date(incident.startTime)) / 60000);
  incident.recovery = reasoning.estimateCostSaved(incident.scenario, mins);

  console.log(`🎉 Incident ${incidentId} COMPLETE — ${mins} minutes`);
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
    startTime:         inc.startTime,
    completeTime:      inc.completeTime,
    recovery:          inc.recovery || null,
    playbookLength:    inc.scenario.playbook.length
  };
}

// Export store accessors for use in agent routes
module.exports = router;
module.exports.getIncident    = getIncident;
module.exports.setIncident    = setIncident;
module.exports.executeNextStep = executeNextStep;
