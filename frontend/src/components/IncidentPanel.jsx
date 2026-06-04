import React, { useState, useEffect, useRef } from 'react';
import { Zap, Monitor, Anchor, AlertTriangle, Play, RotateCcw, Clock, DollarSign } from 'lucide-react';

const SEVERITY_COLORS = {
  CRITICAL: { bg: 'bg-red-500/10', border: 'border-red-500/50', text: 'text-red-400', dot: 'bg-red-500' },
  HIGH:     { bg: 'bg-amber-500/10', border: 'border-amber-500/50', text: 'text-amber-400', dot: 'bg-amber-500' },
  MEDIUM:   { bg: 'bg-yellow-500/10', border: 'border-yellow-500/40', text: 'text-yellow-400', dot: 'bg-yellow-500' }
};

const SCENARIO_ICONS = {
  power_plant: Zap,
  datacenter:  Monitor,
  port:        Anchor
};

const SCENARIOS = [
  {
    id: 'INC-001', title: 'Cooling System Failure', subtitle: 'Zone 4 — Thermal Runaway',
    facility: 'Thermal Power Plant Alpha', facilityType: 'power_plant',
    severity: 'CRITICAL', costPerMinute: 85000,
    metrics: [
      { label: 'Temperature', value: '94°C', limit: '85°C', danger: true },
      { label: 'Pressure',    value: '112 PSI', limit: '100 PSI', danger: true },
      { label: 'Coolant Flow', value: '12 L/min', limit: '45 L/min', danger: true }
    ]
  },
  {
    id: 'INC-002', title: 'Ransomware Detection', subtitle: 'Server Cluster B — Active Spread',
    facility: 'National Datacenter Hub', facilityType: 'datacenter',
    severity: 'HIGH', costPerMinute: 125000,
    metrics: [
      { label: 'Affected Nodes',      value: '23',      limit: '0',    danger: true },
      { label: 'Encryption Progress', value: '34%',     limit: '0%',   danger: true },
      { label: 'Network Traffic',     value: '9,800 MB/s', limit: '500 MB/s', danger: true }
    ]
  },
  {
    id: 'INC-003', title: 'Crane System Failure', subtitle: 'Berth 7 — Hydraulic Fault HYD-447',
    facility: 'International Port Authority', facilityType: 'port',
    severity: 'HIGH', costPerMinute: 62000,
    metrics: [
      { label: 'Affected Vessels',  value: '4',          limit: '0',   danger: true },
      { label: 'Cargo Delayed',     value: '2,400 tons', limit: '0',   danger: true },
      { label: 'Fault Code',        value: 'HYD-447',    limit: 'NONE', danger: true }
    ]
  }
];

