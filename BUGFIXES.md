# Bug Fixes - SentriX Platform

This document tracks all identified bugs and their resolutions.

---

## ⭐ Bug #1: Emergency Threshold Incorrect (CRITICAL - FIXED)

### Problem
The emergency trigger endpoint was using `ALERT_THRESHOLD` (60) as the default instead of `EMERGENCY_THRESHOLD` (85).

```python
# BEFORE (WRONG)
thr = ALERT_THRESHOLD if threshold is None else threshold
```

This meant emergency mode could trigger at the same threshold as normal alerts, defeating the purpose of having a separate emergency threshold.

### Fix
```python
# AFTER (CORRECT)
thr = EMERGENCY_THRESHOLD if threshold is None else threshold
```

**Location:** `backend/main.py`, `trigger_emergency()` function

**Impact:** Emergency responses now only trigger at risk score >= 85 as intended.

---

## Bug #2: Global Shared State (DOCUMENTED)

### Problem
The application stores simulation state in a single global object:

```python
STATE: dict = _new_state()
```

This means:
- All users share the same simulation
- One user's `reset()` resets everyone's state
- Concurrent `advance()` calls can interfere with each other

### Resolution
**For hackathon demo:** Acceptable - single-user presentation environment.

**For production:** Implement session-based isolation:

```python
# Production approach - per-session state
from starlette.middleware.sessions import SessionMiddleware

# Store state in Redis with session key
def _get_state(session_id: str):
    key = f"sentrix:session:{session_id}"
    return redis.get(key) or _new_state()
```

**Location:** `backend/main.py`, module-level `STATE` variable

**Status:** Documented with inline comments. Production refactoring required.

---

## Bug #3: Risk History Lost on Restart (DOCUMENTED)

### Problem
All history is stored in memory:
- `orchestrator.history` (risk scores)
- `orchestrator.compound_cross_tick` (lead-time tracking)
- Explanation cache

When backend restarts, all accumulated data is lost.

### Resolution
**For hackathon demo:** Acceptable - no restart expected during presentation.

**For production:** Add persistence layer:

```python
# Option 1: SQLite (simple, local)
import sqlite3

def persist_history(zone_id, tick, score, timestamp):
    conn = sqlite3.connect("sentrix_history.db")
    conn.execute(
        "INSERT INTO risk_history VALUES (?, ?, ?, ?)",
        (zone_id, tick, score, timestamp)
    )
    conn.commit()

# Option 2: PostgreSQL/TimescaleDB (production scale)
# Option 3: Redis (distributed, pub/sub-capable)
```

**Location:** `backend/agents/orchestrator.py`, `Orchestrator` class

**Status:** Documented with inline comments. Production persistence layer required.

---

## Bug #4: Frontend Sync Issues (FIXED)

### Problem
Frontend polls different endpoints independently:

```javascript
// These could arrive at slightly different times
await fetch('/api/simulate/advance')
await fetch('/api/alerts')
await fetch('/api/risk-scores')
```

Result: Dashboard might briefly show mismatched data (updated timeline, stale alerts).

### Fix
**Solution 1:** New unified state endpoint:

```python
@app.get("/api/simulate/state")
def get_simulation_state() -> dict:
    """Get complete current state without advancing."""
    return {
        "tick": plant.tick,
        "timestamp": ...,
        "zones": ...,
        "risk_scores": ...,
        "alerts": ...,
        "gas_readings": ...,
        "permits": ...,
    }
```

Frontend can now fetch everything in one atomic call.

**Solution 2:** Stable alert IDs:

```python
# OLD: alert_id changes with score
"alert_id": f"ALERT-{zid}-{score}"

# NEW: stable ID based on first alert tick
"alert_id": f"ALERT-{zid}-T{first_alert_tick}"
```

Frontend can now track alerts across polls without false "new alert" detections.

**Location:** `backend/main.py` (new endpoint), `backend/agents/orchestrator.py` (stable IDs)

**Impact:** Frontend can poll `/api/simulate/state` for atomic snapshots. Alerts have stable tracking IDs.

---

## Bug #5: Stale Cached Explanations (FIXED)

### Problem
Explanation cache key was:

```python
sig = (zone_id, tuple(signal_types))
```

If gas ppm changed from 58 → 72 but signal types stayed the same (`gas_over_threshold`), the cached explanation still mentioned the old 58 ppm value.

### Fix

Added gas ppm bucket to cache key:

```python
# Extract gas ppm and bucket into 10-ppm ranges
gas_ppm = extract_gas_ppm(risk.findings)
gas_bucket = int(gas_ppm / 10) * 10 if gas_ppm else None

sig = (zone_id, tuple(signal_types), gas_bucket)
```

