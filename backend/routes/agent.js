'use strict';

const express = require('express');
const router  = express.Router();

const t3n       = require('../agent/t3nClient');
const reasoning = require('../agent/reasoningEngine');
const playbook  = require('../agent/playbook');

// Import incident store from incident routes
const incidentRoutes = require('./incident');
const getIncident     = incidentRoutes.getIncident;
const executeNextStep = incidentRoutes.executeNextStep;

// ─── GET /api/agent/identity ──────────────────────────────────────────────────
router.get('/identity', async (req, res) => {
  try {
    const identity = await t3n.verifyAgentIdentity();
    const status   = t3n.getAgentStatus();
    res.json({ ...identity, ...status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/agent/approve-escalation ──────────────────────────────────────
router.post('/approve-escalation', async (req, res) => {
  try {
    const { incidentId, action, approvedBy, approverRole } = req.body;
    if (!incidentId || !action || !approvedBy) {
      return res.status(400).json({ error: 'incidentId, action, and approvedBy are required' });
    }

    const incident = getIncident(incidentId);
    if (!incident) return res.status(404).json({ error: 'Incident not found' });
    if (incident.status !== 'blocked') {
      return res.status(400).json({ error: 'Incident is not in blocked state' });
    }
    if (!incident.pendingEscalation || incident.pendingEscalation.action !== action) {
      return res.status(400).json({ error: `No pending escalation for action ${action}` });
    }

    console.log(`👤 Human approval: ${action} by ${approvedBy}`);

    // Log human approval as a T3N audit VC
    const approvalAudit = await t3n.logAuditTrail(
      'HUMAN_APPROVAL',
      incident.agentIdentity?.did,
      'APPROVED',
      {
        incidentId,
        scenarioId:  incident.scenarioId,
        approvedBy,
        approverRole: approverRole || incident.pendingEscalation.approverRole,
        action,
        telemetry: incident.telemetry
      }
    );

    incident.auditTrail.push({
      id:          approvalAudit.vcId,
      type:        'HUMAN_APPROVAL',
      action:      'HUMAN_APPROVAL',
      label:       `Approved by ${approvedBy}`,
      status:      'APPROVED',
      approvedBy,
      approverRole: approverRole || incident.pendingEscalation.approverRole,
      approvedAction: action,
      agentDID:    incident.agentIdentity?.did,
      blockHash:   approvalAudit.block_hash,
      cid:         approvalAudit.cid,
      timestamp:   new Date().toISOString(),
      t3nVerified: approvalAudit.logged,
      teeVerified: approvalAudit.tee_verified,
      simulation:  approvalAudit.simulation
    });

    // Find the blocked step in the playbook and mark it as authorized for this execution
    const blockedStep = incident.scenario.playbook.find(s => s.action === action);
    if (blockedStep) {
      // Temporarily allow this step execution
      const approvedStep = { ...blockedStep, authorized: true };

      // Execute the step
      const execResult = playbook.simulateStepExecution(approvedStep, incident.scenario);

      const execAudit = await t3n.logAuditTrail(
        action,
        incident.agentIdentity?.did,
        'SUCCESS',
        {
          incidentId,
          scenarioId:  incident.scenarioId,
          stepIndex:   approvedStep.step,
          approvedBy,
          approverRole,
          telemetry:   incident.telemetry
        }
      );

      const stepEntry = {
        id:          `step-approved-${Date.now()}`,
        action:      approvedStep.action,
        label:       approvedStep.label,
        step:        approvedStep.step,
        category:    approvedStep.category,
        status:      'COMPLETE',
        reasoning:   approvedStep.reasoning,
        expectedOutcome: approvedStep.expectedOutcome,
        executionLog:    execResult.log,
        executedAt:  new Date().toISOString(),
        t3nVerified: execAudit.logged,
        teeVerified: execAudit.tee_verified,
        blockHash:   execAudit.block_hash,
        vcId:        execAudit.vcId,
        cid:         execAudit.cid,
        simulation:  execAudit.simulation,
        authorized:  true,
        humanApproved: true,
        approvedBy,
        approverRole
      };

      incident.completedSteps.push(stepEntry);

      incident.auditTrail.push({
        id:          execAudit.vcId,
        type:        'ACTION_EXECUTED',
        action:      approvedStep.action,
        label:       approvedStep.label,
        status:      'SUCCESS',
        agentDID:    incident.agentIdentity?.did,
        blockHash:   execAudit.block_hash,
        cid:         execAudit.cid,
        timestamp:   new Date().toISOString(),
        t3nVerified: execAudit.logged,
        teeVerified: execAudit.tee_verified,
        humanApproved: true,
        approvedBy,
        simulation:  execAudit.simulation
      });

      // Update telemetry
      incident.telemetry = reasoning.computeUpdatedTelemetry(
        incident.scenario, incident.completedSteps, incident.telemetry
      );
      incident.telemetryHistory.push({ timestamp: Date.now(), ...incident.telemetry });
      incident.recoveryProgress = reasoning.computeRecoveryProgress(incident.scenario, incident.completedSteps);
    }

    // Clear blocked state and resume
    incident.pendingEscalation = null;
    incident.status = 'executing';
    incident.phase  = 'Resuming after human approval...';

    // Resume execution loop
    setTimeout(() => executeNextStep(incidentId), 2500);

    res.json({
      success:     true,
      message:     `Action ${action} approved and executed`,
      approvalAudit,
      incidentStatus: incident.status
    });
  } catch (err) {
    console.error('approve-escalation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/agent/reject-escalation ───────────────────────────────────────
router.post('/reject-escalation', async (req, res) => {
  try {
    const { incidentId, action, rejectedBy, reason } = req.body;

    const incident = getIncident(incidentId);
    if (!incident) return res.status(404).json({ error: 'Incident not found' });

    // Log rejection
    const rejectAudit = await t3n.logAuditTrail(
      'HUMAN_REJECTION',
      incident.agentIdentity?.did,
      'REJECTED',
      { incidentId, action, rejectedBy, reason }
    );

    incident.auditTrail.push({
      id:          rejectAudit.vcId,
      type:        'HUMAN_REJECTION',
      action:      'HUMAN_REJECTION',
      label:       `Rejected by ${rejectedBy}`,
      status:      'REJECTED',
      rejectedBy,
      rejectedAction: action,
      reason,
      timestamp:   new Date().toISOString(),
      t3nVerified: rejectAudit.logged,
      simulation:  rejectAudit.simulation
    });

    incident.pendingEscalation = null;
    incident.status = 'blocked';
    incident.phase  = `Step rejected by ${rejectedBy}. Manual intervention required.`;

    res.json({ success: true, message: `Action ${action} rejected` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/agent/replan ───────────────────────────────────────────────────
router.post('/replan', async (req, res) => {
  try {
    const { incidentId, newTelemetry } = req.body;

    const incident = getIncident(incidentId);
    if (!incident) return res.status(404).json({ error: 'Incident not found' });

    if (newTelemetry) {
      incident.telemetry = { ...incident.telemetry, ...newTelemetry };
      incident.telemetryHistory.push({ timestamp: Date.now(), ...incident.telemetry });
    }

    const newPlan = reasoning.analyzeIncident(incident.scenario, incident.telemetry);
    newPlan.incidentId = incidentId;
    incident.plan = newPlan;

    res.json({ success: true, plan: newPlan, telemetry: incident.telemetry });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
