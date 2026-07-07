"""
Shared types for the domain agents.

Each domain agent (gas, permit, maintenance) is rule-based/statistical and
returns zero or more `Finding` objects. Findings are deliberately small and
JSON-friendly: the orchestrator/fusion agent (A4) consumes lists of these,
correlates them across agents, and only THEN calls the LLM for explanation.

No LLM calls happen in the domain agents - they must stay fast/cheap enough
to run every tick.
"""

from __future__ import annotations

from dataclasses import dataclass, field


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def slope_per_tick(values: list[float]) -> float:
    """
    Least-squares slope of a series against its index (ppm per tick).
    Returns 0.0 for < 2 points. No numpy dependency - keeps agents light.
    """
    n = len(values)
    if n < 2:
        return 0.0
    xbar = (n - 1) / 2.0
    ybar = sum(values) / n
    num = sum((i - xbar) * (v - ybar) for i, v in enumerate(values))
    den = sum((i - xbar) ** 2 for i in range(n))
    if den == 0:
        return 0.0
    return num / den


@dataclass
class Finding:
    """A single structured observation from one domain agent."""

    zone_id: str
    signal_type: str          # machine-readable category, e.g. "gas_trending_up"
    severity: float           # 0.0 (benign) .. 1.0 (critical) on its OWN
    description: str          # short plain-English summary
    agent: str = ""           # which agent produced this
    details: dict = field(default_factory=dict)  # machine-readable extras

    def __post_init__(self) -> None:
        self.severity = round(clamp(self.severity), 3)

    def to_dict(self) -> dict:
        return {
            "zone_id": self.zone_id,
            "signal_type": self.signal_type,
            "severity": self.severity,
            "description": self.description,
            "agent": self.agent,
            "details": self.details,
        }
