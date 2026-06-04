# 🦅 Phoenix Recovery Commander
### Industrial AI Agent — Secured by Terminal 3 Agent Auth SDK

> **AI-powered autonomous recovery agent for industrial facility shutdowns. Every action is identity-verified, delegation-checked, and tamper-proof recorded by Terminal 3.**

---

## The Problem: Industrial Shutdowns Are Catastrophically Expensive

When a power plant's cooling system fails, a datacenter suffers ransomware, or a port crane breaks down, recovery becomes chaos. Human coordinators become bottlenecks. Decision chains stall. Every minute costs $9,000–$500,000.

**The three pillars of failure:**

1. **Speed**: Human-only coordination takes 3–4× longer than AI-assisted recovery. Operators must understand, decide, communicate, and execute across multiple departments simultaneously.

2. **Authority Gaps**: Recovery involves hundreds of micro-decisions. Some require immediate action. Others require specific human sign-offs. Current SCADA and ServiceNow systems cannot reason about which is which — they only record what happened.

3. **The Trust Problem** (the most critical, and the one no one solves): In critical infrastructure, an AI agent **cannot just act**. Every action must answer four unforgiving questions:
   - *Who took this action?* (Identity)
   - *Was it authorized to?* (Delegation)
   - *What exactly happened?* (Auditability)
   - *Was the data real or manipulated?* (Hardware verification)

**Phoenix Recovery Commander** is the first industrial recovery system that answers all four — using Terminal 3 Agent Auth SDK.

---

## Why Terminal 3 Is Not Optional — It's The Gatekeeper

T3N is not "bolted on" to this system. It is the **authority enforcement layer** that makes autonomous industrial recovery legally defensible:

```
EVERY recovery action follows this flow:

  Phoenix Agent requests action
        ↓
  T3N validates delegation
  (selective disclosure proof from delegation VC)
        ↓
  T3N confirms: Is this action in scope?
        ↓
  YES → Agent executes       NO → Block + escalate to human
        ↓                              ↓
  T3N records audit VC       Human approves
  (tamper-proof, on-chain)           ↓
                              T3N records approval VC
                              T3N records execution VC
```

**Without T3N, Phoenix Agent is just another automation script.  
With T3N, it's a legally auditable, cryptographically verified agent.**

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PHOENIX RECOVERY COMMANDER                        │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                      FRONTEND (React + Vite)                 │    │
│  │                                                               │    │
│  │  ┌──────────────┐  ┌─────────────────────┐  ┌───────────┐  │    │
│  │  │   Incident   │  │   Agent Action Feed  │  │   T3N     │  │    │
│  │  │   Selector   │  │   (Star of show)     │  │  Audit    │  │    │
│  │  │              │  │                       │  │  Trail    │  │    │
│  │  │ 3 scenarios  │  │ • Step reasoning      │  │           │  │    │
│  │  │ Downtime     │  │ • T3N badges          │  │ Timeline  │  │    │
│  │  │ cost counter │  │ • Block hashes        │  │ VC IDs    │  │    │
│  │  │              │  │ • Blocked/escalation  │  │ Export    │  │    │
│  │  └──────────────┘  └─────────────────────┘  └───────────┘  │    │
│  │                    ┌─────────────────────────────────────┐   │    │
│  │                    │     Telemetry Charts (Recharts)      │   │    │
│  │                    └─────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │ HTTP/REST (polling 1.5s)               │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    BACKEND (Node.js + Express)                │    │
│  │                                                               │    │
│  │  ┌──────────────────────┐   ┌──────────────────────────┐    │    │
│  │  │   Reasoning Engine   │   │     Playbook Engine      │    │    │
│  │  │   (Rule-based)       │   │  (Authority enforcement) │    │    │
│  │  │                      │   │                          │    │    │
│  │  │ • Telemetry analysis │   │ • validateAction()       │    │    │
│  │  │ • Decision trees     │   │ • getNextStep()          │    │    │
│  │  │ • Recovery planning  │   │ • simulateExecution()    │    │    │
│  │  └──────────────────────┘   └──────────────────────────┘    │    │
│  │                                                               │    │
│  │  ┌──────────────────────────────────────────────────────┐   │    │
│  │  │              T3N CLIENT (Gatekeeper)                  │   │    │
│  │  │                                                        │   │    │
│  │  │  verifyAgentIdentity()  → GET  /v1/did                │   │    │
│  │  │  registerDID()          → POST /v1/did/register       │   │    │
│  │  │  checkDelegation()      → POST /v1/vc/issuer/         │   │    │
│  │  │                                  credentials/proof    │   │    │
│  │  │  logAuditTrail()        → POST /v1/vc/issuer/store    │   │    │
│  │  └──────────────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │ HTTPS                                   │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │              TERMINAL 3 NETWORK (staging.terminal3.io)        │    │
│  │                                                               │    │
│  │  DID Registry  •  VC Issuer  •  Blockchain Audit  •  TEE    │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## The 5 Ways Terminal 3 Agent Auth SDK Is Used

