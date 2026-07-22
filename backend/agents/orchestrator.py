"""
Orchestrator / fusion agent - the core differentiator.

It fuses the three domain agents' findings PER ZONE into a single 0-100
compound risk score, then (only for zones that breach the alert threshold)
asks Claude for a short, safety-officer-grade explanation of WHY.

Two passes:
  Pass 1 (rule-based, no LLM, runs every tick):
     A weighted function of the individual severities PLUS an explicit
     co-occurrence bonus. The whole point: when individually-benign signals
     co-occur in a zone (e.g. hot-work-without-fire-watch + gas trending up),
     the score jumps sharply and crosses the alert threshold BEFORE any single
     sensor would have crossed its own hard threshold.

  Pass 2 (LLM, only for alerting zones, cached):
     Calls Claude (claude-sonnet-4-6) with the structured findings and asks
     for a concise plain-English explanation citing the specific permit ID,
     gas trend, and any maintenance/shift factor. Falls back to a strong
     deterministic template when no ANTHROPIC_API_KEY is set or the call
     fails, so the platform always works offline (e.g. during rehearsal).

Lead-time metric:
     We log/track how many ticks (minutes) earlier the compound score crossed
     the alert threshold than the earliest single-sensor hard-threshold breach
     (a standalone gas detector alarm). That is the headline demo number.
"""

from __future__ import annotations

import json
import logging
import os
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional

from data_sim.generator import MINUTES_PER_TICK

from .base import Finding, clamp
from . import gas_agent, permit_agent, maintenance_agent
from .gas_agent import GAS_TRENDING_UP, GAS_OVER_THRESHOLD

logger = logging.getLogger("sentrix.orchestrator")

# --- Tunables -------------------------------------------------------------
ALERT_THRESHOLD = 60          # compound score above this raises an alert
CO_FLOOR = 0.30               # a finding counts as a "meaningful" category above this
CLAUDE_MODEL = "claude-sonnet-4-6"

# The single-sensor baseline for the lead-time metric: signal types that a
# traditional standalone sensor system would itself hard-alarm on. (A permit+gas
# CONFLICT is a correlation, not a single sensor, so it is deliberately excluded.)
SINGLE_SENSOR_HARD = {GAS_OVER_THRESHOLD}


# --- Result container -----------------------------------------------------
@dataclass
class ZoneRisk:
    zone_id: str
    score: int                       # 0-100 compound risk
    timestamp: str
    tick: int
    trigger_signals: list[str] = field(default_factory=list)  # plain-English
    co_occurrence: bool = False
    findings: list[dict] = field(default_factory=list)        # raw finding dicts
    breakdown: dict = field(default_factory=dict)             # scoring internals

    def to_score_dict(self) -> dict:
        return {
            "zone_id": self.zone_id,
            "risk_score": self.score,
            "timestamp": self.timestamp,
        }


