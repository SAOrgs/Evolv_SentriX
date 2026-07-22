# SentriX - Data Flow & Demo Workflow

## Data Flow: From Sensor to Alert

```mermaid
sequenceDiagram
    participant Plant as Synthetic Plant<br/>(data_sim)
    participant Gas as Gas Agent
    participant Permit as Permit Agent
    participant Maint as Maintenance Agent
    participant Orch as Orchestrator
    participant RAG as Regulatory RAG
    participant API as FastAPI
    participant UI as React Dashboard

    Note over Plant: Tick advances (15 simulated minutes)
    
    Plant->>Gas: gas_readings per zone
    Gas->>Orch: Finding: gas trending up (zone-3, sev 0.57)
    
    Plant->>Permit: active permits
    Permit->>Orch: Finding: hot work no fire watch (zone-3, sev 0.50)
    Permit->>Orch: Finding: permit+gas conflict (zone-3, sev 0.65)
    
    Plant->>Maint: maintenance tasks + shifts
    Maint->>Orch: Finding: overdue maintenance (zone-3, sev 0.34)
    
    Note over Orch: Pass 1: Rule-based scoring<br/>Base + synergy bonus
    Orch->>Orch: Compute compound score:<br/>zone-3 = 82/100
    
    Note over Orch: Pass 2: LLM explanation (Claude)
    Orch->>Orch: Draft explanation:<br/>"hot work + rising gas + overdue task"
    
    Orch->>RAG: Retrieve relevant regulations
    RAG->>RAG: Query Chroma: "hot work gas trending"
    RAG->>Orch: Top docs: OISD-105, near-miss #003
    
    Note over RAG: Claude synthesizes citation
    RAG->>Orch: Citation: "Relates to OISD-105 Clause 5.2.1..."
    
    Orch->>API: Alert payload (score, signals, explanation, citation)
    API->>UI: GET /api/alerts
    UI->>UI: Render alert panel + heatmap overlay
```

---

## Deployment & Demo Flow

### Local Development
```bash
# Backend
uvicorn backend.main:app --reload --port 8000

# Frontend
cd frontend && npm run dev
```

### Live Demo Script (On Stage)

**Demo Scenario (Zone-3 Focus):**
1. **Start at tick 0** — show the heatmap, all zones green/yellow (benign).
2. **Advance to tick 10** — hot work permit opens in zone-3, fire watch flag is `false`.
   - Heatmap: zone-3 turns orange (~43 score).
   - Alert panel: not alerting yet (below 60 threshold).
3. **Advance to tick 12** — gas starts trending upward (~7 ppm/tick).
4. **Advance to tick 13** — compound condition emerges (fusion flags).
   - **Score jumps to 82** (alert fires).
   - Alert panel: "hot work + rising gas + overdue maintenance".
   - RAG citation: "Relates to OISD STD 105 Clause 5.2.1...".
   - **Headline:** "Flagged 75 minutes before a single-sensor system would have".
5. **Advance to tick 18** — gas crosses 50 ppm (single-sensor alarm would normally fire now).
   - Score: 100 (critical).
6. **Trigger emergency response** — click button or call API.
   - Evacuation order drafted.
   - Incident report displayed (Factory Act / DGMS compliance language).
   - Show mocked channel list.

### Rehearsal Notes
- Set `ANTHROPIC_API_KEY` for fluent Claude-drafted text.
- Without key: deterministic fallback templates are used (still specific, still grounded).
- Use the Reset button (`POST /api/simulate/reset`) for quickly re-running the scenario.