Now explanations regenerate when gas crosses 10-ppm boundaries:
- 58 ppm → bucket 50
- 72 ppm → bucket 70 (cache miss, regenerates)

**Location:** `backend/agents/orchestrator.py`, `_explain_cached()` method

**Impact:** Explanations stay current with significant numeric changes while still benefiting from caching.

---

## Bug #6: Missing Validation on Simulation Input (FIXED)

### Problem
No validation on `/api/simulate/advance` parameters:

```python
# User could POST with invalid values
POST /api/simulate/advance?steps=-5
POST /api/simulate/advance?steps=999999
```

Could cause:
- Negative tick advancement (undefined behavior)
- Excessive computation (999999 ticks)
- Tick overflow (tick > MAX_INT)

### Fix
Added query parameter validation:

```python
@app.post("/api/simulate/advance")
def simulate_advance(
    steps: int = Query(
        1,
        ge=1,        # >= 1
        le=100,      # <= 100
        description="Number of ticks to advance (1-100)"
    )
):
    # Additional safety check
    if current_tick > 10000:
        raise HTTPException(400, "Simulation too far advanced")
```

**Location:** `backend/main.py`, `simulate_advance()` endpoint

**Impact:** 
- Steps must be 1-100
- Total tick count capped at 10,000
- Returns 400 Bad Request for invalid inputs

---

## Testing the Fixes

### Test Emergency Threshold (Bug #1)
```bash
# Advance to tick 15 (score = 83, below 85)

for i in $(seq 1 15); do curl -s -X POST http://localhost:8000/api/simulate/advance > /dev/null; done

# Should return 400 (below emergency threshold)
curl -X POST "http://localhost:8000/api/emergency/trigger?zone_id=zone-3"

# Advance to tick 18 (score = 100, above 85)
for i in $(seq 1 3); do curl -s -X POST http://localhost:8000/api/simulate/advance > /dev/null; done

# Should return 200 (emergency triggered)
curl -X POST "http://localhost:8000/api/emergency/trigger?zone_id=zone-3"
```

**Expected:** First call returns 400, second call returns 200 with incident report.

### Test Frontend Sync (Bug #4)
```bash
# Get complete atomic state
curl -s http://localhost:8000/api/simulate/state | python3 -m json.tool

# Verify alert IDs are stable across multiple calls
curl -s http://localhost:8000/api/alerts | jq '.[].alert_id'
curl -s -X POST http://localhost:8000/api/simulate/advance > /dev/null
curl -s http://localhost:8000/api/alerts | jq '.[].alert_id'

# Alert ID should stay the same (ALERT-zone-3-T13)
```

**Expected:** Same alert ID across polls when alert persists.

### Test Explanation Updates (Bug #5)
```bash
# Watch explanation update as gas ppm increases
for tick in {13..20}; do
  curl -s -X POST http://localhost:8000/api/simulate/advance > /dev/null
  EXPL=$(curl -s http://localhost:8000/api/alerts | jq -r '.[0].explanation')
  echo "Tick $tick: $EXPL"
done
```

**Expected:** Explanation mentions updated ppm values (not stuck at initial value).

### Test Input Validation (Bug #6)
```bash
# Should fail - negative steps
curl -X POST "http://localhost:8000/api/simulate/advance?steps=-5"
# Expected: 422 validation error

# Should fail - too many steps
curl -X POST "http://localhost:8000/api/simulate/advance?steps=500"
# Expected: 422 validation error

# Should succeed - valid range
curl -X POST "http://localhost:8000/api/simulate/advance?steps=5"
# Expected: 200 OK
```

---

## Summary

| Bug # | Severity | Status | Fix Type |
|-------|----------|--------|----------|
| #1 | **CRITICAL** | ✅ Fixed | Code change |
| #2 | Medium | 📝 Documented | Architecture note |
| #3 | Low | 📝 Documented | Production TODO |
| #4 | Medium | ✅ Fixed | New endpoint + stable IDs |
| #5 | Medium | ✅ Fixed | Improved cache key |
| #6 | Medium | ✅ Fixed | Input validation |

**Hackathon Impact:** Bugs #1, #4, #5, #6 are fully resolved. Bugs #2 and #3 are acceptable for single-user demo; documented for production.

**Production Readiness Checklist:**
- [ ] Implement session-based state isolation (Bug #2)
- [ ] Add persistent storage for history (Bug #3)
- [ ] Add authentication & authorization
- [ ] Add rate limiting
- [ ] Add comprehensive logging & monitoring
- [ ] Add backup & recovery procedures
- [ ] Load testing for concurrent users
- [ ] Security audit (SQLi, XSS, CSRF protection)

---

**Last Updated:** January 2025  
**Tested Against:** Python 3.11+, FastAPI 0.115.6, Claude Sonnet 4
