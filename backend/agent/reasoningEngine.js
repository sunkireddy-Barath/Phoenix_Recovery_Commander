'use strict';

/**
 * Phoenix Agent Reasoning Engine
 *
 * Rule-based decision engine with a scenario reasoning tree.
 * No external API dependencies — deterministic, auditable, zero runtime cost.
 *
 * Decision flow:
 *   analyzeIncident(scenario, telemetry)
 *     → evaluates telemetry against threshold rules
 *     → maps to pre-validated recovery steps
 *     → returns structured plan with risk assessment
 */

const { SCENARIOS } = require('../data/scenarios');

// ─── Telemetry Rule Engine ────────────────────────────────────────────────────

function evaluateTelemetry(scenario, telemetry) {
  const violations = [];
  const limits = scenario.telemetryLimits;

  for (const [key, config] of Object.entries(limits)) {
    const value = telemetry[key];
    if (value == null) continue;

    const isDangerous = config.invertedDanger
      ? value < config.danger   // low value = danger (e.g. coolant flow)
      : value > config.danger;  // high value = danger (e.g. temperature)

    if (isDangerous) {
      violations.push({
        metric:  key,
        label:   config.label,
        value:   `${value}${config.unit}`,
        limit:   `${config.danger}${config.unit}`,
        severity: computeViolationSeverity(key, value, config)
      });
    }
  }

  return violations;
}

function computeViolationSeverity(metric, value, config) {
  const deviation = config.invertedDanger
    ? ((config.danger - value) / config.danger) * 100
    : ((value - config.danger) / config.danger) * 100;

  if (deviation > 50) return 'CRITICAL';
  if (deviation > 20) return 'HIGH';
  return 'MEDIUM';
}

// ─── Scenario Reasoning Templates ────────────────────────────────────────────

const REASONING = {
  'INC-001': {
    getAnalysis(telemetry) {
      const runawayMinutes = Math.max(1, Math.round(15 - (telemetry.temperature - 85) * 1.5));
      const spreadProb = Math.min(99, Math.round((telemetry.temperature - 85) * 8 + 20));
      return `THERMAL EMERGENCY — Zone 4: Temperature at ${telemetry.temperature}°C (${telemetry.temperature - 85}°C above 85°C critical threshold). Coolant flow at ${telemetry.coolant_flow} L/min (${Math.round(telemetry.coolant_flow / 45 * 100)}% of nominal 45 L/min). System pressure ${telemetry.pressure} PSI exceeds 100 PSI limit. Thermal runaway onset probability: ${spreadProb}% within ${runawayMinutes} minutes. Cascade failure to Zone 3 and Zone 5 imminent without immediate isolation.`;
    },
    getRiskLevel(telemetry) {
      if (telemetry.temperature > 95 || telemetry.pressure > 120) return 'CRITICAL';
      if (telemetry.temperature > 88 || telemetry.coolant_flow < 15) return 'HIGH';
      return 'HIGH';
    },
    estimatedRecoveryMinutes: 47
  },

  'INC-002': {
    getAnalysis(telemetry) {
      const timeToFullEncryption = Math.max(1, Math.round((100 - telemetry.encryption_progress) * 1.8));
      const exfilGB = Math.round(telemetry.network_traffic * 60 / 1024);
      return `RANSOMWARE ACTIVE — Cluster B: ${telemetry.affected_nodes} nodes compromised (${Math.round(telemetry.affected_nodes / 70 * 100)}% of Cluster B). Encryption at ${telemetry.encryption_progress}% and accelerating. At current rate, full cluster encryption in ${timeToFullEncryption} minutes. Network exfiltration at ${(telemetry.network_traffic / 1000).toFixed(1)} GB/s — estimated ${exfilGB} GB already exfiltrated. Threat actor: likely ALPHV/BlackCat variant based on encryption pattern (AES-256 + RSA-2048 key exchange observed).`;
    },
    getRiskLevel(telemetry) {
      if (telemetry.encryption_progress > 60 || telemetry.affected_nodes > 40) return 'CRITICAL';
      return 'HIGH';
    },
    estimatedRecoveryMinutes: 38
  },

  'INC-003': {
    getAnalysis(telemetry) {
      const hourlyLoss = Math.round(telemetry.cargo_delayed_tons * 0.12);
      const demurrage = telemetry.affected_vessels * 18000;
      return `CRANE SYSTEM FAILURE — Berth 7: Hydraulic fault HYD-447 (catastrophic pump assembly failure, unit HPA-7730). ${telemetry.affected_vessels} vessels unable to dock (MV Oceanic, MV Pacific Star, MS Cargo King, MV Atlas). ${telemetry.cargo_delayed_tons.toLocaleString()} tons of cargo delayed. Economic impact: $${hourlyLoss.toLocaleString()}/hour in throughput loss + $${demurrage.toLocaleString()}/day in demurrage charges. Repair ETA: 3.5 hours. Backup crane BC-3 available pending certification.`;
    },
    getRiskLevel() { return 'HIGH'; },
    estimatedRecoveryMinutes: 52
  }
};

