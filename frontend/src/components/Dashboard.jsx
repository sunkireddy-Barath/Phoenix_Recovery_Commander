import React from 'react';
import { Shield, HelpCircle, Activity, Radio, Wifi, WifiOff } from 'lucide-react';
import IncidentPanel    from './IncidentPanel.jsx';
import AgentActionFeed  from './AgentActionFeed.jsx';
import AuditTrail       from './AuditTrail.jsx';
import TelemetryChart   from './TelemetryChart.jsx';
import EscalationModal  from './EscalationModal.jsx';
import HowItWorksModal  from './HowItWorksModal.jsx';
import T3NCredentialBadge from './T3NCredentialBadge.jsx';

// ─── Header ──────────────────────────────────────────────────────────────────
function Header({ agentStatus, onOpenHowItWorks }) {
  const isLive = agentStatus && !agentStatus.simulationMode;

  return (
    <header className="relative scan-lines bg-slate-900 border-b border-slate-700/60 px-4 py-3
                       flex items-center justify-between gap-4 flex-shrink-0">
      {/* Left — branding */}
      <div className="flex items-center gap-3 min-w-0">
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

      {/* Right — status + controls */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Delegated authority summary */}
        <div className="hidden lg:block text-right">
          <p className="text-[9px] text-slate-500 mb-0.5">Delegated Authority</p>
          <div className="flex flex-col items-end gap-0.5 text-[9px] font-mono">
            <span className="text-green-400">✓ Isolate Zones</span>
            <span className="text-green-400">✓ Activate Backups</span>
            <span className="text-red-400/70">✗ Core Restarts</span>
          </div>
        </div>

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

        {/* How it works */}
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
      <Header agentStatus={agentStatus} onOpenHowItWorks={onOpenHowItWorks} />

      {/* T3N status bar */}
      <T3NStatusBar agentStatus={agentStatus} />

      {/* Main content grid */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

        {/* Left — Incident Selector */}
        <div className="w-64 flex-shrink-0 border-r border-slate-700/60 bg-slate-900 overflow-y-auto p-3">
          <IncidentPanel
            activeIncident={activeIncident}
            onTriggerIncident={onTriggerIncident}
            onResetIncident={onResetIncident}
          />
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
              </div>
            )}
          </div>

          {/* Feed content — flex-1 to fill available space */}
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
        />
      )}
      {howItWorksOpen && (
        <HowItWorksModal onClose={onCloseHowItWorks} />
      )}
    </div>
  );
}
