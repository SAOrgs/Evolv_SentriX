# Evolv_SentriX
An AI-driven Industrial Safety Intelligence Platform that integrates multi-source industrial data to predict safety hazards, assess compound risks, generate explainable alerts, and assist in proactive incident prevention.

## How to Run

### Prerequisites
- **Python 3.8+**
- **Node.js** (for the frontend)

### 1. Start the Backend
The backend runs on FastAPI and uses a synthetic data generator. Run it from the root directory so the modules resolve correctly.

```bash
# 1. Install dependencies (it is recommended to use a virtual environment)
pip install -r requirements.txt

# 2. (Optional) Set API Key for Claude-powered RAG and emergency reports
export ANTHROPIC_API_KEY="your-api-key-here"

# 3. Start the server
uvicorn backend.main:app --reload --port 8000
```
*The backend API will be available at `http://localhost:8000`.*

### 2. Start the Frontend
The frontend is a React application powered by Vite.

```bash
# 1. Navigate to the frontend directory
cd frontend

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```
*The frontend UI will typically be available at `http://localhost:5173` (or the port Vite provides).*

## Synthetic Data (`data_sim/`)

**All data in this project is 100% synthetic.** We do not have access to a real
industrial plant's gas sensors, SCADA, permit-to-work system, or maintenance
logs. Rather than block the prototype on data access, we generate realistic
streams ourselves. Nothing here is validated against a real site, and no output
should ever be presented as real plant data.

The generator lives in `data_sim/generator.py` and produces, per simulated
"tick" (1 tick = 15 simulated minutes):

- **Gas/IoT readings** — gas concentration (ppm) for 5 plant zones. Normally
  fluctuates in a safe band around ~10 ppm; a zone can be scripted to trend
  upward toward the lower explosive limit (LEL). The single-sensor hard alarm
  threshold defaults to 50 ppm (≈20% of a 100 ppm LEL reference).
- **Permits** — hot work, confined space entry, and general maintenance
  permits, each with `zone_id`, `type`, start/end time, and a
  `fire_watch_logged` flag.
- **Maintenance & shift logs** — scheduled maintenance tasks with a due time and
  completion status (so we can flag *overdue*), and shift roster entries with
  start/end times (so we can flag a *long consecutive shift* as a fatigue-risk
  proxy; threshold 12h).

### Deterministic and reproducible

Everything is driven by a single random seed, so a rehearsed demo replays
identically every time:

```python
from data_sim.generator import build_demo_scenario

plant = build_demo_scenario(seed=42)  # same seed -> same run, every time
state = plant.advance_tick()          # step one tick; returns a plain dict
state = plant.get_current_state()     # snapshot without advancing
```

`advance_tick()` and `get_current_state()` return JSON-friendly plain dicts —
this is exactly what the FastAPI layer will wrap next.

### The scripted demo scenario

`build_demo_scenario()` scripts the exact compound-risk situation we show live.
It targets **zone-3 ("Process Unit B")**:

| Tick | What happens |
|------|--------------|
| 10   | A **hot work permit** opens in zone-3 with **no fire watch logged** |
| 12   | Gas in zone-3 **starts trending upward** |
| ~14  | Gas is clearly rising *and* a hot-work permit is active with no fire watch → the **fusion layer should already flag a compound risk** |
| 18   | Gas only **now** crosses the single-sensor hard threshold (50 ppm) — the earliest a traditional standalone gas alarm would fire |
| 20   | Gas ≈ 65 ppm; the combination is unambiguously dangerous |

The gap between ~tick 14 and tick 18 is the whole point of the platform: the
correlation/fusion layer flags the hazard roughly **60 simulated minutes before**
any single sensor would. The ramp is tuned so that **no single signal crosses a
hard threshold before tick 18** — proving the value comes from correlating
individually-benign signals, not from a louder single alarm.

### Sanity-check runner

Run the demo scenario for 30 ticks and print a per-tick summary (add `--full`
for a full JSON state dump):

```bash
python -m data_sim.run_sim --ticks 30 --seed 42
python -m data_sim.run_sim --full
```

## Regulatory RAG (`backend/rag/`)

Each orchestrator alert above the threshold now includes a **grounded regulatory
citation** retrieved from a hand-picked corpus of real OISD/DGMS/Factory Act
clauses plus synthetic near-miss reports (see `backend/rag/corpus.py`).

### Corpus

- **8 real regulatory clauses** from publicly-available OISD standards (STD 105,
  STD 117), DGMS Mines Regulations (1961), Factories Act 1948, OSH Code 2020,
  and DGMS Technical Circulars — all covering hot work permits, gas hazard
  management, maintenance scheduling, and permit-to-work systems.
- **13 synthetic near-miss reports** that describe compound-risk scenarios
  matching what the orchestrator produces (hot work + gas trending, missing
  fire watch, overdue maintenance overlapping permits, fatigue-risk shifts).