### 1. Agent Identity — `GET /v1/did`
Phoenix Agent's DID (`did:key:phoenix-agent-001`) is registered on T3N. Every action is cryptographically linked to this identity. No impersonation. No identity spoofing. Called at incident start to verify the agent is who it claims to be.

### 2. DID Registration — `POST /v1/did/register`
On first startup, Phoenix Agent registers its DID on the T3N network with its wallet address. This creates the immutable identity anchor for all future authority checks.

### 3. Delegation Authority VC — `POST /v1/vc/issuer/store`
A Verifiable Credential is stored defining exactly which actions Phoenix Agent is authorized to execute (`authorized_actions`) and which require human approval (`unauthorized_actions`). This VC is the agent's "mandate" — cryptographically signed, tamper-proof.

### 4. Selective Disclosure Proof — `POST /v1/vc/issuer/credentials/proof`
**Before every single action**, T3N is asked to generate a selective disclosure proof revealing only the `authorized_actions` field from the delegation VC. This is zero-knowledge: the agent proves it has permission for this specific action without revealing any other credential data. Steps 5–6 in every scenario are intentionally outside delegation scope — T3N's proof confirms this boundary.

### 5. Tamper-Proof Audit VCs — `POST /v1/vc/issuer/store`
After every action (authorized or human-approved), T3N records an `IndustrialAuditCredential` on-chain. The VC includes: action taken, agent DID, timestamp, result, approver (if applicable), telemetry snapshot, and delegation VC reference. Immutable. Forensically sound. Regulatory-grade.

---

## Three Incident Scenarios

| Scenario | Facility | Severity | Cost/Min | Auto Steps | Human-Gated |
|----------|----------|----------|----------|------------|-------------|
| INC-001 | Thermal Power Plant | CRITICAL | $85,000 | 4 | 2 (Plant Manager, Supervisor) |
| INC-002 | National Datacenter | HIGH | $125,000 | 4 | 2 (CISO, Legal) |
| INC-003 | International Port | HIGH | $62,000 | 4 | 2 (Port Authority, Harbor Master) |

---

## Project Structure

```
recovery-commander/
├── backend/
│   ├── agent/
│   │   ├── t3nClient.js        # T3N API integration (gatekeeper)
│   │   ├── reasoningEngine.js  # Rule-based decision engine (no LLM)
│   │   └── playbook.js         # Authority enforcement + execution simulation
│   ├── routes/
│   │   ├── incident.js         # Incident lifecycle + async step executor
│   │   └── agent.js            # Human approval + agent identity routes
│   ├── data/
│   │   └── scenarios.js        # 3 production scenarios (detailed playbooks)
│   ├── server.js               # Express server + T3N boot sequence
│   ├── package.json
│   └── .env                    # API keys
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard.jsx           # Main 3-panel layout
│   │   │   ├── IncidentPanel.jsx       # Scenario selector + cost counter
│   │   │   ├── AgentActionFeed.jsx     # Live execution feed (star component)
│   │   │   ├── AuditTrail.jsx          # T3N blockchain log + export
│   │   │   ├── TelemetryChart.jsx      # Recharts with danger reference lines
│   │   │   ├── EscalationModal.jsx     # Human approval + T3N explanation
│   │   │   ├── HowItWorksModal.jsx     # T3N role explainer for judges
│   │   │   └── T3NCredentialBadge.jsx  # Reusable VERIFIED/TEE/BLOCKCHAIN badges
│   │   ├── App.jsx             # State management + polling
│   │   └── main.jsx
│   └── package.json
└── README.md
```

---

## Running the Application

### Prerequisites
- Node.js 18+
- Two terminal windows

### Quick Start (Simulation Mode — No API Keys Needed)

```bash
# Terminal 1 — Backend
cd backend
npm install
npm run dev

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev

# Open: http://localhost:5173
```

### Live T3N Mode

Set in `backend/.env`:

