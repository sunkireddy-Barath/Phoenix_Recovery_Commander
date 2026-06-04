import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Zap, Monitor, Anchor, Play, RotateCcw, Clock, AlertTriangle } from 'lucide-react';

const api = axios.create({ baseURL: '/api', timeout: 8000 });

const SEVERITY_COLORS = {
  CRITICAL: { bg: 'bg-red-500/10',   border: 'border-red-500/50',   text: 'text-red-400',   dot: 'bg-red-500' },
  HIGH:     { bg: 'bg-amber-500/10', border: 'border-amber-500/50', text: 'text-amber-400', dot: 'bg-amber-500' },
  MEDIUM:   { bg: 'bg-yellow-500/10',border: 'border-yellow-500/40',text: 'text-yellow-400',dot: 'bg-yellow-500' }
};

const FACILITY_ICONS = {
  power_plant: Zap,
  datacenter:  Monitor,
  port:        Anchor
};

// ─── Downtime Cost Counter ────────────────────────────────────────────────────
function DowntimeCost({ costPerMinute, startTime, isActive }) {
  const [elapsedSec, setElapsedSec] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!isActive || !startTime) { setElapsedSec(0); return; }
    const tick = () => {
      const s = (Date.now() - new Date(startTime).getTime()) / 1000;
      setElapsedSec(Math.max(0, s));
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [isActive, startTime]);

  if (!isActive) return null;

  const cost = Math.floor((elapsedSec / 60) * costPerMinute);
  const mins = Math.floor(elapsedSec / 60);
  const secs = Math.floor(elapsedSec % 60);

  return (
    <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 mt-2">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-1.5 h-1.5 rounded-full bg-red-500 status-dot" />
        <span className="text-red-400 text-[10px] font-bold uppercase tracking-wider">
          Downtime Cost Accruing
        </span>
      </div>
      <div className="flex items-baseline gap-4">
        <div>
          <p className="text-[9px] text-slate-600 mb-0.5">Total</p>
          <p className="text-red-400 font-bold text-lg font-mono">${cost.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[9px] text-slate-600 mb-0.5">Elapsed</p>
          <p className="text-slate-300 text-sm font-mono">
            {String(mins).padStart(2,'0')}:{String(secs).padStart(2,'0')}
          </p>
        </div>
        <div>
          <p className="text-[9px] text-slate-600 mb-0.5">Rate</p>
          <p className="text-slate-500 text-xs font-mono">${(costPerMinute/1000).toFixed(0)}k/min</p>
        </div>
      </div>
    </div>
  );
}

