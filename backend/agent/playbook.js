'use strict';

/**
 * Phoenix Agent Playbook — Authority Enforcement Engine
 *
 * Enforces the principle: "No action executes without verified delegation."
 * Every execution attempt is validated against the delegation scope before
 * the T3N proof check is even requested — two-layer protection.
 */

const { SCENARIOS } = require('../data/scenarios');
const { getStepReasoning, computeUpdatedTelemetry } = require('./reasoningEngine');

// ─── Authority Validation ─────────────────────────────────────────────────────

function validateAction(action, scenarioId) {
  const scenario = SCENARIOS.find(s => s.id === scenarioId);
  if (!scenario) return { allowed: false, reason: `Unknown scenario: ${scenarioId}` };

  const step = scenario.playbook.find(s => s.action === action);
  if (!step) return { allowed: false, reason: `Action ${action} is not in playbook for ${scenarioId}` };

  if (!step.authorized) {
    return {
      allowed:   false,
      reason:    step.reason,
      approver:  step.approver,
      approverRole: step.approverRole,
      step:      step.step
    };
  }

  return {
    allowed:   true,
    reason:    step.reason,
    step:      step.step,
    category:  step.category
  };
}

// ─── Step Navigation ──────────────────────────────────────────────────────────

function getNextStep(scenario, completedSteps) {
  const completedActions = completedSteps.map(s => s.action);
  const nextStep = scenario.playbook.find(s => !completedActions.includes(s.action));
  return nextStep || null;
}

function getStepByAction(scenario, action) {
  return scenario.playbook.find(s => s.action === action) || null;
}

// ─── Step Execution Simulation ────────────────────────────────────────────────

function simulateStepExecution(step, scenario) {
  // Simulate the physical execution with realistic outcomes
  const outcomes = {
    'ISOLATE_ZONE_4':             { success: true, log: 'Zone 4 electrical breakers tripped. Thermal vents sealed. Zone control systems disabled. Isolation confirmed in 87 seconds.' },
    'NOTIFY_SAFETY_TEAM':         { success: true, log: 'Emergency broadcast sent to Safety Team Alpha (8 personnel). Evacuation protocol EP-14 activated. 23 non-essential workers cleared.' },
    'SWITCH_BACKUP_COOLING':      { success: true, log: 'Backup cooling circuit CC-B4 activated. Flow rate increasing: 8→22→35 L/min. Temperature gradient stabilizing.' },
    'CHECK_BACKUP_POWER':         { success: true, log: 'UPS-4: 98% capacity ✓. DG-2 diesel generator: Online ✓. Voltage: 11.2kV stable ✓. Power systems nominal for restart.' },
    'RESTART_PRIMARY_COOLING':    { success: true, log: 'Primary cooling pump P4-A restarted under controlled conditions. Flow rate nominal at 47 L/min. Temperature dropping steadily.' },
    'NOTIFY_REGULATOR':           { success: true, log: 'Regulatory notification filed with NRC. Incident classified as Level 1 by Supervisor. Reference: NRC-2026-0604-001.' },

    'ISOLATE_CLUSTER_B':          { success: true, log: 'VLAN 204 segmentation applied at switch SW-B-01/02. All 47 inbound/outbound routes for Cluster B severed. Isolation confirmed at network layer.' },
    'SNAPSHOT_CLEAN_STATE':       { success: true, log: '47 VM snapshots captured in 4m 22s. Snapshot hashes recorded. SHA-256 integrity verified. Recovery baseline established.' },
    'NOTIFY_SECURITY_TEAM':       { success: true, log: 'SOC team activated (12 analysts). CIRT bridge call established. FBI Cyber Division notified (Case #2026-06-04-DC-001). Forensic tools deployed.' },
    'BLOCK_EXTERNAL_TRAFFIC':     { success: true, log: 'Firewall rule FW-BLOCK-C2-001 applied. Outbound TCP/443 to 185.220.0.0/16 blocked. Exfiltration traffic dropped to 0 MB/s. C2 comms severed.' },
    'RESTORE_FROM_BACKUP':        { success: true, log: 'CISO verified backup integrity (hash match confirmed). Restoration initiated for 23 nodes from T-2h snapshot. ETA: 38 minutes.' },
    'NOTIFY_AFFECTED_CLIENTS':    { success: true, log: 'GDPR-compliant breach notification sent to 147 affected clients. Legal-approved wording. DPA notification filed. Reference: GDPR-2026-0604-NDC.' },

    'HALT_BERTH_7_OPERATIONS':    { success: true, log: 'Berth 7 operations halted via Port Operations System. Safety perimeter (50m radius) established. All 6 dock workers evacuated safely.' },
    'REDIRECT_VESSELS_BERTH_9':   { success: true, log: 'VTS redirect instructions issued to MV Oceanic, MV Pacific Star, MS Cargo King, MV Atlas. All 4 vessels acknowledging. ETA Berth 9: 35–50 minutes.' },
    'DISPATCH_MAINTENANCE_TEAM':  { success: true, log: 'Team Kilo (6 technicians) dispatched with part HPA-7730. ETA: 22 minutes. Crane access scaffold requested from port logistics.' },
    'NOTIFY_VESSEL_OPERATORS':    { success: true, log: 'NAVTEX broadcast issued. 4 operator companies notified via VDES and email. Revised ETAs transmitted. Demurrage claim procedures initiated.' },
    'ENGAGE_BACKUP_CRANE':        { success: true, log: 'BC-3 certification verified by Port Authority (Inspector Chen, badge #PA-7741). Operational clearance issued. BC-3 startup sequence initiated.' },
    'NOTIFY_CUSTOMS_AUTHORITY':   { success: true, log: 'Customs notification filed per Regulation 18(b). Harbor Master authorization reference HM-2026-0604-B7. No additional inspection triggered.' }
  };

  const result = outcomes[step.action] || {
    success: true,
    log: `${step.action} executed successfully via Phoenix Agent automation.`
  };

  return {
    ...result,
    action:    step.action,
    stepIndex: step.step,
    executedAt: new Date().toISOString(),
    executionMs: (step.executionSeconds || 3) * 1000
  };
}

