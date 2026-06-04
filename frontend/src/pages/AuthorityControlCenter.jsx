import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Shield, Users, Key, FileText, Activity, ChevronRight,
  Plus, Check, X, RefreshCw, Zap, Lock, AlertTriangle,
  Clock, Globe, ChevronLeft, LogOut, ExternalLink
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const api = axios.create({ baseURL: '/api', timeout: 10000, withCredentials: true });

const RISK_COLORS = {
  low:      { bg: 'bg-green-500/10',  border: 'border-green-500/30',  text: 'text-green-400',  dot: 'bg-green-400' },
  medium:   { bg: 'bg-amber-500/10',  border: 'border-amber-500/30',  text: 'text-amber-400',  dot: 'bg-amber-400' },
  high:     { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', dot: 'bg-orange-400' },
  critical: { bg: 'bg-red-500/10',    border: 'border-red-500/30',    text: 'text-red-400',    dot: 'bg-red-400' }
};

const INDUSTRY_ICONS = {
  port:       '⚓',
  datacenter: '💻',
  utility:    '⚡',
  general:    '🏭'
};

const LEVEL_COLORS = {
  LEVEL_3: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
  LEVEL_2: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  LEVEL_1: 'text-slate-400 bg-slate-700/30 border-slate-600/30'
};

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color = 'blue', sub }) {
  const colors = {
    blue:   'text-blue-400 bg-blue-500/10 border-blue-500/20',
    green:  'text-green-400 bg-green-500/10 border-green-500/20',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    amber:  'text-amber-400 bg-amber-500/10 border-amber-500/20'
  };
  return (
    <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/40">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${colors[color]}`}>
          <Icon size={16} className={colors[color].split(' ')[0]} />
        </div>
      </div>
      <div className={`text-3xl font-black font-mono ${colors[color].split(' ')[0]}`}>{value}</div>
      <div className="text-[11px] text-slate-500 mt-1">{label}</div>
      {sub && <div className="text-[10px] text-slate-600 font-mono">{sub}</div>}
    </div>
  );
}