// ─── Scenario Card ────────────────────────────────────────────────────────────
function ScenarioCard({ scenario, isActive, activeIncident, isOtherActive, onTrigger, isTriggering }) {
  const Icon = FACILITY_ICONS[scenario.facilityType] || Zap;
  const sev  = SEVERITY_COLORS[scenario.severity] || SEVERITY_COLORS.HIGH;

  const incStatus = isActive ? activeIncident?.status : null;
  const stepsDone = isActive ? (activeIncident?.completedSteps?.length || 0) : 0;
  const stepsTotal = scenario.playbookLength || 6;

  return (
    <div className={`
      rounded-lg border p-3 transition-all duration-200 cursor-default
      ${isActive
        ? `${sev.bg} ${sev.border}`
        : 'bg-slate-800/60 border-slate-700/60 hover:border-slate-600'}
      ${isOtherActive ? 'opacity-35 pointer-events-none' : ''}
    `}>
      {/* Header */}
      <div className="flex items-start gap-2 mb-2">
        <div className={`
          flex-shrink-0 w-7 h-7 rounded flex items-center justify-center
          ${isActive ? sev.bg : 'bg-slate-700'}
        `}>
          <Icon size={14} className={isActive ? sev.text : 'text-slate-400'} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-slate-200 leading-tight">{scenario.title}</p>
          <p className="text-[10px] text-slate-500 truncate">{scenario.facility}</p>
        </div>
        <span className={`
          flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide
          ${sev.bg} border ${sev.border} ${sev.text}
        `}>{scenario.severity}</span>
      </div>

      {/* Live metrics from API */}
      <div className="grid grid-cols-3 gap-1 mb-2">
        {(scenario.displayMetrics || []).map((m, i) => (
          <div key={i} className="bg-slate-900/60 rounded p-1">
            <p className="text-[8px] text-slate-600 truncate leading-tight">{m.label}</p>
            <p className={`text-[10px] font-bold font-mono leading-tight ${m.danger ? 'text-red-400' : 'text-slate-300'}`}>
              {m.value}
            </p>
          </div>
        ))}
      </div>

      {/* Cost per minute */}
      <p className="text-[9px] text-slate-600 mb-2">
        ${(scenario.costPerMinute / 1000).toFixed(0)}k / min downtime
      </p>

      {/* Status or trigger button */}
      {isActive ? (
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sev.dot} ${incStatus !== 'complete' ? 'status-dot' : ''}`} />
          <span className={`text-[10px] font-bold ${sev.text} uppercase leading-tight`}>
            {incStatus === 'complete'   ? '✅ RECOVERED' :
             incStatus === 'blocked'    ? '🔒 AWAITING APPROVAL' :
             incStatus === 'cancelled'  ? '🛑 CANCELLED' :
             incStatus === 'executing'  ? '⚡ AGENT ACTIVE' : '🔄 STARTING...'}
          </span>
          {incStatus !== 'complete' && incStatus !== 'cancelled' && (
            <span className="ml-auto text-[9px] text-slate-600">{stepsDone}/{stepsTotal}</span>
          )}
        </div>
      ) : (
        <button
          onClick={() => onTrigger(scenario.id)}
          disabled={isOtherActive || isTriggering}
          className={`
            w-full flex items-center justify-center gap-1.5 py-1.5 rounded text-[11px] font-bold
            transition-all duration-150
            ${isOtherActive
              ? 'bg-slate-700/30 text-slate-600 cursor-not-allowed'
              : isTriggering
              ? 'bg-blue-600/50 text-blue-300'
              : `${sev.bg} border ${sev.border} ${sev.text} hover:opacity-80 cursor-pointer`}
          `}>
          {isTriggering
            ? <><Clock size={10} className="animate-spin" /> Starting...</>
            : <><Play size={10} /> Trigger Incident</>}
        </button>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function IncidentPanel({ activeIncident, onTriggerIncident, onResetIncident }) {
  const [scenarios,   setScenarios]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [triggering,  setTriggering]  = useState(null);

  // Fetch scenarios from backend on mount
  useEffect(() => {
    api.get('/incident/scenarios')
      .then(res => setScenarios(res.data))
      .catch(() => {
        // Fallback to minimal hardcoded data if API is down (shouldn't happen in normal usage)
        setScenarios([
          { id: 'INC-001', title: 'Cooling System Failure', facility: 'Thermal Power Plant Alpha', facilityType: 'power_plant', severity: 'CRITICAL', costPerMinute: 85000, playbookLength: 6, displayMetrics: [] },
          { id: 'INC-002', title: 'Ransomware Detection',   facility: 'National Datacenter Hub',    facilityType: 'datacenter',  severity: 'HIGH',     costPerMinute: 125000, playbookLength: 6, displayMetrics: [] },
          { id: 'INC-003', title: 'Crane System Failure',   facility: 'International Port Authority', facilityType: 'port',      severity: 'HIGH',     costPerMinute: 62000,  playbookLength: 6, displayMetrics: [] }
        ]);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleTrigger = async (scenarioId) => {
    setTriggering(scenarioId);
    await onTriggerIncident(scenarioId);
    setTriggering(null);
  };

  const isComplete = activeIncident?.status === 'complete';

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between">
        <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          Incident Selector
        </h2>
        {activeIncident && (
          <button onClick={onResetIncident}
            className="flex items-center gap-1 text-[10px] text-slate-600 hover:text-slate-300 transition-colors">
            <RotateCcw size={10} />
            Reset
          </button>
        )}
      </div>

      {/* Downtime cost counter */}
      {activeIncident && (
        <DowntimeCost
          costPerMinute={activeIncident.costPerMinute}
          startTime={activeIncident.startTime}
          isActive={!isComplete && activeIncident.status !== 'cancelled'}
        />
      )}

      {/* Recovery complete summary */}
      {isComplete && activeIncident.recovery && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
          <p className="text-green-400 font-bold text-[10px] mb-2">✅ RECOVERY COMPLETE</p>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div>
              <p className="text-slate-500">Agent Time</p>
              <p className="text-green-400 font-bold text-sm">{activeIncident.recovery.agentRecoveryMins}m</p>
            </div>
            <div>
              <p className="text-slate-500">Manual Est.</p>
              <p className="text-slate-400">{activeIncident.recovery.humanRecoveryMins}m</p>
            </div>
            <div className="col-span-2">
              <p className="text-slate-500">Estimated Saved</p>
              <p className="text-green-400 font-bold text-base">${activeIncident.recovery.costSaved.toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}

      {/* Scenario cards */}
      <div className="flex flex-col gap-2 flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-2">
            {[0,1,2].map(i => (
              <div key={i} className="skeleton rounded-lg h-32" />
            ))}
          </div>
        ) : (
          scenarios.map(s => (
            <ScenarioCard
              key={s.id}
              scenario={s}
              isActive={activeIncident?.scenarioId === s.id}
              activeIncident={activeIncident}
              isOtherActive={!!activeIncident && activeIncident.scenarioId !== s.id}
              onTrigger={handleTrigger}
              isTriggering={triggering === s.id}
            />
          ))
        )}
      </div>

      {/* T3N note */}
      <div className="text-[8px] text-slate-700 leading-relaxed border-t border-slate-800 pt-2">
        ⚡ Every action T3N-gated before execution. $9k–$500k/min downtime.
      </div>
    </div>
  );
}
