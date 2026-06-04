import React, { useRef, useEffect } from 'react';
import { Shield, Lock, CheckCircle, Clock, Cpu, Link, ChevronRight, AlertTriangle, User } from 'lucide-react';
import T3NCredentialBadge from './T3NCredentialBadge.jsx';

const CATEGORY_ICONS = {
  ISOLATE:   '🔌',
  NOTIFY:    '📡',
  SWITCH:    '🔄',
  CHECK:     '🔍',
  RESTART:   '⚡',
  SNAPSHOT:  '💾',
  BLOCK:     '🚫',
  RESTORE:   '♻️',
  HALT:      '🛑',
  REDIRECT:  '↗️',
  DISPATCH:  '🚑',
  ENGAGE:    '🏗',
  DEFAULT:   '⚙️'
};

function StepEntry({ step, index }) {
  const isBlocked     = step.status === 'BLOCKED';
  const isApproved    = step.humanApproved;
  const isApproval    = step.type === 'HUMAN_APPROVAL';
  const isRejection   = step.type === 'HUMAN_REJECTION';

  if (isApproval) {
    return (
      <div className="step-slide-in flex gap-3 px-4 py-3 border-b border-slate-800/60 bg-green-500/5">
        <div className="flex-shrink-0 mt-0.5">
          <div className="w-6 h-6 rounded bg-green-500/20 flex items-center justify-center">
            <User size={12} className="text-green-400" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-green-400 text-xs font-bold">👤 HUMAN APPROVAL</span>
            <T3NCredentialBadge variant="APPROVED" simulation={step.simulation} />
            <T3NCredentialBadge variant="BLOCKCHAIN" simulation={step.simulation} />
          </div>
          <p className="text-slate-300 text-xs">{step.label}</p>
          {step.blockHash && (
            <p className="text-slate-600 text-[10px] font-mono mt-1">
              Block: {step.blockHash.slice(0, 18)}…
            </p>
          )}
        </div>
      </div>
    );
  }

  if (isRejection) {
    return (
      <div className="step-slide-in flex gap-3 px-4 py-3 border-b border-slate-800/60 bg-red-500/5">
        <div className="flex-shrink-0 mt-0.5">
          <div className="w-6 h-6 rounded bg-red-500/20 flex items-center justify-center">
            <User size={12} className="text-red-400" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-red-400 text-xs font-bold">❌ REJECTED BY HUMAN</span>
          <p className="text-slate-400 text-xs mt-0.5">{step.label}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`
      step-slide-in flex gap-3 px-4 py-3 border-b border-slate-800/60
      ${isBlocked ? 'blocked-pulse bg-red-500/5 border border-red-500/20 mx-3 rounded-lg mb-2' :
        isApproved ? 'bg-green-500/5' : 'hover:bg-slate-800/30'}
      transition-colors
    `}>
      {/* Step number / icon */}
      <div className="flex-shrink-0 mt-0.5">
        <div className={`
          w-6 h-6 rounded flex items-center justify-center text-sm
          ${isBlocked ? 'bg-red-500/20' : isApproved ? 'bg-green-500/20' : 'bg-slate-700/60'}
        `}>
          {isBlocked ? '🔒' : CATEGORY_ICONS[step.category] || CATEGORY_ICONS.DEFAULT}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className={`text-xs font-bold ${
              isBlocked ? 'text-red-400' : isApproved ? 'text-green-400' : 'text-slate-200'
            }`}>
              Step {step.step} — {step.label || step.action}
            </span>
          </div>
          {step.executedAt && (
            <span className="text-[10px] text-slate-600 font-mono flex-shrink-0">
              {new Date(step.executedAt).toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* T3N Badges */}
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          {isBlocked ? (
            <>
              <T3NCredentialBadge variant="BLOCKED" />
              <span className="text-[10px] text-red-400/70">Outside delegation scope</span>
            </>
          ) : (
            <>
              <T3NCredentialBadge variant="VERIFIED" simulation={step.simulation} />
              {step.teeVerified && <T3NCredentialBadge variant="TEE_CONFIRMED" simulation={step.simulation} />}
              {step.cid && <T3NCredentialBadge variant="BLOCKCHAIN" simulation={step.simulation} />}
              {isApproved && <T3NCredentialBadge variant="APPROVED" simulation={step.simulation} />}
            </>
          )}
        </div>

        {/* Reasoning */}
        {step.reasoning && (
          <div className="mb-2">
            <p className="text-[10px] text-slate-500 mb-0.5 flex items-center gap-1">
              <span>🧠</span> Agent Reasoning
            </p>
            <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
              {step.reasoning.replace(/^\[BLOCKED\] /, '')}
            </p>
          </div>
        )}

        {/* Execution log */}
        {step.executionLog && !isBlocked && (
          <div className="bg-slate-900/60 rounded px-2 py-1 mb-2">
            <p className="text-[10px] text-green-400 leading-relaxed">
              ✓ {step.executionLog.slice(0, 120)}{step.executionLog.length > 120 ? '…' : ''}
            </p>
          </div>
        )}

        {/* Blocked state */}
        {isBlocked && (
          <div className="bg-red-500/5 border border-red-500/20 rounded p-2">
            <p className="text-[10px] text-red-400 font-bold mb-0.5">
              ❌ BLOCKED — Delegation boundary reached
            </p>
            <p className="text-[10px] text-slate-400">
              👤 Escalated to: {step.approver}
            </p>
            <p className="text-[10px] text-amber-400 mt-1">⚠️ Awaiting human approval...</p>
          </div>
        )}

        {/* T3N proof details */}
        {step.blockHash && !isBlocked && (
          <div className="flex items-center gap-3 text-[10px] text-slate-600 font-mono mt-1">
            <span>⛓ {step.blockHash.slice(0, 14)}…</span>
            {step.vcId && <span>📜 {step.vcId.slice(-20)}</span>}
          </div>
        )}

        {/* Human approved badge */}
        {isApproved && step.approvedBy && (
          <p className="text-[10px] text-green-400/70 mt-1">
            ✓ Approved by: {step.approvedBy}
          </p>
        )}
      </div>
    </div>
  );
}

function T3NGatekeeperFlow({ operations }) {
  if (!operations || operations.length === 0) return null;

  const recent = operations.slice(-3);
  return (
    <div className="px-4 py-2 bg-blue-500/5 border-b border-blue-500/10">
      <p className="text-[10px] text-blue-400/60 font-bold mb-1.5 uppercase tracking-wider">
        🔐 T3N Gatekeeper — Live
      </p>
      <div className="space-y-1">
        {recent.map((op, i) => (
          <div key={i} className="flex items-center gap-2 text-[10px]">
            <div className={`w-1 h-1 rounded-full flex-shrink-0 ${
              op.status === 'AUTHORIZED' || op.status === 'LOGGED' ? 'bg-green-500' :
              op.status === 'PENDING' || op.status === 'LOGGING' ? 'bg-amber-500 animate-pulse' :
              op.status === 'DENIED' ? 'bg-red-500' : 'bg-slate-500'
            }`} />
            <span className="text-slate-500">
              {op.type === 'DELEGATION_CHECK'    ? '🛡 Delegation check' :
               op.type === 'AUDIT_LOG'           ? `⛓ Audit VC${op.humanApproved ? ' (approved)' : ''}` :
               op.type === 'HUMAN_APPROVAL_AUDIT'? '👤 Approval VC' :
               op.type}
            </span>
            <span className={`font-mono ml-auto ${
              op.status === 'AUTHORIZED' || op.status === 'LOGGED' ? 'text-green-500' :
              op.status === 'PENDING' || op.status === 'LOGGING' ? 'text-amber-400' :
              'text-slate-500'
            }`}>
              {op.status}
              {op.simulation ? ' (SIM)' : ' (LIVE)'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AgentActionFeed({ incident }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [incident?.completedSteps?.length, incident?.auditTrail?.length]);

  if (!incident) {
    return (
      <div className="flex-1 flex items-center justify-center text-center p-8">
        <div className="space-y-3">
          <div className="text-4xl">🦅</div>
          <p className="text-slate-400 text-sm font-bold">Phoenix Agent — Standby</p>
          <p className="text-slate-600 text-xs leading-relaxed max-w-xs">
            Select an incident scenario to activate the recovery agent.
            All actions will be verified by Terminal 3 before execution.
          </p>
          <div className="mt-4 bg-slate-800/60 border border-slate-700/40 rounded-lg p-4 text-left">
            <p className="text-[10px] text-blue-400 font-bold mb-2 uppercase tracking-wider">
              🔐 T3N Gatekeeper Flow
            </p>
            {[
              'Agent requests action',
              'T3N validates delegation (VC proof)',
              'T3N issues authorization',
              'Agent executes action',
              'T3N records audit VC on-chain'
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px] text-slate-500 mb-1">
                <span className="text-blue-500 font-mono">{i+1}.</span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Build merged timeline from completed steps + audit trail entries for human approvals/rejections
  const approvalEntries = (incident.auditTrail || []).filter(
    e => e.type === 'HUMAN_APPROVAL' || e.type === 'HUMAN_REJECTION'
  );

  // Build display list: completed steps + any pending blocked step
  const displayItems = [];

  for (const step of (incident.completedSteps || [])) {
    displayItems.push({ ...step, _type: 'step' });
    // Insert approval entry after each human-approved step
    const approval = approvalEntries.find(
      a => a.type === 'HUMAN_APPROVAL' && a.approvedAction === step.action
    );
    if (approval) {
      displayItems.push({ ...approval, _type: 'approval', step: step.step });
    }
  }

  // Add blocked step placeholder if pending
  if (incident.status === 'blocked' && incident.pendingEscalation) {
    displayItems.push({
      _type:    'step',
      action:   incident.pendingEscalation.action,
      label:    incident.pendingEscalation.label,
      step:     incident.pendingEscalation.stepIndex,
      category: 'DEFAULT',
      status:   'BLOCKED',
      reasoning:   incident.pendingEscalation.reasoning,
      approver:    incident.pendingEscalation.approver,
      approverRole: incident.pendingEscalation.approverRole,
      authorized: false
    });
  }

  const statusColor = incident.status === 'complete' ? 'text-green-400' :
    incident.status === 'blocked' ? 'text-red-400' :
    incident.status === 'executing' ? 'text-blue-400' : 'text-amber-400';

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-slate-700/60 flex items-center justify-between flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${
              incident.status === 'complete' ? 'bg-green-500' :
              incident.status === 'blocked' ? 'bg-red-500 status-dot' :
              'bg-blue-500 status-dot'
            }`} />
            <span className={`text-xs font-bold ${statusColor}`}>
              {incident.status === 'complete' ? '✅ RECOVERY COMPLETE' :
               incident.status === 'blocked' ? '🔒 AWAITING HUMAN APPROVAL' :
               incident.status === 'executing' ? '⚡ AGENT EXECUTING' : '🔄 ANALYZING...'}
            </span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5 pl-3.5">{incident.phase}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-500">Progress</p>
          <p className="text-xs font-bold text-slate-300">{incident.recoveryProgress}%</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-slate-800 flex-shrink-0">
        <div
          className={`h-full transition-all duration-700 ${
            incident.status === 'complete' ? 'bg-green-500' :
            incident.status === 'blocked' ? 'bg-red-500' : 'bg-blue-500'
          }`}
          style={{ width: `${incident.recoveryProgress}%` }}
        />
      </div>

      {/* T3N gatekeeper live ops */}
      <T3NGatekeeperFlow operations={incident.t3nOperations} />

      {/* Action feed */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {displayItems.length === 0 ? (
          <div className="flex items-center justify-center h-20">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
              <span>Agent analyzing situation...</span>
            </div>
          </div>
        ) : (
          displayItems.map((item, idx) => (
            <StepEntry key={`${item.action}-${idx}`} step={item} index={idx} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Complete summary */}
      {incident.status === 'complete' && incident.recovery && (
        <div className="border-t border-slate-700/60 px-4 py-3 bg-green-500/5 flex-shrink-0">
          <div className="flex items-center gap-4 text-xs">
            <div>
              <p className="text-slate-500 text-[10px]">Recovery Time</p>
              <p className="text-green-400 font-bold">{incident.recovery.agentRecoveryMins} min</p>
            </div>
            <div>
              <p className="text-slate-500 text-[10px]">vs. Manual</p>
              <p className="text-slate-400">{incident.recovery.humanRecoveryMins} min</p>
            </div>
            <div className="ml-auto">
              <p className="text-slate-500 text-[10px]">Saved</p>
              <p className="text-green-400 font-bold">${incident.recovery.costSaved.toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
