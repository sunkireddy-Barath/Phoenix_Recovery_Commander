import React, { useState } from 'react';
import { Download, ChevronDown, ChevronRight, Shield, Link, User } from 'lucide-react';
import T3NCredentialBadge from './T3NCredentialBadge.jsx';

function AuditEntry({ entry, expanded, onToggle }) {
  const isApproval   = entry.type === 'HUMAN_APPROVAL';
  const isRejection  = entry.type === 'HUMAN_REJECTION';
  const isBlocked    = entry.status === 'BLOCKED';
  const isSuccess    = entry.status === 'SUCCESS';

  const dotColor =
    isApproval ? 'bg-green-500' :
    isRejection ? 'bg-red-500' :
    isBlocked   ? 'bg-amber-500' :
    isSuccess   ? 'bg-green-500' : 'bg-slate-500';

  const borderColor =
    isApproval ? 'border-l-green-500/50' :
    isRejection ? 'border-l-red-500/50' :
    isBlocked   ? 'border-l-amber-500/50' :
    isSuccess   ? 'border-l-blue-500/30' : 'border-l-slate-700';

  return (
    <div className={`border-l-2 ${borderColor} pl-3 pb-3 ml-2`}>
      {/* Timeline dot */}
      <div className="flex items-start gap-2">
        <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 -ml-4 ${dotColor}`} />

        <div className="flex-1 min-w-0">
          {/* Entry header */}
          <button
            onClick={onToggle}
            className="w-full flex items-start justify-between gap-2 text-left hover:bg-slate-800/30 rounded p-1 -m-1 transition-colors">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <span className="text-[10px]">
                {isApproval ? '👤' : isRejection ? '❌' : isBlocked ? '🔒' : '✅'}
              </span>
              <span className={`text-xs font-bold truncate ${
                isApproval ? 'text-green-400' :
                isRejection ? 'text-red-400' :
                isBlocked   ? 'text-amber-400' : 'text-slate-300'
              }`}>
                {entry.label || entry.action}
              </span>
            </div>
            <div className="flex-shrink-0 flex items-center gap-1">
              {expanded ? <ChevronDown size={10} className="text-slate-500" /> :
                          <ChevronRight size={10} className="text-slate-500" />}
            </div>
          </button>

          {/* Always-visible badges */}
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            {entry.t3nVerified && <T3NCredentialBadge variant="VERIFIED" simulation={entry.simulation} />}
            {entry.teeVerified && <T3NCredentialBadge variant="TEE_CONFIRMED" simulation={entry.simulation} />}
            {entry.blockHash   && <T3NCredentialBadge variant="BLOCKCHAIN" simulation={entry.simulation} />}
            {isApproval        && <T3NCredentialBadge variant="APPROVED" simulation={entry.simulation} />}
          </div>

          {/* Timestamp + hash preview */}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[9px] text-slate-600 font-mono">
              {new Date(entry.timestamp).toLocaleTimeString()}
            </span>
            {entry.blockHash && (
              <span className="text-[9px] text-slate-700 font-mono">
                {entry.blockHash.slice(0, 10)}…
              </span>
            )}
          </div>

          {/* Expanded details */}
          {expanded && (
            <div className="mt-2 bg-slate-900/60 rounded p-2 space-y-1 text-[10px] font-mono">
              {entry.agentDID && (
                <div>
                  <span className="text-slate-500">Agent DID: </span>
                  <span className="text-blue-400 break-all">{entry.agentDID}</span>
                </div>
              )}
              {entry.blockHash && (
                <div>
                  <span className="text-slate-500">Block Hash: </span>
                  <span className="text-green-400 break-all">{entry.blockHash}</span>
                </div>
              )}
              {entry.cid && (
                <div>
                  <span className="text-slate-500">IPFS CID: </span>
                  <span className="text-purple-400 break-all">{entry.cid}</span>
                </div>
              )}
              {entry.id && (
                <div>
                  <span className="text-slate-500">VC ID: </span>
                  <span className="text-slate-400 break-all">{entry.id}</span>
                </div>
              )}
              {entry.approvedBy && (
                <div>
                  <span className="text-slate-500">Approved by: </span>
                  <span className="text-green-400">{entry.approvedBy}</span>
                </div>
              )}
              {entry.simulation && (
                <div className="text-amber-500">⚠ Simulated — add T3N_API_KEY for live</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function generateAuditReport(incident, auditTrail) {
  const lines = [
    '═══════════════════════════════════════════════════════════════',
    '          PHOENIX INDUSTRIAL RECOVERY — T3N AUDIT REPORT       ',
    '═══════════════════════════════════════════════════════════════',
    '',
    `Incident ID:    ${incident.id}`,
    `Scenario:       ${incident.scenarioTitle}`,
    `Facility:       ${incident.scenarioFacility}`,
    `Severity:       ${incident.scenarioSeverity}`,
    `Start Time:     ${new Date(incident.startTime).toISOString()}`,
    `Complete Time:  ${incident.completeTime ? new Date(incident.completeTime).toISOString() : 'In Progress'}`,
    `Agent DID:      ${incident.agentIdentity?.did || 'N/A'}`,
    `T3N Mode:       ${incident.agentIdentity?.simulation ? 'SIMULATION' : 'LIVE'}`,
    '',
    '─── DELEGATION CREDENTIALS ──────────────────────────────────',
    `Delegation VC:  ${incident.agentIdentity?.delegationVcId || 'N/A'}`,
    '',
    '─── AUDIT TRAIL (T3N Verified) ──────────────────────────────',
    '',
    ...auditTrail.map((e, i) => [
      `[${String(i+1).padStart(3,'0')}] ${new Date(e.timestamp).toISOString()}`,
      `      Action:     ${e.action}`,
      `      Status:     ${e.status}`,
      `      T3N:        ${e.t3nVerified ? '✓ VERIFIED' : '✗ UNVERIFIED'}`,
      `      TEE:        ${e.teeVerified ? '✓ CONFIRMED' : 'N/A'}`,
      `      Block Hash: ${e.blockHash || 'N/A'}`,
      `      CID:        ${e.cid || 'N/A'}`,
      e.approvedBy ? `      Approved by:${e.approvedBy}` : null,
      ''
    ].filter(Boolean).join('\n')),
    '',
    '─── RECOVERY SUMMARY ────────────────────────────────────────',
    ...(incident.recovery ? [
      `Agent Recovery Time:  ${incident.recovery.agentRecoveryMins} minutes`,
      `Manual Estimate:      ${incident.recovery.humanRecoveryMins} minutes`,
      `Time Saved:           ${incident.recovery.savedMinutes} minutes`,
      `Estimated Cost Saved: $${incident.recovery.costSaved.toLocaleString()}`,
    ] : ['Recovery in progress']),
    '',
    `Generated: ${new Date().toISOString()}`,
    '═══════════════════════════════════════════════════════════════'
  ];
  return lines.join('\n');
}

export default function AuditTrail({ incident }) {
  const [expanded, setExpanded] = useState({});

  const toggle = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const exportReport = () => {
    if (!incident) return;
    const report = generateAuditReport(incident, incident.auditTrail || []);
    const blob = new Blob([report], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-${incident.id}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!incident) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/60 flex-shrink-0">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">T3N Audit Trail</h2>
        </div>
        <div className="flex-1 flex items-center justify-center text-center p-6">
          <div className="space-y-2">
            <div className="text-2xl">⛓</div>
            <p className="text-slate-600 text-xs">Audit trail will populate as the agent executes actions</p>
            <div className="mt-3 text-[9px] text-slate-700 leading-relaxed">
              Every action is recorded as a Verifiable Credential on the T3N blockchain.
              Tamper-proof. TEE-verified. Cryptographically signed.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const trail = incident.auditTrail || [];
  const agentStatus = incident.agentIdentity;
  const simulationMode = agentStatus?.simulation !== false;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-slate-700/60 flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-xs font-bold text-slate-300 uppercase tracking-widest">T3N Audit Trail</h2>
          <p className="text-[9px] text-slate-600 mt-0.5">{trail.length} entries recorded</p>
        </div>
        {trail.length > 0 && (
          <button onClick={exportReport}
            className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-200 bg-slate-700/40 hover:bg-slate-700/70 px-2 py-1 rounded transition-colors">
            <Download size={10} />
            Export
          </button>
        )}
      </div>

      {/* Agent DID info */}
      {agentStatus && (
        <div className="px-4 py-2 border-b border-slate-800/60 bg-blue-500/5 flex-shrink-0">
          <p className="text-[9px] text-slate-500 mb-0.5">Phoenix Agent</p>
          <p className="text-[10px] text-blue-400 font-mono font-bold break-all">
            {agentStatus.did}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <T3NCredentialBadge variant="VERIFIED" simulation={simulationMode} />
            {!simulationMode && <T3NCredentialBadge variant="TEE_CONFIRMED" />}
            {simulationMode && (
              <span className="text-[9px] text-slate-600">
                Simulation — T3N_API_KEY not set
              </span>
            )}
          </div>
        </div>
      )}

      {/* Simulation notice */}
      {simulationMode && trail.length > 0 && (
        <div className="px-4 py-1.5 bg-amber-500/5 border-b border-amber-500/20 flex-shrink-0">
          <p className="text-[9px] text-amber-500/70 leading-relaxed">
            ⚠ Running in simulation mode. T3N calls simulated with real API structure.
            Add T3N_API_KEY to backend/.env for live mode.
          </p>
        </div>
      )}

      {/* Trail entries */}
      <div className="flex-1 overflow-y-auto px-3 py-3 min-h-0">
        {trail.length === 0 ? (
          <div className="flex items-center justify-center h-16">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
              <span>Waiting for first action...</span>
            </div>
          </div>
        ) : (
          <div className="space-y-0">
            {trail.map((entry, idx) => (
              <AuditEntry
                key={entry.id || idx}
                entry={entry}
                expanded={!!expanded[entry.id || idx]}
                onToggle={() => toggle(entry.id || idx)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Summary footer */}
      {incident.status === 'complete' && (
        <div className="border-t border-slate-700/60 px-4 py-2 bg-green-500/5 flex-shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <span className="text-[10px] text-green-400 font-bold">AUDIT COMPLETE</span>
          </div>
          <p className="text-[9px] text-slate-600">
            {trail.length} actions recorded · All verified by T3N · Tamper-proof
          </p>
        </div>
      )}
    </div>
  );
}
