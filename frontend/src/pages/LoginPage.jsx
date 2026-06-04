import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, ChevronLeft, ChevronRight, Lock, Check } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const api = axios.create({ baseURL: '/api', timeout: 10000, withCredentials: true });

const INDUSTRY_ICONS = {
  port:       '⚓',
  datacenter: '💻',
  utility:    '⚡',
  general:    '🏭'
};

const LEVEL_COLORS = {
  LEVEL_3: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400', badge: 'bg-purple-500/20' },
  LEVEL_2: { bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   text: 'text-blue-400',   badge: 'bg-blue-500/20' },
  LEVEL_1: { bg: 'bg-slate-700/30',  border: 'border-slate-600/30',  text: 'text-slate-400',  badge: 'bg-slate-700' }
};

function RoleCard({ role, selected, onSelect }) {
  const colors = LEVEL_COLORS[role.authority_level] || LEVEL_COLORS.LEVEL_1;
  const isSelected = selected?.id === role.id;

  return (
    <button
      onClick={() => onSelect(role)}
      className={`
        w-full text-left p-5 rounded-2xl border transition-all duration-200 group relative
        ${isSelected
          ? `${colors.bg} ${colors.border} shadow-lg`
          : 'bg-slate-800/60 border-slate-700/40 hover:bg-slate-800 hover:border-slate-600/60'}
      `}
    >
      {isSelected && (
        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
          <Check size={11} className="text-white" strokeWidth={3} />
        </div>
      )}

      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={`
          w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0
          ${isSelected ? colors.bg : 'bg-slate-700/60'}
          border ${isSelected ? colors.border : 'border-slate-600/40'}
          transition-colors
        `}>
          {INDUSTRY_ICONS[role.industry] || '🏭'}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className={`text-sm font-bold ${isSelected ? 'text-slate-100' : 'text-slate-300'}`}>
              {role.name}
            </h3>
            <span className={`
              text-[9px] font-bold px-2 py-0.5 rounded-full
              ${isSelected ? `${colors.badge} ${colors.text}` : 'bg-slate-700 text-slate-500'}
            `}>
              {role.authority_level}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">
            {role.description}
          </p>
          <div className="mt-2 flex items-center gap-1.5">
            <span className={`text-[9px] font-mono ${isSelected ? colors.text : 'text-slate-600'}`}>
              {role.industry.toUpperCase()} OPERATIONS
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, authority } = useAuth();
  const [roles, setRoles]         = useState([]);
  const [selected, setSelected]   = useState(null);
  const [loading, setLoading]     = useState(false);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [error, setError]         = useState(null);

  // Already logged in → go to authority center
  useEffect(() => {
    if (authority) navigate('/authority');
  }, [authority, navigate]);

  useEffect(() => {
    api.get('/auth/roles')
      .then(r => setRoles(r.data))
      .catch(() => setError('Failed to load roles'))
      .finally(() => setRolesLoading(false));
  }, []);

  const handleLogin = async () => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      await login(selected.id);
      navigate('/authority');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">

      {/* ── Nav ── */}
      <nav className="bg-slate-900 border-b border-slate-800 px-6 h-14 flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-200 text-sm transition-colors"
        >
          <ChevronLeft size={16} />
          Back to home
        </button>
        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-600">
          <Lock size={11} />
          AUTHORITY AUTHENTICATION
        </div>
      </nav>

      {/* ── Main ── */}
      <div className="flex-1 flex items-start justify-center pt-12 pb-20 px-6">
        <div className="w-full max-w-xl space-y-6">

          {/* Header */}
          <div className="text-center space-y-3">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-500/10 border border-blue-500/20
                            flex items-center justify-center">
              <Shield size={32} className="text-blue-400" />
            </div>
            <h1 className="text-2xl font-black text-slate-100 tracking-wide">
              SELECT AUTHORITY ROLE
            </h1>
            <p className="text-slate-500 text-sm">
              Choose your authority level to issue delegation credentials<br />
              and authorize Phoenix Agents.
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full
              bg-amber-500/10 border border-amber-500/20 text-amber-400/80 text-[10px] font-mono">
              ⚠️ Demo mode — no real credentials required
            </div>
          </div>

          {/* Role list */}
          {rolesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-slate-800/40 border border-slate-700/40 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {roles.map(role => (
                <RoleCard
                  key={role.id}
                  role={role}
                  selected={selected}
                  onSelect={setSelected}
                />
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400 text-center">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleLogin}
            disabled={!selected || loading}
            className={`
              w-full flex items-center justify-center gap-2 py-4 rounded-2xl
              font-black text-sm transition-all
              ${selected && !loading
                ? 'bg-blue-600 hover:bg-blue-500 text-white border border-blue-500/50 shadow-lg shadow-blue-500/20'
                : 'bg-slate-800 text-slate-600 border border-slate-700/40 cursor-not-allowed'}
            `}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Authenticating...
              </>
            ) : (
              <>
                <Lock size={16} />
                Enter Authority Control Center
                <ChevronRight size={16} />
              </>
            )}
          </button>

          <p className="text-center text-[10px] text-slate-700 font-mono">
            Phoenix Authority Control Center · Terminal 3 Agent Auth Platform
          </p>
        </div>
      </div>
    </div>
  );
}