function DowntimeCost({ costPerMinute, startTime, isActive }) {
  const [cost, setCost] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!isActive || !startTime) { setCost(0); setElapsed(0); return; }

    timerRef.current = setInterval(() => {
      const secs = (Date.now() - new Date(startTime).getTime()) / 1000;
      setElapsed(secs);
      setCost(Math.floor((secs / 60) * costPerMinute));
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [isActive, startTime, costPerMinute]);

  if (!isActive) return null;

  const mins = Math.floor(elapsed / 60);
  const secs = Math.floor(elapsed % 60);

  return (
    <div className="mt-3 bg-red-500/5 border border-red-500/20 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-1.5 h-1.5 rounded-full bg-red-500 status-dot" />
        <span className="text-red-400 text-xs font-bold uppercase tracking-wider">Downtime Cost Accruing</span>
      </div>
      <div className="flex items-baseline gap-3">
        <div>
          <p className="text-[10px] text-slate-500 mb-0.5">Total Cost</p>
          <p className="text-red-400 font-bold text-xl font-mono cost-counter" key={Math.floor(elapsed)}>
            ${cost.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500 mb-0.5">Elapsed</p>
          <p className="text-slate-300 font-mono text-sm">
            {String(mins).padStart(2,'0')}:{String(secs).padStart(2,'0')}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500 mb-0.5">Rate</p>
          <p className="text-slate-400 font-mono text-xs">${(costPerMinute/1000).toFixed(0)}k/min</p>
        </div>
      </div>
    </div>
  );
}

export default function IncidentPanel({ activeIncident, onTriggerIncident, onResetIncident }) {
  const [triggering, setTriggering] = useState(null);

  const handleTrigger = async (scenarioId) => {
    setTriggering(scenarioId);
    await onTriggerIncident(scenarioId);
    setTriggering(null);
  };

  const isComplete = activeIncident?.status === 'complete';

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Incident Selector</h2>
        {activeIncident && (
          <button onClick={onResetIncident}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors">
            <RotateCcw size={10} />
            Reset
          </button>
        )}
      </div>

      {/* Active incident cost counter */}
      {activeIncident && (
        <DowntimeCost
          costPerMinute={activeIncident.costPerMinute}
          startTime={activeIncident.startTime}
          isActive={activeIncident.status !== 'complete'}
        />
      )}

      {/* Recovery complete banner */}
      {isComplete && activeIncident.recovery && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-400 font-bold text-xs">✅ RECOVERY COMPLETE</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-slate-500">Agent Time</p>
              <p className="text-green-400 font-bold">{activeIncident.recovery.agentRecoveryMins}m</p>
            </div>
            <div>
              <p className="text-slate-500">Without Agent</p>
              <p className="text-slate-400">{activeIncident.recovery.humanRecoveryMins}m</p>
            </div>
            <div className="col-span-2">
              <p className="text-slate-500">Estimated Cost Saved</p>
              <p className="text-green-400 font-bold text-base">
                ${activeIncident.recovery.costSaved.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Scenario cards */}
      <div className="flex flex-col gap-2 overflow-y-auto flex-1">
        {SCENARIOS.map(s => {
          const isActive = activeIncident?.scenarioId === s.id;
          const Icon = SCENARIO_ICONS[s.facilityType] || Zap;
          const sev = SEVERITY_COLORS[s.severity];
          const isTriggering = triggering === s.id;
          const isOtherActive = activeIncident && !isActive;

          return (
            <div key={s.id}
              className={`
                rounded-lg border p-3 transition-all duration-200
                ${isActive
                  ? `${sev.bg} ${sev.border} t3n-glow-${s.severity === 'CRITICAL' ? 'red' : 'blue'}`
                  : 'bg-slate-800/60 border-slate-700/60 hover:border-slate-600'}
                ${isOtherActive ? 'opacity-40' : ''}
              `}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`
                    flex-shrink-0 w-7 h-7 rounded flex items-center justify-center
                    ${isActive ? sev.bg : 'bg-slate-700'}
                  `}>
                    <Icon size={14} className={isActive ? sev.text : 'text-slate-400'} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-200 leading-tight truncate">{s.title}</p>
                    <p className="text-[10px] text-slate-500 truncate">{s.facility}</p>
                  </div>
                </div>
                <span className={`
                  flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider
                  ${sev.bg} ${sev.border} border ${sev.text}
                `}>{s.severity}</span>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-1 mb-2">
                {s.metrics.map((m, i) => (
                  <div key={i} className="bg-slate-900/60 rounded p-1">
                    <p className="text-[9px] text-slate-600 truncate">{m.label}</p>
                    <p className={`text-[10px] font-bold font-mono ${m.danger ? 'text-red-400' : 'text-slate-300'}`}>
                      {m.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Status / trigger button */}
              {isActive ? (
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${sev.dot} status-dot`} />
                  <span className={`text-[10px] font-bold ${sev.text} uppercase`}>
                    {activeIncident.status === 'complete' ? 'RECOVERED' :
                     activeIncident.status === 'blocked' ? 'AWAITING APPROVAL' :
                     activeIncident.status === 'executing' ? 'AGENT ACTIVE' : 'STARTING...'}
                  </span>
                  {activeIncident.status !== 'complete' && (
                    <span className="ml-auto text-[10px] text-slate-500">
                      {activeIncident.completedSteps?.length || 0}/{activeIncident.playbookLength || 6} steps
                    </span>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => handleTrigger(s.id)}
                  disabled={!!activeIncident || isTriggering}
                  className={`
                    w-full flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-bold
                    transition-all duration-150
                    ${activeIncident ? 'bg-slate-700/40 text-slate-600 cursor-not-allowed' :
                      isTriggering ? 'bg-blue-600/50 text-blue-300' :
                      `${sev.bg} ${sev.border} border ${sev.text} hover:bg-opacity-20 cursor-pointer`}
                  `}>
                  {isTriggering ? (
                    <><Clock size={10} className="animate-spin" /> Starting...</>
                  ) : (
                    <><Play size={10} /> Trigger Incident</>
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Cost note */}
      <div className="text-[9px] text-slate-600 leading-relaxed border-t border-slate-800 pt-2">
        ⚡ Industrial downtime: $9,000–$500,000/minute. Every agent action verified by Terminal 3.
      </div>
    </div>
  );
}
