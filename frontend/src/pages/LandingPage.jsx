import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Zap, Globe, Lock, ChevronRight, Activity, Server, Anchor } from 'lucide-react';

// ─── Animated Network Grid Canvas ────────────────────────────────────────────
function NetworkCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const NODES = Array.from({ length: 55 }, () => ({
      x:   Math.random() * canvas.width,
      y:   Math.random() * canvas.height,
      vx:  (Math.random() - 0.5) * 0.3,
      vy:  (Math.random() - 0.5) * 0.3,
      r:   Math.random() * 2 + 1,
      pulse: Math.random() * Math.PI * 2
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Move nodes
      for (const n of NODES) {
        n.x += n.vx; n.y += n.vy; n.pulse += 0.02;
        if (n.x < 0 || n.x > canvas.width)  n.vx *= -1;
        if (n.y < 0 || n.y > canvas.height) n.vy *= -1;
      }

      // Draw connections
      for (let i = 0; i < NODES.length; i++) {
        for (let j = i + 1; j < NODES.length; j++) {
          const dx = NODES[i].x - NODES[j].x;
          const dy = NODES[i].y - NODES[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            const alpha = (1 - dist / 120) * 0.25;
            ctx.strokeStyle = `rgba(59, 130, 246, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(NODES[i].x, NODES[i].y);
            ctx.lineTo(NODES[j].x, NODES[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw nodes
      for (const n of NODES) {
        const glow = (Math.sin(n.pulse) + 1) / 2;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + glow, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(59, 130, 246, ${0.4 + glow * 0.4})`;
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ opacity: 0.6 }}
    />
  );
}

// ─── Telemetry Pulse Row ──────────────────────────────────────────────────────
function TelemetryPulse() {
  const metrics = [
    { label: 'ACTIVE AGENTS',    value: '4',       unit: 'ONLINE',   color: 'text-green-400' },
    { label: 'INCIDENTS TODAY',  value: '12',      unit: 'RESOLVED', color: 'text-blue-400' },
    { label: 'COST SAVED',       value: '$2.4M',   unit: 'USD',      color: 'text-cyan-400' },
    { label: 'ACTIONS VERIFIED', value: '847',     unit: 'BY T3N',   color: 'text-purple-400' },
    { label: 'UPTIME',           value: '99.98%',  unit: 'SLA',      color: 'text-amber-400' },
  ];

  return (
    <div className="flex gap-8 justify-center flex-wrap">
      {metrics.map(m => (
        <div key={m.label} className="text-center">
          <div className={`text-2xl font-bold font-mono ${m.color}`}>{m.value}</div>
          <div className="text-[10px] text-slate-500 tracking-widest">{m.label}</div>
          <div className="text-[9px] text-slate-600 font-mono">{m.unit}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Feature Card ─────────────────────────────────────────────────────────────
function FeatureCard({ icon: Icon, title, desc, accent }) {
  return (
    <div className={`
      group relative p-6 rounded-xl border backdrop-blur-sm transition-all duration-300
      bg-slate-800/60 border-slate-700/50
      hover:border-${accent}-500/40 hover:bg-slate-800/80
    `}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4
        bg-${accent}-500/10 border border-${accent}-500/20
        group-hover:bg-${accent}-500/20 transition-colors`}>
        <Icon size={20} className={`text-${accent}-400`} />
      </div>
      <h3 className="text-sm font-bold text-slate-200 mb-2">{title}</h3>
      <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
    </div>
  );
}

// ─── Architecture Flow ────────────────────────────────────────────────────────
function ArchFlow() {
  const steps = [
    { label: 'Human Authority',    sub: 'LEVEL 3 access',     icon: '👤', color: 'blue' },
    { label: 'Delegates Authority', sub: 'Issues VC credential', icon: '📜', color: 'purple' },
    { label: 'Phoenix Agent',       sub: 'Receives delegation',  icon: '🦅', color: 'cyan' },
    { label: 'Verify Permission',   sub: 'T3N + credential check', icon: '🔐', color: 'green' },
    { label: 'Execute Recovery',    sub: 'Automated response',   icon: '⚡', color: 'amber' },
    { label: 'Audit Trail',         sub: 'Immutable log',        icon: '📋', color: 'red' },
  ];

  return (
    <div className="flex flex-wrap gap-2 justify-center items-center">
      {steps.map((s, i) => (
        <React.Fragment key={s.label}>
          <div className={`
            flex flex-col items-center gap-1 px-4 py-3 rounded-xl
            bg-slate-800/80 border border-slate-700/50
            hover:border-${s.color}-500/40 transition-colors cursor-default
          `}>
            <span className="text-xl">{s.icon}</span>
            <span className="text-[11px] font-bold text-slate-200 text-center">{s.label}</span>
            <span className="text-[9px] text-slate-500 text-center">{s.sub}</span>
          </div>
          {i < steps.length - 1 && (
            <ChevronRight size={16} className="text-slate-600 flex-shrink-0" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Main Landing Page ────────────────────────────────────────────────────────
export default function LandingPage() {
  const navigate = useNavigate();
  const [archOpen, setArchOpen] = useState(false);

  const features = [
    {
      icon: Lock,
      title: 'Verifiable Credential Delegation',
      desc: 'Authorities issue cryptographic delegation credentials to Phoenix agents. Every action is gated by verifiable permission scope.',
      accent: 'blue'
    },
    {
      icon: Shield,
      title: 'T3N Agent Auth SDK',
      desc: 'Terminal 3 verifies agent identity and validates delegation proofs before any recovery action can execute.',
      accent: 'purple'
    },
    {
      icon: Activity,
      title: 'Real-Time Human Escalation',
      desc: 'Actions outside delegation scope are automatically escalated. Human approvals are logged as tamper-proof audit records.',
      accent: 'cyan'
    },
    {
      icon: Globe,
      title: 'Multi-Industry Deployment',
      desc: 'Designed for ports, datacenters, power plants, and utility operators. Industry-specific permission sets and agent profiles.',
      accent: 'green'
    },
    {
      icon: Zap,
      title: 'Sub-Second Permission Checks',
      desc: 'Every agent action is validated against active credentials in milliseconds. No recovery delay from authorization overhead.',
      accent: 'amber'
    },
    {
      icon: Server,
      title: 'Immutable Audit Trail',
      desc: 'Every delegation, action, approval, and rejection is recorded with T3N-verified timestamps. Full compliance reporting.',
      accent: 'red'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-900 overflow-x-hidden">

      {/* ── Nav ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">🦅</span>
            <div>
              <span className="text-sm font-bold text-slate-100 tracking-wider">PHOENIX</span>
              <span className="text-[10px] text-slate-500 ml-2 font-mono">AUTHORITY CONTROL CENTER</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-slate-500 font-mono hidden sm:block">Powered by Terminal 3 Agent Auth</span>
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors border border-blue-500/50"
            >
              Authority Login
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center pt-14 overflow-hidden">
        <NetworkCanvas />

        {/* Radial glow */}
        <div className="absolute inset-0 bg-gradient-radial from-blue-500/5 via-transparent to-transparent pointer-events-none" />

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full
            bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-mono font-bold tracking-widest">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            T3N AGENT AUTH PLATFORM — HACKATHON DEMO
          </div>

          {/* Main heading */}
          <div className="space-y-3">
            <h1 className="text-4xl sm:text-6xl font-black text-slate-100 leading-tight tracking-tight">
              PHOENIX INDUSTRIAL
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent">
                RECOVERY COMMANDER
              </span>
            </h1>
            <p className="text-lg text-slate-400 font-light max-w-2xl mx-auto">
              Trusted Autonomous Recovery Agents
              <br />
              for Critical Infrastructure
            </p>
            <p className="text-sm text-blue-400/80 font-mono font-semibold tracking-wide">
              Powered by Terminal 3 Agent Auth
            </p>
          </div>

          {/* Description */}
          <p className="text-slate-500 text-sm max-w-xl mx-auto leading-relaxed">
            AI agents can recover critical infrastructure incidents,<br />
            but only if every action is <span className="text-blue-400">authorized</span>,{' '}
            <span className="text-purple-400">verifiable</span>, and{' '}
            <span className="text-cyan-400">auditable</span>.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap gap-4 justify-center">
            <button
              onClick={() => navigate('/login')}
              className="group flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-500
                         text-white font-bold rounded-xl transition-all text-sm
                         border border-blue-500/50 shadow-lg shadow-blue-500/20
                         hover:shadow-blue-500/40"
            >
              <Shield size={16} />
              Authority Login
              <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </button>

            <button
              onClick={() => setArchOpen(v => !v)}
              className="flex items-center gap-2 px-8 py-3 bg-slate-800 hover:bg-slate-700
                         text-slate-300 hover:text-slate-100 font-bold rounded-xl transition-all text-sm
                         border border-slate-700/60 hover:border-slate-600"
            >
              <Globe size={16} />
              View Architecture
            </button>

            <button
              onClick={() => navigate('/login')}
              className="flex items-center gap-2 px-8 py-3 bg-slate-800/60 hover:bg-slate-700
                         text-slate-400 hover:text-slate-200 font-bold rounded-xl transition-all text-sm
                         border border-slate-700/40"
            >
              <Zap size={16} />
              Launch Demo
            </button>
          </div>

          {/* Industry badges */}
          <div className="flex flex-wrap gap-2 justify-center mt-2">
            {[
              { icon: '⚓', label: 'Port Operations' },
              { icon: '💻', label: 'Datacenters' },
              { icon: '⚡', label: 'Power Plants' },
              { icon: '🏭', label: 'Utility Grids' },
            ].map(b => (
              <span key={b.label} className="flex items-center gap-1.5 px-3 py-1 rounded-full
                bg-slate-800/60 border border-slate-700/40 text-[11px] text-slate-400 font-mono">
                {b.icon} {b.label}
              </span>
            ))}
          </div>
        </div>

        {/* Telemetry bar */}
        <div className="relative z-10 w-full max-w-4xl mx-auto px-6 mt-16 pb-16">
          <div className="p-6 rounded-2xl bg-slate-800/60 border border-slate-700/40 backdrop-blur-sm">
            <TelemetryPulse />
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 animate-bounce">
          <div className="w-px h-8 bg-gradient-to-b from-slate-600 to-transparent" />
        </div>
      </section>

      {/* ── Architecture Flow (collapsible) ── */}
      {archOpen && (
        <section className="py-16 px-6 bg-slate-900/80 border-t border-slate-800">
          <div className="max-w-5xl mx-auto space-y-8">
            <div className="text-center">
              <h2 className="text-xl font-black text-slate-200 tracking-wider mb-2">
                AUTH DELEGATION FLOW
              </h2>
              <p className="text-xs text-slate-500 font-mono">
                Every recovery action flows through the authority chain
              </p>
            </div>
            <ArchFlow />
          </div>
        </section>
      )}

      {/* ── Features ── */}
      <section className="py-20 px-6 border-t border-slate-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-black text-slate-200 tracking-wider mb-3">
              ENTERPRISE AGENT AUTH PLATFORM
            </h2>
            <p className="text-slate-500 text-sm max-w-lg mx-auto">
              Every component of the authority chain — from credential issuance to audit logging — is production-grade.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map(f => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="py-16 px-6 border-t border-slate-800">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full
            bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-mono">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 status-dot" />
            SYSTEM OPERATIONAL
          </div>
          <h2 className="text-3xl font-black text-slate-100">
            Ready to authorize<br />
            <span className="text-blue-400">Phoenix Agents?</span>
          </h2>
          <p className="text-slate-500 text-sm">
            Select your authority role, issue delegation credentials,<br />
            and launch the incident recovery system.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="inline-flex items-center gap-2 px-10 py-4 bg-blue-600 hover:bg-blue-500
                       text-white font-black text-sm rounded-2xl transition-all
                       border border-blue-500/50 shadow-xl shadow-blue-500/25
                       hover:shadow-blue-500/50 hover:-translate-y-0.5"
          >
            <Anchor size={18} />
            Enter Authority Control Center
            <ChevronRight size={16} />
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-800 py-6 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-[11px] text-slate-600 font-mono">
            <span className="text-lg">🦅</span>
            PHOENIX AUTHORITY CONTROL CENTER
          </div>
          <div className="text-[10px] text-slate-700 font-mono">
            Powered by Terminal 3 Agent Auth SDK · Industrial Recovery Commander
          </div>
        </div>
      </footer>
    </div>
  );
}
