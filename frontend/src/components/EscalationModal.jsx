import React, { useState } from 'react';
import { X, Shield, AlertTriangle, CheckCircle, User, Lock } from 'lucide-react';
import T3NCredentialBadge from './T3NCredentialBadge.jsx';

const APPROVER_DETAILS = {
  plant_manager: {
    label:  'Plant Manager',
    name:   'Dr. Sarah Chen',
    dept:   'Operations — Zone 4 Authority',
    avatar: '👩‍🔬'
  },
  supervisor: {
    label:  'Supervisor',
    name:   'James Eriksson',
    dept:   'Compliance & Regulatory Affairs',
    avatar: '👨‍💼'
  },
  ciso: {
    label:  'CISO',
    name:   'Marcus Williams',
    dept:   'Chief Information Security Officer',
    avatar: '👨‍💻'
  },
  legal: {
    label:  'Legal Team',
    name:   'Priya Sharma, JD',
    dept:   'Legal & Compliance',
    avatar: '⚖️'
  },
  port_authority: {
    label:  'Port Authority',
    name:   'Harbor Inspector Chen',
    dept:   'Port Operations Certification',
    avatar: '⚓'
  },
  harbor_master: {
    label:  'Harbor Master',
    name:   'Capt. Robert Martinez',
    dept:   'Harbor Master — International Port',
    avatar: '🚢'
  }
};

const DEFAULT_APPROVER = {
  label:  'Authorized Human',
  name:   'Facility Manager',
  dept:   'Operations Authority',
  avatar: '👤'
};

export default function EscalationModal({ escalation, incidentId, onApprove, onReject, simulation, authority }) {
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [t3nStatus, setT3NStatus] = useState(null);

  if (!escalation) return null;

  const approver = APPROVER_DETAILS[escalation.approverRole] || DEFAULT_APPROVER;

  const handleApprove = async () => {
    setApproving(true);
    setT3NStatus('⛓ Recording T3N approval VC...');
    try {
      await onApprove(escalation.action, approver.name, escalation.approverRole);
    } finally {
      setApproving(false);
      setT3NStatus(null);
    }
  };

  const handleReject = async () => {
    setRejecting(true);
    try {
      await onReject(escalation.action, approver.name);
    } finally {
      setRejecting(false);
    }
  };

  return (
    /* Backdrop */
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-red-500/40 rounded-xl shadow-2xl w-full max-w-lg
                      t3n-glow-red animate-fade-in">

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-700/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/15 flex items-center justify-center flex-shrink-0">
              <Lock size={20} className="text-red-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-200 leading-tight">
                Delegation Boundary Reached
              </h2>
              <p className="text-xs text-red-400 mt-0.5">
                Phoenix Agent cannot proceed — human authorization required
              </p>
            </div>
          </div>
          <div className="flex-shrink-0">
            <span className="text-[10px] font-bold px-2 py-1 rounded bg-red-500/15 text-red-400 border border-red-500/30">
              BLOCKED
            </span>
          </div>
        </div>

        {/* Action details */}
        <div className="p-5 space-y-4">
          {/* What needs approval */}
          <div className="bg-slate-900/60 border border-slate-700/40 rounded-lg p-4">
            <p className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider">Action Requiring Approval</p>
            <p className="text-sm font-bold text-slate-200 mb-2">
              {escalation.label || escalation.action}
            </p>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              {escalation.reasoning?.replace(/^\[BLOCKED\] /, '') || escalation.reason}
            </p>
          </div>

          {/* Authority + Credential context */}
          {(authority || escalation.credential) && (
            <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <User size={12} className="text-purple-400" />
                <p className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">
                  Authority Delegation Chain
                </p>
              </div>
              <div className="space-y-1 text-[10px]">
                {authority && (
                  <p className="text-slate-400">
                    Issuing authority: <span className="text-purple-300 font-bold">{authority.name}</span>
                    <span className="text-slate-600 ml-1">({authority.authority_level})</span>
                  </p>
                )}
                {escalation.credential && (
                  <p className="text-slate-400">
                    Active credential: <span className="text-blue-400 font-mono">{escalation.credential}</span>
                  </p>
                )}
                <p className="text-slate-500">
                  {escalation.credDenied
                    ? `Action "${escalation.action}" is outside the delegated permission scope.`
                    : `Action requires elevated authority beyond current delegation.`}
                </p>
              </div>
            </div>
          )}

          {/* T3N delegation explanation */}
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Shield size={12} className="text-blue-400" />
              <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">
                Why This Action Is Blocked
              </p>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              {escalation.credDenied
                ? <>The active delegation credential does not include <strong className="text-slate-300">{escalation.action}</strong>. The Phoenix Agent is enforcing its permission scope. T3N verified this boundary.</>
                : <>The Phoenix Agent's delegation VC (Terminal 3 Verifiable Credential) explicitly excludes <strong className="text-slate-300">{escalation.action}</strong> from its authorized action scope. T3N's selective disclosure proof confirmed the agent is operating within its delegation boundary.</>
              }
            </p>
            <div className="flex gap-1.5 mt-2 flex-wrap">
              <T3NCredentialBadge variant="VERIFIED" simulation={simulation} />
              <T3NCredentialBadge variant="BLOCKED" />
            </div>
          </div>

          {/* Approver identity */}
          <div className="bg-slate-900/40 border border-slate-700/30 rounded-lg p-3">
            <p className="text-[10px] text-slate-500 mb-2 uppercase tracking-wider">Required Approver</p>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-lg flex-shrink-0">
                {approver.avatar}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-200">{approver.name}</p>
                <p className="text-[10px] text-slate-500">{approver.dept}</p>
              </div>
              <div className="ml-auto">
                <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  {escalation.urgency || 'HIGH'} URGENCY
                </span>
              </div>
            </div>
          </div>

          {/* T3N credential that will be issued on approval */}
          <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
            <p className="text-[10px] text-green-400 font-bold mb-1 uppercase tracking-wider">
              On Approval — T3N Will Record
            </p>
            <div className="space-y-1 text-[10px] text-slate-500">
              <p>• Human approval VC issued to: <span className="text-green-400">{approver.name}</span></p>
              <p>• Action execution VC: <span className="text-blue-400">{escalation.action}</span></p>
              <p>• Both VCs recorded on T3N blockchain — tamper-proof audit trail</p>
            </div>
          </div>

          {/* T3N status indicator */}
          {t3nStatus && (
            <div className="flex items-center gap-2 text-xs text-blue-400 bg-blue-500/5 rounded p-2">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
              {t3nStatus}
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-3 p-5 pt-0">
          <button
            onClick={handleApprove}
            disabled={approving || rejecting}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg
                       bg-green-600 hover:bg-green-500 text-white text-xs font-bold
                       transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            <CheckCircle size={14} />
            {approving ? 'Recording T3N Approval...' : `APPROVE AS ${approver.label.toUpperCase()}`}
          </button>
          <button
            onClick={handleReject}
            disabled={approving || rejecting}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg
                       bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-bold
                       transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            <X size={14} />
            {rejecting ? '...' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  );
}
