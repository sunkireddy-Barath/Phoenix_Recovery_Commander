import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import Dashboard from './components/Dashboard.jsx';

const api = axios.create({ baseURL: '/api', timeout: 15000 });

export default function App() {
  const [agentStatus,      setAgentStatus]      = useState(null);
  const [activeIncident,   setActiveIncident]   = useState(null);
  const [incidentId,       setIncidentId]       = useState(null);
  const [escalationModal,  setEscalationModal]  = useState(null);
  const [howItWorksOpen,   setHowItWorksOpen]   = useState(false);
  const [isLoading,        setIsLoading]        = useState(true);
  const [apiError,         setApiError]         = useState(null);
  const pollRef = useRef(null);

  // Load agent identity on mount
  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/agent/identity');
        setAgentStatus(res.data);
      } catch (err) {
        setApiError('Backend not reachable. Run: cd backend && npm run dev');
        console.error('Agent identity fetch failed:', err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  // Poll incident status when an incident is active
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
        console.error('Polling error:', err);
      }
    };

    poll(); // Immediate first poll
    pollRef.current = setInterval(poll, 1500);
    return () => clearInterval(pollRef.current);
  }, [incidentId]);

  const triggerIncident = useCallback(async (scenarioId) => {
    try {
      setActiveIncident(null);
      const res = await api.post('/incident/start', { scenarioId });
      setIncidentId(res.data.incidentId);
      setActiveIncident(res.data.incident);
    } catch (err) {
      console.error('Trigger incident failed:', err);
      setApiError(`Failed to start incident: ${err.message}`);
    }
  }, []);

  const approveEscalation = useCallback(async (action, approvedBy, approverRole) => {
    if (!incidentId) return;
    try {
      await api.post('/agent/approve-escalation', {
        incidentId,
        action,
        approvedBy,
        approverRole
      });
      setEscalationModal(null);
    } catch (err) {
      console.error('Approval failed:', err);
    }
  }, [incidentId]);

  const rejectEscalation = useCallback(async (action, rejectedBy) => {
    if (!incidentId) return;
    try {
      await api.post('/agent/reject-escalation', {
        incidentId,
        action,
        rejectedBy,
        reason: 'Human decision — action deferred'
      });
      setEscalationModal(null);
    } catch (err) {
      console.error('Rejection failed:', err);
    }
  }, [incidentId]);

  const resetIncident = useCallback(() => {
    clearInterval(pollRef.current);
    setIncidentId(null);
    setActiveIncident(null);
    setEscalationModal(null);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-4xl">🦅</div>
          <p className="text-slate-400 text-sm font-mono">
            🔐 T3N: Verifying Phoenix Agent identity...
          </p>
          <div className="flex gap-1 justify-center">
            {[0,1,2].map(i => (
              <div key={i} className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                   style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (apiError) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-8">
        <div className="bg-slate-800 border border-red-500/40 rounded-lg p-8 max-w-lg text-center space-y-4">
          <div className="text-3xl">⚠️</div>
          <h2 className="text-red-400 font-bold text-lg">Backend Connection Failed</h2>
          <p className="text-slate-400 text-sm">{apiError}</p>
          <div className="bg-slate-900 rounded p-4 text-left text-xs text-green-400 font-mono space-y-1">
            <p>$ cd backend</p>
            <p>$ npm install</p>
            <p>$ npm run dev</p>
          </div>
          <button onClick={() => window.location.reload()}
            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded text-sm transition-colors">
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
      onTriggerIncident={triggerIncident}
      onApproveEscalation={approveEscalation}
      onRejectEscalation={rejectEscalation}
      onResetIncident={resetIncident}
      onOpenHowItWorks={() => setHowItWorksOpen(true)}
      onCloseHowItWorks={() => setHowItWorksOpen(false)}
    />
  );
}
