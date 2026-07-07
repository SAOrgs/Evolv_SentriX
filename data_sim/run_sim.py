"""
Sanity-check runner for the synthetic data generator.

Runs the pre-built demo scenario for 30 ticks and prints a compact per-tick
summary focused on zone-3 (the scripted compound-risk zone), then dumps the
full final state as JSON.

Usage:
    python -m data_sim.run_sim
    python -m data_sim.run_sim --ticks 30 --seed 42 --full
"""

from __future__ import annotations

import argparse
import json

from data_sim.generator import build_demo_scenario


def zone3_gas(state: dict) -> dict:
    for g in state["gas_readings"]:
        if g["zone_id"] == "zone-3":
            return g
    return {}


def zone3_hot_work_active(state: dict) -> tuple[bool, bool]:
    """Return (hot_work_active, fire_watch_logged) for zone-3."""
    for p in state["permits"]:
        if p["zone_id"] == "zone-3" and p["type"] == "hot_work" and p["active"]:
            return True, p["fire_watch_logged"]
    return False, False


def compound_condition(state: dict) -> bool:
    """
    A lightweight preview of what the real fusion agent will detect:
    hot work active in zone-3 + gas trending up + no fire watch.
    (The actual scoring agent is built later; this is just for sanity-check.)
    """
    g = zone3_gas(state)
    hot_work, fire_watch = zone3_hot_work_active(state)
    return hot_work and (not fire_watch) and g.get("trending_up", False)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the synthetic data sim.")
    parser.add_argument("--ticks", type=int, default=30)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--full", action="store_true",
                        help="Dump full final state as JSON.")
    args = parser.parse_args()

    plant = build_demo_scenario(seed=args.seed)

    print("=" * 78)
    print("SYNTHETIC DATA - Compound Risk Intelligence Platform demo scenario")
    print("Zone-3 = 'Process Unit B' (scripted hot-work + gas-trend zone)")
    print("=" * 78)
    header = (
        f"{'tick':>4} | {'time':<5} | {'z3 ppm':>7} | {'thr?':>4} | "
        f"{'trend':>5} | {'hotwork':>7} | {'firewatch':>9} | flags"
    )
    print(header)
    print("-" * len(header))

    single_sensor_tick = None
    fusion_tick = None

    for _ in range(args.ticks):
        state = plant.advance_tick()
        g = zone3_gas(state)
        hot_work, fire_watch = zone3_hot_work_active(state)
        over_thr = g["over_hard_threshold"]
        trending = g["trending_up"]
        compound = compound_condition(state)

        if over_thr and single_sensor_tick is None:
            single_sensor_tick = state["tick"]
        if compound and fusion_tick is None:
            fusion_tick = state["tick"]

        flags = []
        if compound:
            flags.append("COMPOUND-RISK")
        if over_thr:
            flags.append("GAS>THRESHOLD")
        if any(t["overdue"] for t in state["maintenance_tasks"]):
            flags.append("overdue-maint")
        if any(s["long_shift"] for s in state["shifts"]):
            flags.append("long-shift")

        hhmm = state["timestamp"][11:16]
        print(
            f"{state['tick']:>4} | {hhmm:<5} | {g['ppm']:>7.2f} | "
            f"{'Y' if over_thr else '-':>4} | {'Y' if trending else '-':>5} | "
            f"{'Y' if hot_work else '-':>7} | "
            f"{'Y' if fire_watch else ('N' if hot_work else '-'):>9} | "
            f"{', '.join(flags)}"
        )

    print("-" * len(header))
    print(f"Fusion (compound) condition first true at tick : {fusion_tick}")
    print(f"Single-sensor gas alarm (>= threshold) at tick : {single_sensor_tick}")
    if fusion_tick and single_sensor_tick:
        print(f"=> Fusion leads single-sensor by {single_sensor_tick - fusion_tick} ticks "
              f"({(single_sensor_tick - fusion_tick) * 15} simulated minutes).")

    if args.full:
        print("\n" + "=" * 78)
        print("FULL FINAL STATE (JSON):")
        print("=" * 78)
        print(json.dumps(plant.get_current_state(), indent=2))


if __name__ == "__main__":
    main()
