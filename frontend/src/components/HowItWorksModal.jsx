import React from 'react';
import { X, Shield, Key, Link, Cpu, CheckCircle } from 'lucide-react';
import T3NCredentialBadge from './T3NCredentialBadge.jsx';

const T3N_ROLES = [
  {
    icon: Key,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    title: '1. Agent Identity (DID)',
    desc: 'Phoenix Agent has a Decentralized Identifier (DID) registered on the Terminal 3 Network. Every action is cryptographically linked to this identity — no impersonation possible.',
    api: 'GET /v1/did',
    badge: 'VERIFIED'
  },
  {
    icon: Shield,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    title: '2. Delegation Authority (VC)',
    desc: 'A Verifiable Credential defines exactly which actions Phoenix Agent is authorized to execute. This is cryptographically signed and cannot be altered. Steps 5–6 in each scenario are intentionally outside this scope.',
    api: 'POST /v1/vc/issuer/store',
    badge: 'TEE_CONFIRMED'
  },
  {
    icon: CheckCircle,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
    title: '3. Selective Disclosure Proof',
    desc: 'Before each action, T3N generates a zero-knowledge selective disclosure proof: revealing only the authorized_actions field from the delegation VC. The agent may not execute without this proof.',
    api: 'POST /v1/vc/issuer/credentials/proof',
    badge: 'VERIFIED'
  },
  {
    icon: Link,
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    title: '4. Tamper-Proof Audit VC',
    desc: 'After every action (authorized or human-approved), T3N records an Audit Verifiable Credential on-chain. Includes: action taken, agent DID, timestamp, result, and approver if applicable. Immutable.',
    api: 'POST /v1/vc/issuer/store',
    badge: 'BLOCKCHAIN'
  },
  {
    icon: Cpu,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    title: '5. Human Approval VC',
    desc: 'When a human approves a blocked action, their decision is recorded as a separate Verifiable Credential — creating an unambiguous, auditable chain of authority for every decision made during recovery.',
    api: 'POST /v1/vc/issuer/store',
    badge: 'APPROVED'
  }
];

export default function HowItWorksModal({ onClose }) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-600/40 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-800 border-b border-slate-700/60 flex items-center justify-between p-5 z-10">
          <div>
            <h2 className="text-sm font-bold text-slate-200">How Terminal 3 Powers Phoenix Agent</h2>
            <p className="text-xs text-slate-500 mt-0.5">5 ways T3N Agent Auth SDK is essential — not optional</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 flex items-center justify-center transition-colors">
            <X size={14} className="text-slate-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* The core problem */}
          <div className="bg-slate-900/60 border border-slate-700/40 rounded-lg p-4">
            <p className="text-xs text-slate-400 font-bold mb-2">The Core Trust Problem in AI Agents</p>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              In critical infrastructure, an AI agent cannot just "act." Every action must answer four questions:
              <strong className="text-slate-300"> Who took this action? Was it authorized? What exactly happened? Was the data real?</strong>
              Terminal 3 answers all four — using DIDs, Verifiable Credentials, TEE execution, and on-chain audit trails.
            </p>
          </div>

          {/* T3N roles */}
          {T3N_ROLES.map((role, i) => {
            const Icon = role.icon;
            return (
              <div key={i} className={`border ${role.border} ${role.bg} rounded-lg p-4`}>
                <div className="flex items-start gap-3">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-lg ${role.bg} flex items-center justify-center border ${role.border}`}>
                    <Icon size={14} className={role.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className={`text-xs font-bold ${role.color}`}>{role.title}</p>
                      <T3NCredentialBadge variant={role.badge} />
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed mb-2">{role.desc}</p>
                    <div className="bg-slate-900/60 rounded px-2 py-1 inline-block">
                      <span className="text-[10px] text-slate-500 font-mono">T3N API: </span>
                      <span className="text-[10px] text-green-400 font-mono">{role.api}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Architecture flow */}
          <div className="bg-slate-900/60 border border-slate-700/40 rounded-lg p-4">
            <p className="text-[10px] text-slate-400 font-bold mb-3 uppercase tracking-wider">Gatekeeper Flow — Every Action</p>
            <div className="space-y-1.5">
              {[
                ['🦅', 'Phoenix Agent requests action', 'text-slate-300'],
                ['🔐', 'T3N validates delegation (selective disclosure proof)', 'text-blue-400'],
                ['✅', 'T3N issues authorization proof', 'text-green-400'],
                ['⚡', 'Agent executes action (or blocks + escalates)', 'text-amber-400'],
                ['⛓', 'T3N records tamper-proof audit VC on-chain', 'text-purple-400']
              ].map(([icon, text, color], i) => (
                <div key={i} className="flex items-center gap-2 text-[11px]">
                  <span className="flex-shrink-0">{icon}</span>
                  <span className={`flex-shrink-0 text-slate-600 font-mono`}>{i+1}.</span>
                  <span className={color}>{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Simulation note */}
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
            <p className="text-[10px] text-amber-500 font-bold mb-1">🔄 Simulation vs. Live Mode</p>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Without <code className="text-amber-400">T3N_API_KEY</code> in <code className="text-amber-400">backend/.env</code>,
              all T3N operations are simulated with identical response structure, realistic DIDs, block hashes, and VC IDs.
              The demo is fully functional in either mode — add the API key to switch to live T3N.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