# ====================================================================== #
# Pass 1: rule-based compound scoring
# ====================================================================== #
def score_zone(
    zone_id: str,
    gas_findings: list[Finding],
    permit_findings: list[Finding],
    maint_findings: list[Finding],
    timestamp: str = "",
    tick: int = 0,
) -> ZoneRisk:
    """
    Compute the 0-100 compound risk score for one zone from its findings.
    Pure/rule-based - safe to call every tick. Defensively filters by zone_id.
    """
    gas = [f for f in gas_findings if f.zone_id == zone_id]
    permits = [f for f in permit_findings if f.zone_id == zone_id]
    maint = [f for f in maint_findings if f.zone_id == zone_id]

    gas_f = gas[0] if gas else None
    gas_sev = gas_f.severity if gas_f else 0.0
    gas_meaningful = gas_f is not None and gas_f.signal_type in (
        GAS_TRENDING_UP, GAS_OVER_THRESHOLD
    )
    gas_breach = gas_f is not None and gas_f.signal_type == GAS_OVER_THRESHOLD

    permit_sev = max((f.severity for f in permits), default=0.0)
    permit_meaningful = len(permits) > 0
    hot_no_fw = any(
        f.signal_type == "permit_hot_work_no_fire_watch" for f in permits
    )

    maint_sev = max((f.severity for f in maint), default=0.0)
    maint_meaningful = maint_sev >= CO_FLOOR

    # --- weighted base from the individual severities --------------------
    sevs = sorted([gas_sev, permit_sev, maint_sev], reverse=True)
    s1, s2, s3 = sevs
    base = s1 * 55.0            # dominant signal
    secondary = s2 * 15.0 + s3 * 6.0

    # --- co-occurrence bonus (generic) -----------------------------------
    meaningful_count = sum([gas_meaningful, permit_meaningful, maint_meaningful])
    co_bonus = 0.0
    if meaningful_count >= 2:
        co_bonus += 8.0
    if meaningful_count >= 3:
        co_bonus += 5.0

    # --- explicit dangerous-combination synergy --------------------------
    # This is the rule that makes the score spike sharply for the exact
    # compound situation we care about, before any single hard threshold.
    synergy = 0.0
    synergy_reason = None
    if hot_no_fw and gas_meaningful:
        synergy += 25.0
        synergy_reason = (
            "hot work permit without fire watch co-occurring with "
            f"{'gas over threshold' if gas_breach else 'rising gas'}"
        )
    elif permit_meaningful and gas_meaningful:
        synergy += 15.0
        synergy_reason = "active permit co-occurring with elevated gas"

    score = int(round(clamp(base + secondary + co_bonus + synergy, 0.0, 100.0)))

    # --- assemble trigger signals (plain-English) ------------------------
    all_findings = gas + permits + maint
    # Sort by severity so the most important trigger reads first.
    all_findings_sorted = sorted(all_findings, key=lambda f: f.severity, reverse=True)
    trigger_signals = [
        f.description for f in all_findings_sorted
        if f.signal_type != "gas_normal"
    ]

    return ZoneRisk(
        zone_id=zone_id,
        score=score,
        timestamp=timestamp,
        tick=tick,
        trigger_signals=trigger_signals,
        co_occurrence=meaningful_count >= 2,
        findings=[f.to_dict() for f in all_findings],
        breakdown={
            "base": round(base, 1),
            "secondary": round(secondary, 1),
            "co_bonus": round(co_bonus, 1),
            "synergy": round(synergy, 1),
            "synergy_reason": synergy_reason,
            "meaningful_count": meaningful_count,
            "gas_meaningful": gas_meaningful,
            "gas_breach": gas_breach,
            "hot_work_no_fire_watch": hot_no_fw,
        },
    )


# ====================================================================== #
# Pass 2: LLM explanation (with offline fallback)
# ====================================================================== #
_SYSTEM_PROMPT = (
    "You are a process-safety officer at an industrial plant. You receive "
    "structured findings from three monitoring agents (gas sensors, "
    "permit-to-work, and maintenance/shift records) for one plant zone, plus a "
    "computed 0-100 compound risk score. Explain in 2-3 sentences WHY the score "
    "is what it is, for a control-room operator. Reference the specific permit "
    "ID, the gas trend/rate, and any maintenance or shift factor that applies. "
    "Emphasise when individually-normal signals combine into a real hazard. Be "
    "concrete and actionable; no generic filler, no preamble. All data is "
    "synthetic; do not add disclaimers."
)


def _call_claude(user_payload: str) -> Optional[str]:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return None
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        msg = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=300,
            system=_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_payload}],
        )
        text = "".join(
            block.text for block in msg.content
            if getattr(block, "type", None) == "text"
        ).strip()
        return text or None
    except Exception as exc:  # network/import/auth - degrade gracefully
        logger.warning("Claude explanation failed (%s); using fallback.", exc)
        return None


