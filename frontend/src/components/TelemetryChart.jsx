import React, { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Area, AreaChart
} from 'recharts';

const METRIC_COLORS = {
  temperature:      '#ef4444',
  pressure:         '#f59e0b',
  coolant_flow:     '#3b82f6',
  affected_nodes:   '#ef4444',
  encryption_progress: '#f59e0b',
  network_traffic:  '#8b5cf6',
  affected_vessels: '#ef4444',
  cargo_delayed_tons:'#f59e0b',
  berth_utilization:'#22c55e',
  recovery_progress:'#22c55e'
};

const METRIC_LABELS = {
  temperature:      'Temperature (°C)',
  pressure:         'Pressure (PSI)',
  coolant_flow:     'Coolant Flow (L/min)',
  affected_nodes:   'Affected Nodes',
  encryption_progress: 'Encryption %',
  network_traffic:  'Traffic (MB/s)',
  affected_vessels: 'Affected Vessels',
  cargo_delayed_tons: 'Cargo Delayed (tons)',
  berth_utilization:'Berth Utilization %',
  recovery_progress:'Recovery Progress %'
};

function MiniChart({ data, metric, dangerLimit, invertedDanger }) {
  if (!data || data.length < 2) {
    return (
      <div className="h-20 flex items-center justify-center">
        <p className="text-[10px] text-slate-700">Awaiting data...</p>
      </div>
    );
  }

  const color = METRIC_COLORS[metric] || '#94a3b8';
  const label = METRIC_LABELS[metric] || metric;
  const values = data.map(d => d[metric]).filter(v => v != null);
  const current = values[values.length - 1];
  const isDangerous = dangerLimit != null
    ? (invertedDanger ? current < dangerLimit : current > dangerLimit)
    : false;

  const formattedData = data.map((d, i) => ({
    t: i,
    value: d[metric] != null ? Math.round(d[metric] * 10) / 10 : null
  })).filter(d => d.value != null);

  return (
    <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/40">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] text-slate-500 truncate pr-2">{label}</p>
        <p className={`text-sm font-bold font-mono flex-shrink-0 ${isDangerous ? 'text-red-400' : 'text-green-400'}`}>
          {current != null ? Math.round(current * 10) / 10 : '—'}
        </p>
      </div>
      <ResponsiveContainer width="100%" height={56}>
        <AreaChart data={formattedData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`grad-${metric}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis hide dataKey="t" />
          <YAxis hide domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '4px',
              fontSize: '10px',
              color: '#f8fafc',
              padding: '4px 8px'
            }}
            itemStyle={{ color }}
            labelStyle={{ display: 'none' }}
            formatter={(val) => [val, label]}
          />
          {dangerLimit != null && (
            <ReferenceLine y={dangerLimit} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1} strokeOpacity={0.6} />
          )}
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#grad-${metric})`}
            dot={false}
            activeDot={{ r: 3, fill: color }}
          />
        </AreaChart>
      </ResponsiveContainer>
      {dangerLimit != null && (
        <div className="flex items-center gap-1 mt-1">
          <div className="w-3 h-0.5 bg-red-500/50 rounded" />
          <span className="text-[9px] text-slate-600">Danger: {dangerLimit}</span>
        </div>
      )}
    </div>
  );
}

const SCENARIO_CHART_METRICS = {
  'INC-001': [
    { key: 'temperature',   danger: 85,  invertedDanger: false },
    { key: 'pressure',      danger: 100, invertedDanger: false },
    { key: 'coolant_flow',  danger: 20,  invertedDanger: true  }
  ],
  'INC-002': [
    { key: 'affected_nodes',       danger: 10,  invertedDanger: false },
    { key: 'encryption_progress',  danger: 50,  invertedDanger: false },
    { key: 'network_traffic',      danger: 500, invertedDanger: false }
  ],
  'INC-003': [
    { key: 'affected_vessels',   danger: 2,   invertedDanger: false },
    { key: 'cargo_delayed_tons', danger: 500, invertedDanger: false },
    { key: 'berth_utilization',  danger: 50,  invertedDanger: true  }
  ]
};

export default function TelemetryChart({ incident }) {
  const history = incident?.telemetryHistory || [];
  const scenarioId = incident?.scenarioId;
  const metrics = SCENARIO_CHART_METRICS[scenarioId] || [];

  if (!incident) {
    return (
      <div className="flex items-center justify-center h-full text-center p-6">
        <div>
          <p className="text-slate-600 text-xs">Telemetry charts will appear when an incident is active</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Live Telemetry</h3>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 status-dot" />
          <span className="text-[10px] text-slate-500">{history.length} readings</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {metrics.map(m => (
          <MiniChart
            key={m.key}
            data={history}
            metric={m.key}
            dangerLimit={m.danger}
            invertedDanger={m.invertedDanger}
          />
        ))}
        <MiniChart
          key="recovery_progress"
          data={history}
          metric="recovery_progress"
          dangerLimit={null}
          invertedDanger={false}
        />
      </div>
    </div>
  );
}
