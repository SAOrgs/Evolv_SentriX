"""
Gas/SCADA domain agent.

Given a zone's gas reading (with recent history), classify it as:
  - normal        : inside the safe band
  - trending_up   : rising meaningfully but still below the hard threshold
  - over_threshold: at/above the single-sensor hard alarm level

We return the TREND RATE (ppm/tick), not just a boolean, plus an estimate of
how many minutes remain before the reading would cross the hard threshold at
the current rate. That lead-time is what proves the fusion layer flags danger
earlier than a standalone gas alarm.

Rule-based/statistical only - no LLM.
"""

from __future__ import annotations

from data_sim.generator import MINUTES_PER_TICK

from .base import Finding, clamp, slope_per_tick

# Signal type constants (also used by the permit agent).
GAS_NORMAL = "gas_normal"
GAS_TRENDING_UP = "gas_trending_up"
GAS_OVER_THRESHOLD = "gas_over_threshold"

# A slope above this (ppm/tick), sustained, counts as "trending up".
TREND_SLOPE_MIN = 1.5


def analyze_reading(reading: dict) -> Finding:
    """
    Analyze a single zone's gas reading dict (from the generator state).
    Expected keys: zone_id, ppm, hard_threshold_ppm, lel_ppm, recent_history.
    """
    zone_id = reading["zone_id"]
    ppm = float(reading["ppm"])
    threshold = float(reading["hard_threshold_ppm"])
    lel = float(reading["lel_ppm"])
    history = list(reading.get("recent_history", [ppm]))

    slope = round(slope_per_tick(history[-5:]), 3)  # ppm/tick over recent window

    details = {
        "ppm": ppm,
        "hard_threshold_ppm": threshold,
        "lel_ppm": lel,
        "trend_rate_ppm_per_tick": slope,
        "minutes_per_tick": MINUTES_PER_TICK,
    }

    # --- over the hard threshold -----------------------------------------
    if ppm >= threshold:
        # severity 0.7..1.0 scaled from threshold toward the LEL
        frac = clamp((ppm - threshold) / max(1.0, (lel - threshold)))
        severity = 0.7 + 0.3 * frac
        details["minutes_to_threshold"] = 0
        return Finding(
            zone_id=zone_id,
            signal_type=GAS_OVER_THRESHOLD,
            severity=severity,
            description=(
                f"Gas at {ppm:.1f} ppm is at/above the {threshold:.0f} ppm "
                f"alarm threshold ({(ppm / lel * 100):.0f}% of LEL)."
            ),
            agent="gas_agent",
            details=details,
        )

    # --- trending up (still below threshold) -----------------------------
    if slope >= TREND_SLOPE_MIN:
        ticks_to_threshold = (threshold - ppm) / slope if slope > 0 else None
        minutes_to_threshold = (
            round(ticks_to_threshold * MINUTES_PER_TICK) if ticks_to_threshold else None
        )
        details["minutes_to_threshold"] = minutes_to_threshold
        # severity 0.3..0.6 by proximity to threshold - stays MODERATE so it
        # looks benign on its own until the orchestrator combines it.
        severity = 0.3 + 0.3 * clamp(ppm / threshold)
        return Finding(
            zone_id=zone_id,
            signal_type=GAS_TRENDING_UP,
            severity=severity,
            description=(
                f"Gas rising at ~{slope:.1f} ppm/tick, now {ppm:.1f} ppm; "
                f"~{minutes_to_threshold} min to the {threshold:.0f} ppm "
                f"threshold at this rate."
            ),
            agent="gas_agent",
            details=details,
        )

    # --- normal ----------------------------------------------------------
    severity = clamp(ppm / threshold * 0.3, 0.0, 0.15)
    details["minutes_to_threshold"] = None
    return Finding(
        zone_id=zone_id,
        signal_type=GAS_NORMAL,
        severity=severity,
        description=f"Gas at {ppm:.1f} ppm, within the normal band.",
        agent="gas_agent",
        details=details,
    )


def analyze(state: dict) -> list[Finding]:
    """Run the gas agent across every zone in the current state."""
    return [analyze_reading(r) for r in state.get("gas_readings", [])]