// ─── Scenario Lookup ──────────────────────────────────────────────────────────

function getScenario(scenarioId) {
  return SCENARIOS.find(s => s.id === scenarioId) || null;
}

function getAllScenarios() {
  return SCENARIOS.map(s => {
    // Build display metrics from telemetry + limits for the UI cards
    const displayMetrics = Object.entries(s.telemetryLimits).map(([key, cfg]) => ({
      key,
      label:       cfg.label,
      value:       formatTelemetryValue(s.telemetry[key], cfg.unit),
      rawValue:    s.telemetry[key],
      limit:       `${cfg.danger}${cfg.unit}`,
      danger:      cfg.invertedDanger
        ? (s.telemetry[key] < cfg.danger)
        : (s.telemetry[key] > cfg.danger)
    }));

    return {
      id:              s.id,
      title:           s.title,
      facility:        s.facility,
      facilityType:    s.facilityType,
      icon:            s.icon,
      severity:        s.severity,
      costPerMinute:   s.costPerMinute,
      description:     s.description,
      telemetry:       s.telemetry,
      telemetryLimits: s.telemetryLimits,
      displayMetrics,
      playbookLength:  s.playbook.length,
      authorizedSteps: s.playbook.filter(p => p.authorized).length,
      blockedSteps:    s.playbook.filter(p => !p.authorized).length,
      playbook:        s.playbook.map(p => ({
        step:         p.step,
        action:       p.action,
        label:        p.label,
        authorized:   p.authorized,
        category:     p.category,
        approver:     p.approver || null,
        approverRole: p.approverRole || null
      }))
    };
  });
}

function formatTelemetryValue(val, unit) {
  if (val == null) return 'N/A';
  if (typeof val === 'number') {
    return `${val.toLocaleString()}${unit}`;
  }
  return `${val}${unit}`;
}

module.exports = {
  validateAction,
  getNextStep,
  getStepByAction,
  simulateStepExecution,
  getScenario,
  getAllScenarios
};
