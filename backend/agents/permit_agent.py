"""
Permit domain agent.

Flags dangerous simultaneous operations from the active permits:
  1. A hot work permit with NO logged fire watch (a missing safeguard).
  2. Any permit active in a zone where the gas agent reports "trending up"
     or worse (a permit + elevated-gas conflict).

We return the specific permit IDs involved so the orchestrator can cite them
by ID in its explanation.

Rule-based only - no LLM.
"""

from __future__ import annotations

from .base import Finding, clamp
from .gas_agent import GAS_OVER_THRESHOLD, GAS_TRENDING_UP
from . import gas_agent


def _gas_status_by_zone(state: dict, gas_findings=None) -> dict[str, Finding]:
    """Build a zone_id -> gas Finding lookup, computing it if not supplied."""
    if gas_findings is None:
        gas_findings = gas_agent.analyze(state)
    return {f.zone_id: f for f in gas_findings}


def analyze(state: dict, gas_findings=None) -> list[Finding]:
    """
    Inspect active permits against current zone conditions.

    `gas_findings` (list[Finding] from gas_agent) is optional; if omitted we
    compute it, so this agent stays independently testable.
    """
    findings: list[Finding] = []
    gas_by_zone = _gas_status_by_zone(state, gas_findings)

    active_permits = [p for p in state.get("permits", []) if p.get("active")]

    for p in active_permits:
        zone_id = p["zone_id"]
        permit_id = p["permit_id"]
        ptype = p["type"]

        # 1) Hot work without a logged fire watch.
        if ptype == "hot_work" and not p.get("fire_watch_logged", False):
            findings.append(Finding(
                zone_id=zone_id,
                signal_type="permit_hot_work_no_fire_watch",
                severity=0.5,  # a compliance gap - notable, not yet critical alone
                description=(
                    f"Hot work permit {permit_id} is active with no fire "
                    f"watch logged."
                ),
                agent="permit_agent",
                details={"permit_ids": [permit_id], "permit_type": ptype},
            ))

        # 2) Permit active in a zone with rising / breached gas.
        gas = gas_by_zone.get(zone_id)
        if gas is not None and gas.signal_type in (GAS_TRENDING_UP, GAS_OVER_THRESHOLD):
            breached = gas.signal_type == GAS_OVER_THRESHOLD
            # Hot work in rising gas is the worst combination; weight it up.
            base = 0.55 if not breached else 0.8
            if ptype == "hot_work":
                base = clamp(base + 0.1)
            findings.append(Finding(
                zone_id=zone_id,
                signal_type="permit_gas_conflict",
                severity=base,
                description=(
                    f"{ptype.replace('_', ' ').title()} permit {permit_id} is "
                    f"active while gas in {zone_id} is "
                    f"{'over threshold' if breached else 'trending up'}."
                ),
                agent="permit_agent",
                details={
                    "permit_ids": [permit_id],
                    "permit_type": ptype,
                    "gas_signal": gas.signal_type,
                    "gas_ppm": gas.details.get("ppm"),
                    "trend_rate_ppm_per_tick": gas.details.get("trend_rate_ppm_per_tick"),
                },
            ))

    return findings