def _fallback_explanation(zone_name: str, risk: ZoneRisk) -> str:
    """Deterministic, specific explanation used when the LLM is unavailable."""
    parts: list[str] = []
    for fd in risk.findings:
        st = fd["signal_type"]
        d = fd.get("details", {})
        if st == "permit_hot_work_no_fire_watch":
            pid = (d.get("permit_ids") or ["?"])[0]
            parts.append(f"hot work permit {pid} is active with no fire watch logged")
        elif st == "permit_gas_conflict":
            pid = (d.get("permit_ids") or ["?"])[0]
            parts.append(f"permit {pid} overlaps rising gas in the same zone")
        elif st == GAS_TRENDING_UP:
            rate = d.get("trend_rate_ppm_per_tick")
            ppm = d.get("ppm")
            mins = d.get("minutes_to_threshold")
            parts.append(
                f"gas is climbing (~{rate} ppm/tick, now {ppm} ppm, ~{mins} min "
                f"to the {d.get('hard_threshold_ppm')} ppm alarm)"
            )
        elif st == GAS_OVER_THRESHOLD:
            ppm = d.get("ppm")
            parts.append(f"gas has crossed the alarm threshold at {ppm} ppm")
        elif st == "maintenance_overdue":
            parts.append(
                f"maintenance {d.get('task_id')} is overdue by "
                f"{d.get('hours_overdue')} h"
            )
        elif st == "shift_fatigue_risk":
            parts.append(
                f"worker {d.get('worker_id')} is {d.get('hours_on_shift')} h into a "
                f"shift (fatigue risk)"
            )

    if not parts:
        return (
            f"{zone_name}: compound risk {risk.score}/100. No individual signal "
            f"is currently elevated."
        )

    joined = "; ".join(parts)
    synergy = risk.breakdown.get("synergy_reason")
    lead = ""
    if synergy:
        lead = (
            " Individually these stay below alarm level, but together "
            f"({synergy}) they indicate a credible hazard that a single-sensor "
            "system would not yet flag."
        )
    return (
        f"{zone_name}: compound risk {risk.score}/100. Contributing factors: "
        f"{joined}.{lead}"
    )


def generate_explanation(zone_name: str, risk: ZoneRisk) -> str:
    """Try Claude; fall back to the deterministic template."""
    payload = json.dumps({
        "zone_id": risk.zone_id,
        "zone_name": zone_name,
        "compound_risk_score": risk.score,
        "alert_threshold": ALERT_THRESHOLD,
        "co_occurrence": risk.co_occurrence,
        "findings": risk.findings,
        "scoring_breakdown": risk.breakdown,
    }, indent=2)
    llm = _call_claude(
        payload + "\n\nWrite the explanation now (2-3 sentences)."
    )
    return llm if llm else _fallback_explanation(zone_name, risk)


# RAG-based regulatory citation (lazy import to avoid heavyweight deps until needed).
def _rag_citation(explanation: str) -> dict:
    """Retrieve + synthesize a grounded citation via the RAG module."""
    try:
        from backend.rag import generate_citation
        result = generate_citation(explanation, top_k=5)
        # Flatten for the alert payload (drop retrieved_docs to keep it light).
        return {
            "clause": result["clause"],
            "source": result["source"],
            "status": result["status"],
        }
    except Exception as exc:
        logger.warning("RAG citation failed (%s); using placeholder.", exc)
        return {
            "clause": "Regulatory citation temporarily unavailable.",
            "source": "N/A",
            "status": "error",
        }


