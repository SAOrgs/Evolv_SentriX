"""
Tick-by-tick test harness for the three domain agents.

Runs all three agents against the A1 demo scenario and prints their findings
each tick. The point is to confirm that on their OWN, the individual signals
stay moderate ("benign-looking") until the compound condition should fire in
zone-3 - which is exactly what makes the fusion layer (A4) worth having.

Usage:
    python -m backend.agents.run_agents_test
    python -m backend.agents.run_agents_test --ticks 30 --verbose
"""

from __future__ import annotations

import argparse

from data_sim.generator import build_demo_scenario
from backend.agents import gas_agent, permit_agent, maintenance_agent

# Any single finding at/above this looks "critical" on its own.
CRITICAL_SOLO = 0.7


def max_sev(findings) -> float:
    return max((f.severity for f in findings), default=0.0)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ticks", type=int, default=30)
    ap.add_argument("--verbose", action="store_true",
                    help="Print every finding, not just the summary line.")
    args = ap.parse_args()

    plant = build_demo_scenario(seed=42)

    print("=" * 92)
    print("DOMAIN AGENTS vs demo scenario (SYNTHETIC). Focus zone: zone-3.")
    print("Individual severities should stay < 0.7 (benign-looking) until the")
    print("compound condition emerges; the orchestrator (A4) fuses them.")
    print("=" * 92)
    header = (
        f"{'tick':>4} | {'z3 gas: type / sev':<34} | "
        f"{'permit findings (max sev)':<30} | {'maint (max sev)':<16} | solo?"
    )
    print(header)
    print("-" * len(header))

    first_solo_critical = None
    first_permit_conflict = None

    for _ in range(args.ticks):
        state = plant.advance_tick()
        tick = state["tick"]

        gas_findings = gas_agent.analyze(state)
        permit_findings = permit_agent.analyze(state, gas_findings)
        maint_findings = maintenance_agent.analyze(state)

        g3 = next((f for f in gas_findings if f.zone_id == "zone-3"), None)
        g3_str = f"{g3.signal_type} / {g3.severity:.2f}" if g3 else "-"

        p_max = max_sev(permit_findings)
        p_types = ",".join(sorted({f.signal_type.replace('permit_', '')
                                   for f in permit_findings})) or "-"
        m_max = max_sev(maint_findings)

        all_findings = gas_findings + permit_findings + maint_findings
        solo = max_sev(all_findings)
        solo_flag = "CRIT" if solo >= CRITICAL_SOLO else ""

        if solo >= CRITICAL_SOLO and first_solo_critical is None:
            first_solo_critical = tick
        if any(f.signal_type == "permit_gas_conflict" for f in permit_findings) \
                and first_permit_conflict is None:
            first_permit_conflict = tick

        print(
            f"{tick:>4} | {g3_str:<34} | "
            f"{p_types + f' ({p_max:.2f})':<30} | "
            f"{f'{m_max:.2f}':<16} | {solo_flag}"
        )

        if args.verbose:
            for f in all_findings:
                print(f"        - [{f.agent}] {f.zone_id} {f.signal_type} "
                      f"sev={f.severity:.2f} :: {f.description}")

    print("-" * len(header))
    print(f"First permit+gas conflict detected at tick : {first_permit_conflict}")
    print(f"First single finding >= {CRITICAL_SOLO} severity at tick : {first_solo_critical}")
    print("\nRead-out: before the compound window, no single agent finding is")
    print("'critical' on its own - the danger only becomes obvious once the")
    print("permit + gas signals co-occur. That gap is the fusion value-prop.")


if __name__ == "__main__":
    main()