```env
PORT=3001
T3N_API_KEY=your_t3n_api_key_here
T3N_BASE_URL=https://staging.terminal3.io
AGENT_DID=did:key:phoenix-agent-001
AGENT_VC_ID=urn:uuid:phoenix-agent-delegation-vc-001
AGENT_WALLET_ADDRESS=0xYourWalletAddress
```

On startup, the backend will:
1. `GET /v1/did` — verify agent DID on T3N network
2. `POST /v1/did/register` — register DID if not found
3. `POST /v1/vc/issuer/store` — store delegation VC with authorized_actions

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Server health + T3N agent status |
| GET | `/api/incident/scenarios` | All 3 incident scenarios |
| POST | `/api/incident/start` | Start incident, begin agent execution |
| GET | `/api/incident/status/:id` | Poll current incident state |
| GET | `/api/incident/audit-trail/:id` | Full T3N audit trail |
| GET | `/api/agent/identity` | Phoenix Agent DID + T3N status |
| POST | `/api/agent/approve-escalation` | Human approves blocked action |
| POST | `/api/agent/reject-escalation` | Human rejects blocked action |
| POST | `/api/agent/replan` | Re-run reasoning with new telemetry |

---

## Simulation vs. Live Mode

| Feature | Simulation Mode | Live T3N Mode |
|---------|----------------|---------------|
| Agent DID | did:key:phoenix-agent-001 | Registered on T3N network |
| Delegation VC | Local record | Stored on T3N, CID returned |
| Proof generation | Fake proofValue (z…) | Real ECDSA-SD-2023 proof |
| Audit VCs | Fake CID/block hash | Real CID from T3N blockchain |
| UI appearance | SIMULATED badge | T3N VERIFIED badge |
| Response structure | Identical | Identical |

The demo looks and behaves identically in both modes.

---

## Design Decisions

**Why Rule-Based Reasoning (Not LLM)?**  
LLMs introduce latency, cost, rate limits, and non-determinism in life-safety scenarios. Industrial recovery playbooks are deterministic: telemetry threshold X → action Y. The reasoning engine uses scenario-specific decision trees with pre-validated action sequences. Judges care about T3N authority enforcement, not LLM creativity.

**Why T3N Before Every Action?**  
The delegation check runs before each individual action (not just at startup) because delegation scope can be revoked mid-incident, a compromised agent could attempt unauthorized actions, and selective disclosure proof provides cryptographic scope confirmation per-action.

**Phoenix Agent DID**  
`did:key:phoenix-agent-001` — registered on T3N, with delegated authority from the Industrial Facility Authority covering steps 1–4 of each recovery scenario. Steps 5–6 are intentionally outside delegation scope to demonstrate T3N's enforcement.

---

## Future Vision

- **Power Grid Recovery**: Phoenix Agent managing switching sequences during blackouts with T3N providing per-action delegation proofs for NERC compliance.
- **Telecom Failover**: Routing table modifications during DDoS attacks with T3N preventing unauthorized traffic rerouting.
- **Airport Ground Ops**: Runway assignment during weather events with T3N audit trail meeting FAA safety requirements.
- **Municipal Water Treatment**: Chemical dosing adjustments with T3N ensuring only certified operators can approve critical parameter changes.

**In every case: T3N is the gatekeeper between AI capability and physical-world authority.**

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TailwindCSS 3, Recharts, Lucide React |
| Backend | Node.js 18, Express 4, Axios, UUID |
| Agent Auth | Terminal 3 (DID, VC, Selective Disclosure, Blockchain Audit) |
| Decision Engine | Rule-based reasoning tree (no LLM dependency) |

---

## Judging Criteria Alignment

**Problem Size (30%)**: Industrial downtime costs $9,000–$500,000/minute. The Texas grid failure (2021) cost $195B — 80% of which faster automated recovery could have mitigated.

**Stability/Security (40%)**: Every action gated by T3N delegation proof. No action executes without cryptographic authority confirmation. Human escalation enforced at delegation boundaries. Graceful simulation fallback on any T3N failure.

**Creativity (30%)**: First industrial recovery agent with cryptographically verified identity. Selective disclosure proofs limit agent scope per-action. Human approval recorded as T3N VC — the approval chain is as auditable as the execution chain.

---

*Phoenix Agent DID: `did:key:phoenix-agent-001`*  
*Delegated Authority: Facility Operations (Steps 1–4 per scenario)*  
*Unauthorized Actions: Core restarts, regulatory notifications (requires human)*