# ====================================================================== #
# Orchestrator engine: drives per-tick fusion + history + alerts
# ====================================================================== #
class Orchestrator:
    def __init__(self, alert_threshold: int = ALERT_THRESHOLD):
        self.alert_threshold = alert_threshold
        # zone_id -> list[{tick, timestamp, score}]
        self.history: dict[str, list[dict]] = defaultdict(list)
        # zone_id -> ZoneRisk (latest)
        self.current: dict[str, ZoneRisk] = {}
        # zone_id -> explanation string (latest, for alerting zones)
        self._explanations: dict[str, str] = {}
        # explanation cache keyed by (zone_id, signal-type signature)
        self._expl_cache: dict[tuple, str] = {}
        self.zone_names: dict[str, str] = {}

        # lead-time tracking (per zone), in ticks
        self.compound_cross_tick: dict[str, int] = {}
        self.single_sensor_cross_tick: dict[str, int] = {}

    # ------------------------------------------------------------------ #
    def process(self, state: dict) -> dict:
        """Run all three agents, fuse per zone, update history/alerts."""
        tick = state["tick"]
        timestamp = state["timestamp"]
        self.zone_names = {z["zone_id"]: z["name"] for z in state.get("zones", [])}

        gas_findings = gas_agent.analyze(state)
        permit_findings = permit_agent.analyze(state, gas_findings)
        maint_findings = maintenance_agent.analyze(state)

        for z in state.get("zones", []):
            zid = z["zone_id"]
            risk = score_zone(
                zid, gas_findings, permit_findings, maint_findings,
                timestamp=timestamp, tick=tick,
            )
            self.current[zid] = risk
            self.history[zid].append(
                {"tick": tick, "timestamp": timestamp, "score": risk.score}
            )

            # lead-time bookkeeping
            if zid not in self.compound_cross_tick and risk.score >= self.alert_threshold:
                self.compound_cross_tick[zid] = tick
            if zid not in self.single_sensor_cross_tick and risk.breakdown.get("gas_breach"):
                self.single_sensor_cross_tick[zid] = tick

            # explanation (only for alerting zones; cached by signal signature)
            if risk.score >= self.alert_threshold:
                self._explanations[zid] = self._explain_cached(zid, risk)
                self._log_lead_time(zid, tick)

        return {
            "tick": tick,
            "timestamp": timestamp,
            "risk_scores": self.get_current_scores(),
            "alerts": self.get_alerts(),
        }

    # ------------------------------------------------------------------ #
    def _explain_cached(self, zid: str, risk: ZoneRisk) -> str:
        sig = (zid, tuple(sorted({f["signal_type"] for f in risk.findings})))
        if sig not in self._expl_cache:
            self._expl_cache[sig] = generate_explanation(
                self.zone_names.get(zid, zid), risk
            )
        return self._expl_cache[sig]

    def _log_lead_time(self, zid: str, tick: int) -> None:
        c = self.compound_cross_tick.get(zid)
        s = self.single_sensor_cross_tick.get(zid)
        if c is None:
            return
        if s is None:
            # single sensor hasn't hard-alarmed yet: lead time still growing
            lead_ticks = tick - c
            logger.info(
                "[lead-time] %s: compound alerted at tick %d; no single-sensor "
                "hard alarm yet (+%d ticks / %d min ahead so far).",
                zid, c, lead_ticks, lead_ticks * MINUTES_PER_TICK,
            )
        elif s > c:
            lead_ticks = s - c
            logger.info(
                "[lead-time] %s: compound alerted at tick %d, single-sensor hard "
                "alarm at tick %d -> flagged %d ticks (%d min) earlier.",
                zid, c, s, lead_ticks, lead_ticks * MINUTES_PER_TICK,
            )

    # ------------------------------------------------------------------ #
    # Read APIs (consumed by main.py)
    # ------------------------------------------------------------------ #
    def get_current_scores(self) -> list[dict]:
        return [self.current[zid].to_score_dict() for zid in sorted(self.current)]

    def get_history(self, zone_id: Optional[str] = None,
                    hours: Optional[float] = None) -> list[dict]:
        zones = [zone_id] if zone_id else sorted(self.history)
        cutoff = None
        if hours is not None and self.current:
            # cutoff relative to the latest simulated timestamp
            latest = max(
                (datetime.fromisoformat(r.timestamp) for r in self.current.values()),
                default=None,
            )
            if latest is not None:
                cutoff = latest - timedelta(hours=hours)

        out: list[dict] = []
        for zid in zones:
            for pt in self.history.get(zid, []):
                if cutoff is not None and datetime.fromisoformat(pt["timestamp"]) < cutoff:
                    continue
                out.append({
                    "zone_id": zid,
                    "risk_score": pt["score"],
                    "timestamp": pt["timestamp"],
                })
        return out

    def get_alerts(self, threshold: Optional[int] = None) -> list[dict]:
        thr = self.alert_threshold if threshold is None else threshold
        alerts: list[dict] = []
        for zid, risk in self.current.items():
            if risk.score < thr:
                continue
            explanation = self._explanations.get(
                zid, _fallback_explanation(self.zone_names.get(zid, zid), risk)
            )
            alerts.append({
                "alert_id": f"ALERT-{zid}-{risk.score}",
                "zone_id": zid,
                "risk_score": risk.score,
                "trigger_signals": risk.trigger_signals,
                "explanation": explanation,
                "regulatory_citation": _rag_citation(explanation),
                "timestamp": risk.timestamp,
            })
        # highest risk first
        alerts.sort(key=lambda a: a["risk_score"], reverse=True)
        return alerts

    def lead_time_summary(self) -> list[dict]:
        """Per-zone lead-time metric for the demo headline."""
        out = []
        for zid in sorted(self.compound_cross_tick):
            c = self.compound_cross_tick[zid]
            s = self.single_sensor_cross_tick.get(zid)
            lead_ticks = (s - c) if (s is not None and s > c) else None
            out.append({
                "zone_id": zid,
                "compound_alert_tick": c,
                "single_sensor_hard_alarm_tick": s,
                "lead_time_ticks": lead_ticks,
                "lead_time_minutes": (lead_ticks * MINUTES_PER_TICK
                                      if lead_ticks is not None else None),
            })
        return out
