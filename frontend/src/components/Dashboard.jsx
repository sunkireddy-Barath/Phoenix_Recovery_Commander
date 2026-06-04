import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, HelpCircle, Activity, Wifi, WifiOff, ArrowLeft, Key, AlertTriangle, Check, X, ChevronRight } from 'lucide-react';
import axios from 'axios';

import IncidentPanel      from './IncidentPanel.jsx';
import AgentActionFeed    from './AgentActionFeed.jsx';
import AuditTrail         from './AuditTrail.jsx';
import TelemetryChart     from './TelemetryChart.jsx';
import EscalationModal    from './EscalationModal.jsx';
import HowItWorksModal    from './HowItWorksModal.jsx';
import T3NCredentialBadge from './T3NCredentialBadge.jsx';

const api = axios.create({ baseURL: '/api', timeout: 10000, withCredentials: true });

const INDUSTRY_ICONS = { port: '⚓', datacenter: '💻', utility: '⚡', general: '🏭' };

// ─── Authority Bar ────────────────────────────────────────────────────────────
// Shows the issuing authority name + active credential for this incident
function AuthorityBar({ authority, activeIncident }) {
  const cred  = activeIncident?.activeCredential;
  const perms = activeIncident?.activeCredPerms || [];

  // Build permitted / restricted lists from the incident's playbook
  const playbookActions = activeIncident
    ? (activeIncident.completedSteps || []).map(s => s.action).concat(
        activeIncident.pendingEscalation ? [activeIncident.pendingEscalation.action] : []
      )
    : [];

  const hasCred = !!cred;

  return (
    <div className={`
      px-4 py-2 border-b flex items-center gap-4 flex-shrink-0 text-[10px]
      ${hasCred
        ? 'bg-blue-500/5 border-blue-500/15'
        : 'bg-amber-500/5 border-amber-500/15'}
    `}>
      {/* Authority identity */}
      {authority && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-5 h-5 rounded-md bg-slate-700/60 border border-slate-600/40 flex items-center justify-center text-xs">
            👤
          </div>
          <div>
            <span className="text-slate-400 font-bold">{authority.name}</span>
            <span className="text-slate-600 mx-1">·</span>
            <span className="text-slate-600 font-mono">{authority.authority_level}</span>
          </div>
        </div>
      )}

      {/* Separator */}
      {authority && <div className="w-px h-4 bg-slate-700/60 flex-shrink-0" />}

      {/* Active credential */}
      {hasCred ? (
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Key size={10} className="text-blue-400" />
            <span className="text-blue-400 font-bold">Credential:</span>
            <span className="text-blue-300/80 font-mono">{cred.credential_id}</span>
          </div>
          {perms.length > 0 && (
            <div className="hidden xl:flex items-center gap-1.5 min-w-0">
              <span className="text-slate-600 text-[9px]">Permissions:</span>
              <div className="flex gap-1 flex-wrap">
                {perms.slice(0, 5).map(p => (
                  <span key={p} className="text-[8px] bg-green-500/10 border border-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-mono">
                    ✓ {p.replace(/_/g, ' ')}
                  </span>
                ))}
                {perms.length > 5 && (
                  <span className="text-[8px] text-slate-600">+{perms.length - 5}</span>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-amber-400/80">
          <AlertTriangle size={10} />
          <span className="font-bold">No active credential — visit Authority Center to issue one</span>
        </div>
      )}

      {/* Cred count right-side */}
      {hasCred && (
        <span className="text-[9px] text-slate-600 font-mono flex-shrink-0 hidden sm:block">
          {perms.length} perms granted
        </span>
      )}
    </div>
  );
}

// ─── Permission Panel (in left sidebar) ──────────────────────────────────────
function PermissionPanel({ activeIncident }) {
  const cred  = activeIncident?.activeCredential;
  const perms = activeIncident?.activeCredPerms || [];

  // Build a per-step permission status from the incident playbook
  const completedActions = (activeIncident?.completedSteps || []).map(s => s.action);
  const blockedAction    = activeIncident?.pendingEscalation?.action;

  if (!activeIncident) return null;

  return (
    <div className="mt-4 rounded-xl bg-slate-800/60 border border-slate-700/40 overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-700/40 flex items-center gap-2">
        <Key size={10} className="text-blue-400" />
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Delegation Scope</span>
      </div>

      {!cred ? (
        <div className="px-3 py-3 flex items-center gap-2 text-[10px] text-amber-400/80">
          <AlertTriangle size={10} />
          <span>No credential issued</span>
        </div>
      ) : (
        <div className="p-2 space-y-1">
          {perms.map(p => {
            const isDone    = completedActions.includes(p);
            const isBlocked = blockedAction === p;
            return (
              <div key={p} className={`
                flex items-center gap-2 px-2 py-1.5 rounded-lg text-[9px] font-mono
                ${isDone    ? 'bg-green-500/5 text-green-400' :
                  isBlocked ? 'bg-amber-500/5 text-amber-400' :
                              'text-slate-500'}
              `}>
                {isDone    ? <Check size={9} className="text-green-400 flex-shrink-0" /> :
                 isBlocked ? <AlertTriangle size={9} className="text-amber-400 flex-shrink-0" /> :
                             <div className="w-2 h-2 rounded-full border border-slate-600 flex-shrink-0" />}
                <span className="truncate">{p.replace(/_/g, ' ')}</span>
              </div>
            );
          })}

          {/* Show restricted actions */}
          {activeIncident.pendingEscalation &&
           !perms.includes(activeIncident.pendingEscalation.action) && (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-[9px] font-mono bg-red-500/5 text-red-400/70">
              <X size={9} className="flex-shrink-0" />
              <span className="truncate">{activeIncident.pendingEscalation.action.replace(/_/g, ' ')}</span>
              <span className="text-[8px] text-red-500/50 ml-auto">RESTRICTED</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────────
function Header({ agentStatus, onOpenHowItWorks, authority }) {
  const navigate = useNavigate();
  const isLive   = agentStatus && !agentStatus.simulationMode;

  return (
    <header className="relative scan-lines bg-slate-900 border-b border-slate-700/60 px-4 py-3
                       flex items-center justify-between gap-4 flex-shrink-0">
      {/* Left — branding + back nav */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={() => navigate('/authority')}
          className="flex-shrink-0 p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors"
          title="Authority Center"
        >
          <ArrowLeft size={14} />
        </button>
        <div className="flex-shrink-0 text-2xl">🦅</div>
        <div className="min-w-0">
          <h1 className="text-sm font-bold text-slate-100 leading-none tracking-wide">
            PHOENIX RECOVERY COMMANDER
          </h1>
          <p className="text-[10px] text-slate-500 mt-0.5 truncate">
            Industrial AI Agent — Secured by Terminal 3 Agent Auth SDK
          </p>
        </div>
      </div>

      {/* Center — agent DID */}
      <div className="hidden md:flex flex-col items-center gap-1 min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Shield size={11} className="text-blue-400 flex-shrink-0" />
          <span className="text-[10px] text-slate-500">Phoenix Agent DID</span>
        </div>
        <p className="text-[11px] text-blue-400 font-mono font-bold truncate max-w-xs">
          {agentStatus?.did || 'did:key:phoenix-agent-001'}
        </p>
        <div className="flex items-center gap-1.5 flex-wrap justify-center">
          <T3NCredentialBadge variant="VERIFIED" simulation={!isLive} />
          {isLive && <T3NCredentialBadge variant="TEE_CONFIRMED" />}
        </div>
      </div>

      {/* Right — authority badge + T3N status + help */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Authority name badge */}
        {authority && (
          <div className="hidden lg:flex items-center gap-2 px-2.5 py-1.5 rounded-lg
            bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-bold">
            <div className="w-1.5 h-1.5 rounded-full bg-purple-400 status-dot" />
            {authority.name}
          </div>
        )}

        {/* T3N connection status */}
        <div className={`
          flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold
          border transition-colors
          ${isLive
            ? 'bg-green-500/10 border-green-500/30 text-green-400'
            : 'bg-slate-700/40 border-slate-600/40 text-slate-400'}
        `}>
          {isLive ? <Wifi size={10} /> : <WifiOff size={10} />}
          <span>{isLive ? 'T3N LIVE' : 'T3N SIM'}</span>
          <div className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-green-500 status-dot' : 'bg-slate-500'}`} />
        </div>

        <button
          onClick={onOpenHowItWorks}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold
                     bg-blue-500/10 border border-blue-500/20 text-blue-400
                     hover:bg-blue-500/20 transition-colors">
          <HelpCircle size={10} />
          <span className="hidden sm:inline">How T3N Works</span>
        </button>
      </div>
    </header>
  );
}

// ─── T3N Status Bar ───────────────────────────────────────────────────────────
function T3NStatusBar({ agentStatus }) {
  if (!agentStatus) return null;
  const isLive = !agentStatus.simulationMode;

  return (
    <div className={`
      px-4 py-1.5 border-b flex items-center gap-4 flex-shrink-0 text-[9px]
      ${isLive
        ? 'bg-blue-500/5 border-blue-500/10 text-blue-400/70'
        : 'bg-amber-500/5 border-amber-500/10 text-amber-500/70'}
    `}>
      <span className="font-bold">
        {isLive ? '🔐 T3N LIVE MODE' : '⚠️  T3N SIMULATION MODE'}
      </span>
      <span>
        {isLive
          ? `Connected to staging.terminal3.io — Agent DID verified — Delegation VC active`
          : `T3N calls simulated with real API structure. Add T3N_API_KEY to backend/.env for live mode.`}
      </span>
      {agentStatus.delegationVcId && (
        <span className="hidden md:inline font-mono text-slate-600 ml-auto truncate max-w-xs">
          VC: {agentStatus.delegationVcId?.slice(-32)}
        </span>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard({
  agentStatus,
  activeIncident,
  escalationModal,
  howItWorksOpen,
  authority,
  onTriggerIncident,
  onApproveEscalation,
  onRejectEscalation,
  onResetIncident,
  onOpenHowItWorks,
  onCloseHowItWorks
}) {
  const simulationMode = agentStatus?.simulationMode !== false;

  return (
    <div className="h-screen flex flex-col bg-slate-900 overflow-hidden">
      {/* Header */}
      <Header agentStatus={agentStatus} onOpenHowItWorks={onOpenHowItWorks} authority={authority} />

      {/* T3N status bar */}
      <T3NStatusBar agentStatus={agentStatus} />

      {/* Authority + credential bar */}
      <AuthorityBar authority={authority} activeIncident={activeIncident} />

      {/* Main content grid */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

        {/* Left — Incident Selector */}
        <div className="w-64 flex-shrink-0 border-r border-slate-700/60 bg-slate-900 overflow-y-auto p-3">
          <IncidentPanel
            activeIncident={activeIncident}
            onTriggerIncident={onTriggerIncident}
            onResetIncident={onResetIncident}
          />
          <PermissionPanel activeIncident={activeIncident} />
        </div>

        {/* Center — Agent Action Feed (the star) */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-slate-700/60 bg-slate-900">
          {/* Panel title */}
          <div className="px-4 py-2 border-b border-slate-700/60 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <Activity size={12} className="text-blue-400" />
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Phoenix Agent — Live Execution
              </h2>
            </div>
            {activeIncident && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-600 font-mono">
                  {activeIncident.id}
                </span>
                {simulationMode && (
                  <T3NCredentialBadge variant="SIMULATED" />
                )}
                {/* Active credential badge */}
                {activeIncident.activeCredential && (
                  <span className="text-[9px] font-mono text-blue-400/70 bg-blue-500/5 border border-blue-500/15 px-2 py-0.5 rounded-full">
                    🔑 {activeIncident.activeCredential.credential_id}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Feed content */}
          <div className="flex-1 overflow-hidden">
            <AgentActionFeed incident={activeIncident} />
          </div>

          {/* Bottom — Telemetry charts */}
          <div className="border-t border-slate-700/60 flex-shrink-0 max-h-52 overflow-y-auto
                          bg-slate-900/80">
            <TelemetryChart incident={activeIncident} />
          </div>
        </div>

        {/* Right — T3N Audit Trail */}
        <div className="w-72 flex-shrink-0 bg-slate-900 flex flex-col min-h-0">
          <AuditTrail incident={activeIncident} />
        </div>
      </div>

      {/* Modals */}
      {escalationModal && (
        <EscalationModal
          escalation={escalationModal}
          onApprove={onApproveEscalation}
          onReject={onRejectEscalation}
          simulation={simulationMode}
          authority={authority}
        />
      )}
      {howItWorksOpen && (
        <HowItWorksModal onClose={onCloseHowItWorks} />
      )}
    </div>
  );
}