// ─── Core Reasoning Functions ─────────────────────────────────────────────────

function analyzeIncident(scenario, telemetry) {
  const template  = REASONING[scenario.id];
  const violations = evaluateTelemetry(scenario, telemetry);

  const authorizedSteps = scenario.playbook
    .filter(s => s.authorized)
    .map(s => ({
      action:          s.action,
      label:           s.label,
      priority:        s.step,
      reason:          s.reasoning,
      authorized:      true,
      expectedOutcome: s.expectedOutcome,
      category:        s.category
    }));

  const escalations = scenario.playbook
    .filter(s => !s.authorized)
    .map(s => ({
      action:         s.action,
      label:          s.label,
      reason_blocked: s.reasoning,
      approver:       s.approver,
      urgency:        'HIGH'
    }));

  return {
    incidentId:               null, // filled in by caller
    analysis:                 template.getAnalysis(telemetry),
    risk_assessment:          template.getRiskLevel(telemetry),
    telemetry_violations:     violations,
    immediate_actions:        authorizedSteps,
    escalations:              escalations,
    estimated_recovery_time:  `${template.estimatedRecoveryMinutes} minutes`,
    estimated_recovery_mins:  template.estimatedRecoveryMinutes,
    without_agent_time:       `${template.estimatedRecoveryMinutes * 5}+ minutes`,
    agent_did:                process.env.AGENT_DID || 'did:key:phoenix-agent-001',
    analysis_timestamp:       new Date().toISOString()
  };
}

function getStepReasoning(scenario, step, telemetry, completedSteps) {
  const completedActions = completedSteps.map(s => s.action);
  const baseReasoning = step.reasoning;

  // Enrich with current telemetry context
  let context = '';
  if (scenario.id === 'INC-001') {
    if (step.action === 'SWITCH_BACKUP_COOLING' && completedActions.includes('ISOLATE_ZONE_4')) {
      context = ` Zone 4 successfully isolated. Temperature still at ${telemetry.temperature}°C — backup cooling activation is now the critical path.`;
    }
    if (step.action === 'CHECK_BACKUP_POWER' && completedActions.includes('SWITCH_BACKUP_COOLING')) {
      context = ` Backup cooling is active. Pre-restart power verification is now the final gate before primary system restoration.`;
    }
  }
  if (scenario.id === 'INC-002') {
    if (step.action === 'SNAPSHOT_CLEAN_STATE' && completedActions.includes('ISOLATE_CLUSTER_B')) {
      context = ` Cluster B isolated. Ransomware spread stopped. ${47 - completedActions.length} clean nodes available for snapshot.`;
    }
  }

  return baseReasoning + context;
}

function computeRecoveryProgress(scenario, completedSteps) {
  const totalSteps = scenario.playbook.length;
  const completedCount = completedSteps.length;
  return Math.round((completedCount / totalSteps) * 100);
}

function computeUpdatedTelemetry(scenario, completedSteps, currentTelemetry) {
  const completedCount = completedSteps.length;
  const totalAuthorized = scenario.playbook.filter(s => s.authorized).length;
  const progress = Math.min(1, completedCount / (totalAuthorized + 0.01));

  const updated = { ...currentTelemetry };
  const targets = scenario.telemetryTargets;

  // Gradually interpolate each metric toward its target value
  for (const [key, target] of Object.entries(targets)) {
    if (key === 'recovery_progress') continue;
    const current = updated[key];
    if (typeof current === 'number' && typeof target === 'number') {
      // Each completed step moves metrics ~25% of the remaining gap
      const stepImpact = 0.28;
      updated[key] = current + (target - current) * (completedCount * stepImpact * 0.7);
      // Clamp between current direction and target
      if (target > current) {
        updated[key] = Math.min(target, Math.max(current, updated[key]));
      } else {
        updated[key] = Math.max(target, Math.min(current, updated[key]));
      }
      updated[key] = Math.round(updated[key] * 10) / 10;
    }
  }

  updated.recovery_progress = computeRecoveryProgress(scenario, completedSteps);
  return updated;
}

function estimateCostSaved(scenario, recoveryMinutes) {
  const humanRecoveryMins = scenario.playbook[0] ? scenario.id === 'INC-001' ? 240 :
    scenario.id === 'INC-002' ? 180 : 210 : 180;
  const savedMinutes = humanRecoveryMins - recoveryMinutes;
  return {
    agentRecoveryMins:  recoveryMinutes,
    humanRecoveryMins,
    savedMinutes:       Math.max(0, savedMinutes),
    costSaved:          Math.max(0, savedMinutes * scenario.costPerMinute),
    downtimeCost:       recoveryMinutes * scenario.costPerMinute
  };
}

module.exports = {
  analyzeIncident,
  getStepReasoning,
  computeRecoveryProgress,
  computeUpdatedTelemetry,
  estimateCostSaved
};