Total: 21 documents embedded into **Chroma** using the default `all-MiniLM-L6-v2`
sentence-transformer model (automatically downloaded on first use; persists in
`backend/rag/chroma_db/` — excluded from git).

### Retrieval + synthesis

For each alert, the RAG module:
1. Embeds the orchestrator's plain-English explanation.
2. Retrieves the top-5 most relevant documents (cosine similarity).
3. Calls **Claude `claude-sonnet-4-6`** with the explanation + retrieved docs,
   instructed to write a grounded 1–2 sentence statement referencing ONLY the
   retrieved citations (no invention). Paraphrases the clauses; no verbatim quoting.
4. If `ANTHROPIC_API_KEY` is unset or the call fails, falls back to a
   deterministic template that still cites the top-ranked retrieved doc.

This ensures every citation in the UI is **100% traceable** to a doc in the
corpus — either a real regulatory clause or a near-miss report we wrote.

### Usage

The RAG is wired into `/api/alerts` automatically. Each alert's
`regulatory_citation` field now looks like:

```json
{
  "clause": "This combination relates to OISD STD 105, Clause 5.2.1, which requires fire watch during hot work in areas where gas may reach 10% LEL, and matches the pattern in Near-miss incident #003.",
  "source": "OISD STD 105 (Fire Protection Facilities), Clause 5.2.1",
  "status": "llm"  // "llm" | "fallback" | "no_retrieval" | "error"
}
```

Set `ANTHROPIC_API_KEY` to have Claude write the `clause`; without it, the
deterministic fallback is used (still grounded, just less fluent).

## Emergency Response (Mocked)

**`POST /api/emergency/trigger?zone_id=<zone>&threshold=<optional>`**

Drafts an emergency response when a zone crosses a hard risk threshold (default 85).
Returns a **mocked but realistic-looking** response payload — no real SMS/PA/app
notifications are sent. This demonstrates the drafted-report capability only.

Payload:
- `evacuation_instruction` — canned but zone-specific text
- `alert_channels` — list of strings naming the channels that would be notified
  (SMS, PA system, mobile app, control room, SCADA) — **MOCKED, no real integration**
- `incident_report` — auto-drafted preliminary regulatory incident report (3–4
  paragraphs, formal Factory Act / DGMS compliance tone). Drafted by Claude
  `claude-sonnet-4-6` if `ANTHROPIC_API_KEY` is set; otherwise uses a deterministic
  template. References the orchestrator explanation, trigger signals, timestamp,
  and regulatory citation from the RAG.
- `status` — always `"MOCKED - no real notifications sent"` to make clear this is
  a demo capability only.

```bash
# Step to tick 18 (zone-3 at score 100)
for i in $(seq 1 18); do curl -s -X POST http://localhost:8000/api/simulate/advance > /dev/null; done

# Trigger emergency response
curl -s -X POST "http://localhost:8000/api/emergency/trigger?zone_id=zone-3" | python3 -m json.tool
```

Returns `400` if the zone is below the emergency threshold; `404` if the zone
doesn't exist.

---

## API Contract Summary

All endpoints return graceful empty arrays/objects if called before data exists
(no unhandled 500s). Shapes match the original contract exactly.

| Endpoint | Method | Returns |
|----------|--------|---------|
| `/api/zones` | GET | Zones with floorplan coords (0–1000 space) |
| `/api/permits` | GET | Active permits |
| `/api/risk-scores` | GET | Current score per zone |
| `/api/risk-scores/history?zone_id=&hours=` | GET | Time series |
| `/api/alerts?threshold=` | GET | Zones above threshold with explanations + RAG citations |
| `/api/lead-time` | GET | Compound vs single-sensor lead-time metric |
| `/api/simulate/advance` | POST | Step sim + return enriched state |
| `/api/simulate/reset` | POST | Reset to tick 0 |
| `/api/emergency/trigger?zone_id=&threshold=` | POST | Draft mocked emergency response |

Set `ANTHROPIC_API_KEY` for Claude-drafted explanations, citations, and incident
reports. Without it, deterministic fallback templates (still grounded / specific)
are used — the platform works 100% offline.

---

## Known Issues & Bug Fixes

All identified bugs have been addressed. See **[BUGFIXES.md](BUGFIXES.md)** for detailed documentation of:

✅ **Bug #1 (CRITICAL - FIXED):** Emergency threshold was using wrong default value  
📝 **Bug #2 (Documented):** Global shared state (acceptable for single-user demo)  
📝 **Bug #3 (Documented):** In-memory history lost on restart (production TODO)  
✅ **Bug #4 (FIXED):** Frontend sync issues resolved with unified state endpoint  
✅ **Bug #5 (FIXED):** Stale cached explanations now update with gas ppm changes  
✅ **Bug #6 (FIXED):** Missing input validation on simulation advancement  

### For Production Deployment

Before deploying to production, address:
- Session-based state isolation (multi-user support)
- Persistent storage for risk history
- Authentication & authorization
- Rate limiting & monitoring
- Comprehensive security audit

See BUGFIXES.md for implementation guidance.
