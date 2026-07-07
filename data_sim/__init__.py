"""
data_sim - Synthetic data generator for the Compound Risk Intelligence Platform.

All data produced by this package is 100% synthetic. We have no access to real
plant sensor feeds, permit systems, or maintenance records, so we generate
realistic-looking streams ourselves in order to demonstrate the fusion logic.
Nothing here is validated against a real industrial site.
"""

from .generator import (
    SyntheticPlant,
    GasConfig,
    build_demo_scenario,
    MINUTES_PER_TICK,
    SIM_START,
)

__all__ = [
    "SyntheticPlant",
    "GasConfig",
    "build_demo_scenario",
    "MINUTES_PER_TICK",
    "SIM_START",
]
