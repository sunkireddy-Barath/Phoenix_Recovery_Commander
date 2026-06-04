import React from 'react';
import { Shield, CheckCircle, Clock, Cpu, Link, AlertCircle } from 'lucide-react';

/**
 * T3NCredentialBadge — Reusable T3N verification badge.
 * Makes Terminal 3's role visible at every action.
 *
 * Variants:
 *   VERIFIED        — blue,   T3N delegation proof confirmed
 *   TEE_CONFIRMED   — purple, Trusted Execution Environment verified
 *   BLOCKCHAIN      — green,  Audit VC stored on T3N chain
 *   SIMULATED       — gray,   Simulation mode (no API key)
 *   PENDING         — amber,  T3N check in progress
 *   BLOCKED         — red,    Not in delegation scope
 */

const VARIANTS = {
  VERIFIED: {
    bg:    'bg-blue-500/10',
    border:'border-blue-500/30',
    text:  'text-blue-400',
    label: 'T3N VERIFIED',
    Icon:  Shield,
    glow:  'shadow-blue-500/20'
  },
  TEE_CONFIRMED: {
    bg:    'bg-purple-500/10',
    border:'border-purple-500/30',
    text:  'text-purple-400',
    label: 'TEE CONFIRMED',
    Icon:  Cpu,
    glow:  'shadow-purple-500/20'
  },
  BLOCKCHAIN: {
    bg:    'bg-green-500/10',
    border:'border-green-500/30',
    text:  'text-green-400',
    label: 'BLOCKCHAIN LOGGED',
    Icon:  Link,
    glow:  'shadow-green-500/20'
  },
  SIMULATED: {
    bg:    'bg-slate-600/20',
    border:'border-slate-500/30',
    text:  'text-slate-400',
    label: 'SIMULATED',
    Icon:  AlertCircle,
    glow:  ''
  },
  PENDING: {
    bg:    'bg-amber-500/10',
    border:'border-amber-500/30',
    text:  'text-amber-400',
    label: 'CHECKING T3N...',
    Icon:  Clock,
    glow:  'shadow-amber-500/20'
  },
  BLOCKED: {
    bg:    'bg-red-500/10',
    border:'border-red-500/30',
    text:  'text-red-400',
    label: 'UNAUTHORIZED',
    Icon:  AlertCircle,
    glow:  'shadow-red-500/20'
  },
  APPROVED: {
    bg:    'bg-green-500/10',
    border:'border-green-500/30',
    text:  'text-green-400',
    label: 'HUMAN APPROVED',
    Icon:  CheckCircle,
    glow:  'shadow-green-500/20'
  }
};

export default function T3NCredentialBadge({ variant = 'VERIFIED', simulation = false, className = '' }) {
  const v = VARIANTS[simulation ? 'SIMULATED' : variant] || VARIANTS.VERIFIED;
  const { bg, border, text, label, Icon, glow } = v;

  return (
    <span className={`
      inline-flex items-center gap-1 px-2 py-0.5 rounded
      text-[10px] font-bold tracking-wider uppercase
      border ${bg} ${border} ${text}
      ${glow ? `shadow-sm ${glow}` : ''}
      ${className}
    `}>
      <Icon size={9} />
      {label}
    </span>
  );
}

export function T3NOperationStatus({ operation }) {
  if (!operation) return null;

  const statusMap = {
    PENDING:    'SIMULATED',
    AUTHORIZED: 'VERIFIED',
    LOGGED:     'BLOCKCHAIN',
    DENIED:     'BLOCKED'
  };

  const variant = statusMap[operation.status] || 'SIMULATED';

  return (
    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
      <T3NCredentialBadge variant={variant} simulation={operation.simulation} />
      {operation.block_hash && (
        <span className="text-slate-600 font-mono">
          {operation.block_hash.slice(0, 12)}…
        </span>
      )}
    </div>
  );
}