// ─── Credential Issuance Modal ────────────────────────────────────────────────
function CredentialModal({ agent, permissions, onIssue, onClose }) {
  const [selected, setSelected] = useState(
    permissions.filter(p => !p.requires_approval).map(p => p.action)
  );
  const [issuing, setIssuing]   = useState(false);
  const [issued, setIssued]     = useState(null);
  const [hours, setHours]       = useState(24);

  const toggle = (action) =>
    setSelected(s => s.includes(action) ? s.filter(a => a !== action) : [...s, action]);

  const handleIssue = async () => {
    setIssuing(true);
    try {
      const res = await onIssue(agent.id, selected, hours);
      setIssued(res.credential);
    } finally {
      setIssuing(false);
    }
  };

  const grouped = permissions.reduce((acc, p) => {
    (acc[p.risk_level] = acc[p.risk_level] || []).push(p);
    return acc;
  }, {});

  if (issued) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <div className="w-full max-w-md bg-slate-900 border border-green-500/30 rounded-3xl p-8 text-center space-y-6 shadow-2xl shadow-green-500/10">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-green-500/10 border border-green-500/30 flex items-center justify-center">
            <Check size={32} className="text-green-400" />
          </div>
          <div>
            <h2 className="text-xl font-black text-green-400 mb-2">CREDENTIAL ISSUED</h2>
            <p className="text-slate-500 text-sm">Delegation credential successfully created</p>
          </div>
          <div className="p-4 bg-slate-800/80 rounded-2xl border border-slate-700/40 space-y-3">
            <div className="text-center">
              <div className="text-lg font-black font-mono text-blue-400">{issued.credential_id}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Credential ID</div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-slate-500 text-[10px]">Agent</div>
                <div className="text-slate-300 font-mono">{agent.name}</div>
              </div>
              <div>
                <div className="text-slate-500 text-[10px]">Permissions</div>
                <div className="text-green-400 font-mono">{selected.length} granted</div>
              </div>
              <div>
                <div className="text-slate-500 text-[10px]">Issued</div>
                <div className="text-slate-400 font-mono text-[10px]">{new Date(issued.issued_at).toLocaleTimeString()}</div>
              </div>
              <div>
                <div className="text-slate-500 text-[10px]">Expires</div>
                <div className="text-slate-400 font-mono text-[10px]">{new Date(issued.expires_at).toLocaleString()}</div>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors text-sm"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700/60 rounded-3xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Key size={16} className="text-blue-400" />
                <h2 className="text-sm font-black text-slate-200 uppercase tracking-wide">Issue Delegation Credential</h2>
              </div>
              <p className="text-[11px] text-slate-500">
                Granting authority to{' '}
                <span className="text-blue-400 font-mono">{agent.name}</span>
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Agent DID */}
          <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/40">
            <div className="text-[9px] text-slate-500 mb-1">Agent DID</div>
            <div className="text-[11px] font-mono text-blue-400 break-all">{agent.did}</div>
          </div>

          {/* Expiry */}
          <div>
            <div className="text-[10px] text-slate-500 mb-2 flex items-center gap-1"><Clock size={10} /> Credential validity</div>
            <div className="flex gap-2 flex-wrap">
              {[4, 8, 24, 72].map(h => (
                <button key={h}
                  onClick={() => setHours(h)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    hours === h
                      ? 'bg-blue-600 text-white border border-blue-500'
                      : 'bg-slate-800 text-slate-400 border border-slate-700/40 hover:bg-slate-700'
                  }`}>
                  {h}h
                </button>
              ))}
            </div>
          </div>

          {/* Permissions by risk level */}
          {['low', 'medium', 'high', 'critical'].map(level => {
            if (!grouped[level]?.length) return null;
            const c = RISK_COLORS[level];
            return (
              <div key={level}>
                <div className={`flex items-center gap-2 mb-2 text-[10px] font-bold uppercase tracking-widest ${c.text}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                  {level} risk
                </div>
                <div className="space-y-1.5">
                  {grouped[level].map(perm => {
                    const isSelected = selected.includes(perm.action);
                    return (
                      <button
                        key={perm.action}
                        onClick={() => toggle(perm.action)}
                        className={`
                          w-full flex items-center justify-between px-4 py-3 rounded-xl border
                          text-left transition-all text-xs
                          ${isSelected
                            ? `${c.bg} ${c.border}`
                            : 'bg-slate-800/40 border-slate-700/30 hover:bg-slate-800'}
                        `}
                      >
                        <div>
                          <div className={`font-bold ${isSelected ? c.text : 'text-slate-400'}`}>
                            {perm.label}
                          </div>
                          <div className="text-[9px] text-slate-600 font-mono mt-0.5">{perm.action}</div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {perm.requires_approval === 1 && (
                            <span className="text-[8px] text-amber-500/70 font-mono">NEEDS APPROVAL</span>
                          )}
                          <div className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                            isSelected ? `${c.bg} ${c.border}` : 'border-slate-600 bg-slate-800'
                          }`}>
                            {isSelected && <Check size={10} className={c.text} strokeWidth={3} />}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-800 flex-shrink-0 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">{selected.length} permissions selected</span>
            <span className="text-slate-600 font-mono">Valid for {hours}h</span>
          </div>
          <button
            onClick={handleIssue}
            disabled={selected.length === 0 || issuing}
            className={`
              w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all
              ${selected.length > 0 && !issuing
                ? 'bg-blue-600 hover:bg-blue-500 text-white border border-blue-500/50 shadow-lg shadow-blue-500/20'
                : 'bg-slate-800 text-slate-600 border border-slate-700/40 cursor-not-allowed'}
            `}
          >
            {issuing ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Issuing...</>
            ) : (
              <><Key size={16} /> Issue Delegation Credential</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Agent Card ───────────────────────────────────────────────────────────────
function AgentCard({ agent, onManage }) {
  const hasCred = !!agent.activeCredential;
  const permCount = agent.activePermissions?.length || 0;

  return (
    <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/40 hover:border-slate-600/60 transition-all group">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-700/60 border border-slate-600/40 flex items-center justify-center text-xl">
            {INDUSTRY_ICONS[agent.industry] || '🤖'}
          </div>
          <div>
            <div className="text-sm font-bold text-slate-200">{agent.name}</div>
            <div className="text-[10px] text-slate-500 font-mono capitalize">{agent.industry} agent</div>
          </div>
        </div>
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[9px] font-bold border ${
          agent.status === 'active'
            ? 'bg-green-500/10 border-green-500/30 text-green-400'
            : 'bg-slate-700/40 border-slate-600/40 text-slate-500'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${agent.status === 'active' ? 'bg-green-400 status-dot' : 'bg-slate-500'}`} />
          {agent.status.toUpperCase()}
        </div>
      </div>

      {/* DID */}
      <div className="mb-4 p-2 bg-slate-900/60 rounded-lg">
        <div className="text-[8px] text-slate-600 mb-0.5">DID</div>
        <div className="text-[10px] text-blue-400/70 font-mono truncate">{agent.did}</div>
      </div>

      {/* Credential status */}
      <div className="mb-4">
        {hasCred ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-green-400 font-bold flex items-center gap-1">
                <Check size={10} /> Active Credential
              </span>
              <span className="text-[9px] font-mono text-slate-500">
                {permCount} permission{permCount !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="text-[9px] font-mono text-slate-600 bg-slate-900/60 px-2 py-1 rounded">
              {agent.activeCredential.credential_id}
            </div>
            <div className="flex flex-wrap gap-1">
              {agent.activePermissions.slice(0, 4).map(p => (
                <span key={p} className="text-[8px] bg-green-500/10 border border-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-mono">
                  ✓ {p.split('_').slice(0,2).join('_')}
                </span>
              ))}
              {permCount > 4 && (
                <span className="text-[8px] text-slate-600 px-1 py-0.5">+{permCount - 4} more</span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[11px] text-amber-400/80 p-2 bg-amber-500/5 rounded-lg border border-amber-500/15">
            <AlertTriangle size={12} />
            No active credential — agent cannot execute
          </div>
        )}
      </div>

      <button
        onClick={() => onManage(agent)}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
          bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 hover:border-blue-500/50
          text-blue-400 font-bold text-xs transition-all"
      >
        <Key size={12} />
        Manage Authority
        <ChevronRight size={12} />
      </button>
    </div>
  );
}

// ─── Credential History Panel ─────────────────────────────────────────────────
function CredentialHistory({ credentials }) {
  if (!credentials?.length) {
    return (
      <div className="text-center py-8 text-slate-600 text-sm">
        No credentials issued yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {credentials.slice(0, 8).map(cred => {
        const isActive = cred.status === 'active' && new Date(cred.expires_at) > new Date();
        let perms = [];
        try { perms = JSON.parse(cred.permissions); } catch {}
        return (
          <div key={cred.credential_id}
            className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/30 text-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-blue-400 text-[11px]">{cred.credential_id}</span>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                isActive ? 'bg-green-500/10 text-green-400' : 'bg-slate-700 text-slate-500'
              }`}>
                {isActive ? 'ACTIVE' : cred.status.toUpperCase()}
              </span>
            </div>
            <div className="text-slate-500 text-[10px]">
              {cred.agent_id} · {perms.length} permissions · Issued {new Date(cred.issued_at).toLocaleString()}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AuthorityControlCenter() {
  const navigate = useNavigate();
  const { authority, logout } = useAuth();
  const [stats,         setStats]         = useState(null);
  const [agents,        setAgents]        = useState([]);
  const [credentials,   setCredentials]   = useState([]);
  const [permissions,   setPermissions]   = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [activeTab,     setActiveTab]     = useState('agents');
  const [modalAgent,    setModalAgent]    = useState(null);
  const [refreshKey,    setRefreshKey]    = useState(0);
  const [issueSuccess,  setIssueSuccess]  = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, agentsRes, credsRes, permsRes] = await Promise.all([
        api.get('/authority/me'),
        api.get('/agents'),
        api.get('/credentials'),
        api.get('/permissions')
      ]);
      setStats(statsRes.data.stats);
      setAgents(agentsRes.data);
      setCredentials(credsRes.data);
      setPermissions(permsRes.data);
    } catch (err) {
      console.error('Load failed:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  const handleIssue = useCallback(async (agentId, perms, hours) => {
    const res = await api.post('/credentials/issue', {
      agentId,
      permissions: perms,
      expiresInHours: hours
    });
    setRefreshKey(k => k + 1);
    return res.data;
  }, []);

  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/login');
  }, [logout, navigate]);

  const tabs = [
    { id: 'agents',      label: 'Agents',       icon: Users },
    { id: 'credentials', label: 'Credentials',  icon: Key },
    { id: 'audit',       label: 'Audit Events', icon: FileText }
  ];

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">

      {/* ── Top Nav ── */}
      <nav className="bg-slate-900/95 border-b border-slate-800 px-6 h-14 flex items-center justify-between flex-shrink-0 backdrop-blur-xl sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-xs transition-colors"
          >
            <ChevronLeft size={14} />
            Home
          </button>
          <div className="w-px h-4 bg-slate-700" />
          <div className="flex items-center gap-2">
            <span className="text-lg">🦅</span>
            <span className="text-xs font-bold text-slate-300 tracking-wide">AUTHORITY CONTROL CENTER</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30
              border border-blue-500/30 text-blue-400 rounded-lg text-xs font-bold transition-colors"
          >
            <Zap size={12} />
            Launch Dashboard
            <ExternalLink size={10} />
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700
              border border-slate-700/40 text-slate-400 rounded-lg text-xs transition-colors"
          >
            <LogOut size={12} />
            Logout
          </button>
        </div>
      </nav>

      <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 space-y-8">

        {/* ── Authority Profile ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4
          p-6 rounded-2xl bg-gradient-to-r from-slate-800/80 to-slate-800/40 border border-slate-700/50">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20
              flex items-center justify-center text-2xl">
              👤
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-black text-slate-100">{authority?.name}</h1>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${LEVEL_COLORS[authority?.authority_level] || ''}`}>
                  {authority?.authority_level}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 max-w-md">{authority?.description}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-mono text-slate-600">
                  {INDUSTRY_ICONS[authority?.industry]} {authority?.industry?.toUpperCase()} AUTHORITY
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setRefreshKey(k => k + 1)}
              className="p-2 rounded-lg bg-slate-700/40 hover:bg-slate-700 text-slate-400 border border-slate-700/40 transition-colors"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Active Delegations" value={loading ? '—' : stats?.activeDelegations ?? 0}
            icon={Key} color="blue" sub="credentials" />
          <StatCard label="Active Agents" value={loading ? '—' : stats?.activeAgents ?? 0}
            icon={Users} color="green" sub="deployed" />
          <StatCard label="Actions Authorized" value={loading ? '—' : stats?.actionsAuthorized ?? 0}
            icon={Activity} color="purple" sub="this session" />
          <StatCard label="Approvals Granted" value={loading ? '—' : stats?.approvalsGranted ?? 0}
            icon={Shield} color="amber" sub="manual overrides" />
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 p-1 bg-slate-800/60 rounded-xl border border-slate-700/40 w-fit">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all
                  ${activeTab === tab.id
                    ? 'bg-slate-700 text-slate-100 shadow-sm'
                    : 'text-slate-500 hover:text-slate-300'}
                `}
              >
                <Icon size={13} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ── Tab: Agents ── */}
        {activeTab === 'agents' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-300 uppercase tracking-wider">Phoenix Agents</h2>
              <span className="text-[10px] text-slate-600 font-mono">{agents.length} registered</span>
            </div>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {[1,2,3,4].map(i => (
                  <div key={i} className="h-64 bg-slate-800/40 rounded-2xl border border-slate-700/40 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {agents.map(agent => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    onManage={a => setModalAgent(a)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Credentials ── */}
        {activeTab === 'credentials' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-300 uppercase tracking-wider">Delegation Credentials</h2>
              <span className="text-[10px] text-slate-600 font-mono">{credentials.length} total</span>
            </div>
            <div className="p-6 rounded-2xl bg-slate-800/60 border border-slate-700/40">
              <CredentialHistory credentials={credentials} />
            </div>
          </div>
        )}

        {/* ── Tab: Audit ── */}
        {activeTab === 'audit' && (
          <AuditEventsPanel />
        )}
      </div>

      {/* ── Credential Modal ── */}
      {modalAgent && (
        <CredentialModal
          agent={modalAgent}
          permissions={permissions.filter(p =>
            p.industry === modalAgent.industry || p.industry === 'general'
          )}
          onIssue={handleIssue}
          onClose={() => { setModalAgent(null); setRefreshKey(k => k + 1); }}
        />
      )}
    </div>
  );
}

// ─── Audit Events Panel ───────────────────────────────────────────────────────
function AuditEventsPanel() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/credentials/audit')
      .then(r => setEvents(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const ACTION_ICONS = {
    CREDENTIAL_ISSUED: { icon: '📜', color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20' },
    INCIDENT_STARTED:  { icon: '⚡', color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20' },
    BLOCKED:           { icon: '🔒', color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20' },
    SUCCESS:           { icon: '✅', color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20' }
  };

  const getStyle = (action, result) => {
    if (action === 'CREDENTIAL_ISSUED') return ACTION_ICONS.CREDENTIAL_ISSUED;
    if (action === 'INCIDENT_STARTED')  return ACTION_ICONS.INCIDENT_STARTED;
    if (result === 'BLOCKED')           return ACTION_ICONS.BLOCKED;
    return ACTION_ICONS.SUCCESS;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-black text-slate-300 uppercase tracking-wider">Platform Audit Events</h2>
        <span className="text-[10px] text-slate-600 font-mono">{events.length} events</span>
      </div>
      <div className="rounded-2xl bg-slate-800/60 border border-slate-700/40 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-6 h-6 border-2 border-slate-600 border-t-blue-500 rounded-full animate-spin mx-auto" />
          </div>
        ) : events.length === 0 ? (
          <div className="p-8 text-center text-slate-600 text-sm">No audit events yet</div>
        ) : (
          <div className="divide-y divide-slate-700/30">
            {events.map((ev, i) => {
              const style = getStyle(ev.action, ev.result);
              let meta = {};
              try { meta = JSON.parse(ev.metadata || '{}'); } catch {}
              return (
                <div key={ev.id || i} className="flex items-start gap-4 p-4 hover:bg-slate-800/40 transition-colors">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm ${style.bg} border ${style.border}`}>
                    {style.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-bold font-mono ${style.color}`}>{ev.action}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                        ev.result === 'SUCCESS' ? 'bg-green-500/10 text-green-400' : 'bg-slate-700 text-slate-500'
                      }`}>{ev.result}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 font-mono truncate">
                      {ev.agent || 'system'} {ev.credential_id ? `· ${ev.credential_id}` : ''}
                    </div>
                    {meta.permissionCount !== undefined && (
                      <div className="text-[10px] text-slate-600 mt-0.5">
                        {meta.permissionCount} permissions · issued to {meta.agentId}
                      </div>
                    )}
                  </div>
                  <div className="text-[9px] text-slate-600 font-mono flex-shrink-0 pt-0.5">
                    {new Date(ev.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
