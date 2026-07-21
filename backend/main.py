"""
backend/main.py
FastAPI wrapper around the synthetic data generator (data_sim).

All data served here is 100% SYNTHETIC - see data_sim/ and the README.
This layer just exposes the generator over the shared API contract so the
frontend (Person B) can build against it immediately. Risk scores and alerts
are NOT computed yet (that's A4); they return empty lists for now, but in the
exact shapes the contract specifies so nothing breaks when we fill them in.

--------------------------------------------------------------------------
RUN:
    uvicorn backend.main:app --reload --port 8000
    (run from the repo root so `data_sim` and `backend` are importable)

CURL SMOKE TESTS:
    # 1. Plant zones with 0-1000 floorplan coordinates
    curl -s http://localhost:8000/api/zones | python3 -m json.tool

    # 2. Currently active permits
    curl -s http://localhost:8000/api/permits | python3 -m json.tool

    # 3. Current compound risk score per zone
    curl -s http://localhost:8000/api/risk-scores | python3 -m json.tool

    # 4. Risk-score history (time series for the timeline chart)
    curl -s "http://localhost:8000/api/risk-scores/history?zone_id=zone-3&hours=6" | python3 -m json.tool

    # 5. Active alerts (zones above the alert threshold) with explanations
    curl -s http://localhost:8000/api/alerts | python3 -m json.tool

    # 6. Advance the simulation one tick -> raw state + fresh risk scores/alerts
    curl -s -X POST http://localhost:8000/api/simulate/advance | python3 -m json.tool

    # 7. Step to the compound-risk window (permit opens ~tick 10, gas trends
    #    ~tick 12, compound alert fires ~tick 13, single-sensor gas alarm ~tick 18)
    for i in $(seq 1 15); do curl -s -X POST http://localhost:8000/api/simulate/advance > /dev/null; done
    curl -s http://localhost:8000/api/alerts | python3 -m json.tool

    # 8. Lead-time headline metric
    curl -s http://localhost:8000/api/lead-time | python3 -m json.tool

    # 9. Reset the simulation back to tick 0 (demo-rehearsal convenience)
    curl -s -X POST http://localhost:8000/api/simulate/reset | python3 -m json.tool

    NOTE: set ANTHROPIC_API_KEY to have Claude write the alert explanations;
    without it, a strong deterministic fallback explanation is used instead.
--------------------------------------------------------------------------
"""

from __future__ import annotations

from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from data_sim.generator import SyntheticPlant, build_demo_scenario
from backend.agents.orchestrator import Orchestrator, ALERT_THRESHOLD

# --- Config ---------------------------------------------------------------
DEFAULT_SEED = 42
# Generator emits normalized (0-1) coordinates; the frontend floorplan works
# in a 0-1000 x 0-1000 space, so we scale on the way out.
COORD_SCALE = 1000

ALLOWED_ORIGINS = [
    "http://localhost:5173",  # Vite dev server (default)
    "http://localhost:3000",  # CRA / alternative dev server
]

# --- In-memory state ------------------------------------------------------
# A module-level dict is intentionally simple for the hackathon: it holds the
# single stateful plant simulation plus the orchestrator (which accumulates
# risk-score history across ticks). No DB server required.
def _new_state() -> dict:
    plant = build_demo_scenario(seed=DEFAULT_SEED)
    orch = Orchestrator(alert_threshold=ALERT_THRESHOLD)
    # Fuse the initial (tick 0) state so scores/history exist before the first
    # advance call.
    orch.process(plant.get_current_state())
    return {"plant": plant, "orchestrator": orch}


STATE: dict = _new_state()


def _plant() -> SyntheticPlant:
    return STATE["plant"]


def _orch() -> Orchestrator:
    return STATE["orchestrator"]


# Default SVG floorplan layouts for plant zones
ZONE_LAYOUTS = {
    "zone-1": {"x": 80,  "y": 80,  "width": 170, "height": 120},
    "zone-2": {"x": 340, "y": 60,  "width": 160, "height": 100},
    "zone-3": {"x": 180, "y": 260, "width": 200, "height": 140},
    "zone-4": {"x": 430, "y": 240, "width": 130, "height": 130},
    "zone-5": {"x": 60,  "y": 430, "width": 490, "height": 75},
}


