"""
Maintenance / shift domain agent.

Flags:
  1. Overdue maintenance tasks (not completed, past their due time).
  2. Shift patterns exceeding a configurable consecutive-hours threshold,
     as a fatigue-risk proxy.

Rule-based only - no LLM.
"""

from __future__ import annotations

from datetime import datetime

from .base import Finding, clamp

# Default fatigue threshold (hours on a single continuous shift).
DEFAULT_FATIGUE_HOURS = 12.0


def _parse(ts: str) -> datetime:
    return datetime.fromisoformat(ts)


def analyze(state: dict, fatigue_hours: float = DEFAULT_FATIGUE_HOURS) -> list[Finding]:
    """Flag overdue maintenance and long/fatigue-risk shifts."""
    findings: list[Finding] = []
    now = _parse(state["timestamp"])

    # 1) Overdue maintenance tasks.
    for t in state.get("maintenance_tasks", []):
        if t.get("completed"):
            continue
        due = _parse(t["due_time"])
        if now <= due:
            continue
        hours_overdue = (now - due).total_seconds() / 3600.0
        # severity 0.3..0.7, scaled by how far past due (saturates ~48h).
        severity = 0.3 + 0.4 * clamp(hours_overdue / 48.0)
        findings.append(Finding(
            zone_id=t["zone_id"],
            signal_type="maintenance_overdue",
            severity=severity,
            description=(
                f"Maintenance task {t['task_id']} ('{t['description']}') is "
                f"overdue by {hours_overdue:.1f} h."
            ),
            agent="maintenance_agent",
            details={
                "task_id": t["task_id"],
                "hours_overdue": round(hours_overdue, 1),
                "description": t["description"],
            },
        ))

    # 2) Long consecutive shifts (fatigue proxy).
    for s in state.get("shifts", []):
        if not s.get("active"):
            continue
        hours = float(s.get("hours_on_shift", 0.0))
        if hours < fatigue_hours:
            continue
        over = hours - fatigue_hours
        # severity 0.4..0.8, scaled by hours beyond the threshold (saturates +6h).
        severity = 0.4 + 0.4 * clamp(over / 6.0)
        findings.append(Finding(
            zone_id=s["zone_id"],
            signal_type="shift_fatigue_risk",
            severity=severity,
            description=(
                f"Worker {s['worker_id']} has been on shift {hours:.1f} h "
                f"(> {fatigue_hours:.0f} h fatigue threshold)."
            ),
            agent="maintenance_agent",
            details={
                "shift_id": s["shift_id"],
                "worker_id": s["worker_id"],
                "hours_on_shift": hours,
                "fatigue_threshold_hours": fatigue_hours,
            },
        ))

    return findings
