import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';

import { AuthProvider, useAuth } from './context/AuthContext';
import LandingPage              from './pages/LandingPage';
import LoginPage                from './pages/LoginPage';
import AuthorityControlCenter   from './pages/AuthorityControlCenter';
import Dashboard                from './components/Dashboard';
import ErrorBoundary            from './components/ErrorBoundary';

const api = axios.create({ baseURL: '/api', timeout: 15000, withCredentials: true });

// ─── Incident runtime (unchanged from original) ───────────────────────────────
function PhoenixDashboard() {
  const [agentStatus,     setAgentStatus]     = useState(null);
  const [activeIncident,  setActiveIncident]  = useState(null);
  const [incidentId,      setIncidentId]      = useState(null);
  const [escalationModal, setEscalationModal] = useState(null);
  const [howItWorksOpen,  setHowItWorksOpen]  = useState(false);
  const [isLoading,       setIsLoading]       = useState(true);
  const [apiError,        setApiError]        = useState(null);
  const pollRef = useRef(null);
  const { authority } = useAuth();

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/agent/identity');
        setAgentStatus(res.data);
      } catch {
        setApiError('Backend not reachable. Start the backend first:');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!incidentId) return;
    const poll = async () => {
      try {
        const res = await api.get(`/incident/status/${incidentId}`);
        const inc = res.data;
        setActiveIncident(inc);
        if (inc.status === 'blocked' && inc.pendingEscalation) {
          setEscalationModal(inc.pendingEscalation);
        } else if (inc.status !== 'blocked') {
          setEscalationModal(null);
        }
      } catch (err) {
        console.error('Polling error:', err.message);
      }
    };
    poll();
    pollRef.current = setInterval(poll, 1500);
    return () => clearInterval(pollRef.current);
  }, [incidentId]);

  const triggerIncident = useCallback(async (scenarioId) => {
    try {
      setActiveIncident(null);
      const res = await api.post('/incident/start', { scenarioId });
      setIncidentId(res.data.incidentId);
      setActiveIncident(res.data.incident);
      setApiError(null);
    } catch (err) {
      setApiError(`Failed to start incident: ${err.response?.data?.error || err.message}`);
    }
  }, []);

  const approveEscalation = useCallback(async (action, approvedBy, approverRole) => {
    if (!incidentId) return;
    try {
      await api.post('/agent/approve-escalation', { incidentId, action, approvedBy, approverRole });
      setEscalationModal(null);
    } catch (err) {
      console.error('Approval failed:', err.response?.data || err.message);
    }
  }, [incidentId]);

  const rejectEscalation = useCallback(async (action, rejectedBy) => {
    if (!incidentId) return;
    try {
      await api.post('/agent/reject-escalation', {
        incidentId, action, rejectedBy,
        reason: 'Human decision — action deferred pending further assessment'
      });
      setEscalationModal(null);
    } catch (err) {
      console.error('Rejection failed:', err.message);
    }
  }, [incidentId]);

  const resetIncident = useCallback(async () => {
    clearInterval(pollRef.current);
    if (incidentId) {
      try { await api.post('/incident/cancel', { incidentId }); } catch {}
    }
    setIncidentId(null);
    setActiveIncident(null);
    setEscalationModal(null);
  }, [incidentId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-5xl">🦅</div>
          <p className="text-slate-300 text-sm font-mono font-bold">PHOENIX RECOVERY COMMANDER</p>
          <p className="text-slate-500 text-xs font-mono">🔐 T3N: Verifying Phoenix Agent identity...</p>
          <div className="flex gap-1.5 justify-center mt-2">
            {[0,1,2].map(i => (
              <div key={i} className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                   style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (apiError && !activeIncident) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-8">
        <div className="bg-slate-800 border border-red-500/40 rounded-xl p-8 max-w-lg text-center space-y-4">
          <div className="text-4xl">🦅</div>
          <h2 className="text-red-400 font-bold text-lg">Backend Connection Failed</h2>
          <p className="text-slate-400 text-sm">{apiError}</p>
          <div className="bg-slate-900 rounded-lg p-4 text-left text-xs text-green-400 font-mono space-y-1">
            <p className="text-slate-500 mb-2"># Terminal 1 — Backend</p>
            <p>$ cd backend && npm run dev</p>
            <p className="text-slate-500 mt-2 mb-1"># Terminal 2 — Frontend</p>
            <p>$ cd frontend && npm run dev</p>
          </div>
          <button onClick={() => window.location.reload()}
            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg text-sm font-mono font-bold transition-colors">
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <Dashboard
      agentStatus={agentStatus}
      activeIncident={activeIncident}
      escalationModal={escalationModal}
      howItWorksOpen={howItWorksOpen}
      authority={authority}
      onTriggerIncident={triggerIncident}
      onApproveEscalation={approveEscalation}
      onRejectEscalation={rejectEscalation}
      onResetIncident={resetIncident}
      onOpenHowItWorks={() => setHowItWorksOpen(true)}
      onCloseHowItWorks={() => setHowItWorksOpen(false)}
    />
  );
}

// ─── Protected route wrapper ──────────────────────────────────────────────────
function ProtectedRoute({ children }) {
  const { authority, authLoading } = useAuth();
  if (authLoading) return null;
  if (!authority) return <Navigate to="/login" replace />;
  return children;
}

// ─── App with router ──────────────────────────────────────────────────────────
function AppRoutes() {
  return (
    <Routes>
      <Route path="/"          element={<LandingPage />} />
      <Route path="/login"     element={<LoginPage />} />
      <Route path="/authority" element={<ProtectedRoute><AuthorityControlCenter /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><PhoenixDashboard /></ProtectedRoute>} />
      {/* Legacy root redirects to landing */}
      <Route path="*"          element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