def _scale_zone(zone_id: str, name: str, x: float, y: float) -> dict:
    """Map a normalized (0-1) zone into floorplan space with dimensions."""
    layout = ZONE_LAYOUTS.get(zone_id, {
        "x": round(x * COORD_SCALE, 1),
        "y": round(y * COORD_SCALE, 1),
        "width": 150,
        "height": 100,
    })
    return {
        "zone_id": zone_id,
        "name": name,
        "x": layout["x"],
        "y": layout["y"],
        "width": layout["width"],
        "height": layout["height"],
    }


def _zones_payload() -> list[dict]:
    return [
        _scale_zone(z.zone_id, z.name, z.x, z.y) for z in _plant().zones
    ]


def _scale_state_zones(state: dict) -> dict:
    """Rewrite the zone coords inside a raw state snapshot to 0-1000 space."""
    state = dict(state)
    state["zones"] = [
        _scale_zone(z["zone_id"], z["name"], z["x"], z["y"])
        for z in state.get("zones", [])
    ]
    return state


# --- App ------------------------------------------------------------------
app = FastAPI(
    title="Compound Risk Intelligence Platform (SentriX)",
    description="Synthetic-data backend. Correlates gas, permits, and "
                "maintenance/shift signals into a compound risk score.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root() -> dict:
    """Health/info endpoint."""
    return {
        "service": "SentriX backend",
        "status": "ok",
        "note": "SYNTHETIC DATA - not from a real plant",
        "tick": _plant().tick,
    }


# --- Contract endpoints (live) -------------------------------------------
@app.get("/api/zones")
def get_zones() -> list[dict]:
    """List the plant zones with name and 0-1000 floorplan coordinates."""
    return _zones_payload()


@app.get("/api/permits")
def get_permits() -> list[dict]:
    """Currently ACTIVE permits, with zone_id, type, and start/end time."""
    state = _plant().get_current_state()
    return [
        {
            "permit_id": p["permit_id"],
            "zone_id": p["zone_id"],
            "type": p["type"],
            "start_time": p["start_time"],
            "end_time": p["end_time"],
            "fire_watch_logged": p["fire_watch_logged"],
        }
        for p in state["permits"]
        if p["active"]
    ]


@app.post("/api/simulate/advance")
def simulate_advance() -> dict:
    """
    Advance the synthetic simulation by one tick, run the fusion orchestrator,
    and return the new raw state enriched with the freshly-computed risk scores
    and alerts (handy for live demo stepping).
    """
    raw = _plant().advance_tick()
    fusion = _orch().process(raw)
    out = _scale_state_zones(raw)
    out["risk_scores"] = fusion["risk_scores"]
    out["alerts"] = fusion["alerts"]
    return out


@app.post("/api/simulate/reset")
def simulate_reset() -> dict:
    """Reset the simulation to tick 0 (handy for re-running the demo)."""
    STATE.clear()
    STATE.update(_new_state())
    out = _scale_state_zones(_plant().get_current_state())
    out["risk_scores"] = _orch().get_current_scores()
    out["alerts"] = _orch().get_alerts()
    return out


# --- Contract endpoints (live, computed by the orchestrator) -------------

@app.get("/api/risk-scores")
def get_risk_scores() -> list[dict]:
    """
    Current compound risk score (0-100) per zone, with a timestamp.
    Shape: [{"zone_id": str, "risk_score": int, "timestamp": iso8601}, ...]
    """
    return _orch().get_current_scores()


@app.get("/api/risk-scores/history")
def get_risk_score_history(
    zone_id: Optional[str] = None,
    hours: Optional[float] = None,
) -> list[dict]:
    """
    Time series of risk scores for the timeline chart, accumulated across ticks.
    Optional filters: zone_id, hours (relative to the latest simulated time).
    Shape: [{"zone_id": str, "risk_score": int, "timestamp": iso8601}, ...]
    """
    return _orch().get_history(zone_id=zone_id, hours=hours)


@app.get("/api/alerts")
def get_alerts(threshold: Optional[int] = None) -> list[dict]:
    """
    Zones currently above the (configurable) alert threshold, each with the
    orchestrator's plain-English explanation and a placeholder regulatory
    citation (filled in during A5).
    Shape: [{
        "zone_id": str, "risk_score": int, "trigger_signals": [str, ...],
        "explanation": str,
        "regulatory_citation": {"clause": str, "source": str, "status": str},
        "timestamp": iso8601
    }, ...]
    """
    return _orch().get_alerts(threshold=threshold)


@app.get("/api/lead-time")
def get_lead_time() -> list[dict]:
    """
    Demo headline metric: per zone, how many ticks/minutes earlier the compound
    score crossed the alert threshold than the earliest single-sensor hard alarm.
    """
    return _orch().lead_time_summary()
