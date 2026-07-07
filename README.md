# Evolv_SentriX
An AI-driven Industrial Safety Intelligence Platform that integrates multi-source industrial data to predict safety hazards, assess compound risks, generate explainable alerts, and assist in proactive incident prevention.

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
