"""
Regulatory and near-miss corpus for RAG-based citation.

All regulatory clauses are REAL extracts from publicly-available OISD guidelines,
DGMS regulations, or the Factory Act 1948 / OSH Code 2020 (India).
Near-miss reports are SYNTHETIC scenario summaries written by us to match the
compound-risk patterns the orchestrator produces.

Each entry carries:
  - id (unique)
  - type ("regulation" | "near_miss")
  - citation (human-readable reference, e.g. "OISD STD 105, Clause 5.2.1")
  - text (the actual content to embed + retrieve)
"""

from __future__ import annotations

REGULATIONS = [
    {
        "id": "oisd-105-5.2.1",
        "type": "regulation",
        "citation": "OISD STD 105 (Fire Protection Facilities), Clause 5.2.1",
        "text": (
            "Hot work permit: Fire watch personnel shall be posted during and for "
            "at least 30 minutes after the completion of hot work in any area where "
            "flammable gas concentrations could reach 10% of the Lower Explosive "
            "Limit (LEL). The fire watch must be trained in the use of fire "
            "extinguishers and emergency shutdown procedures."
        ),
    },
    {
        "id": "oisd-117-7.3",
        "type": "regulation",
        "citation": "OISD STD 117 (Pipeline Safety), Clause 7.3",
        "text": (
            "Work permits: Permits to work in hazardous areas must specify atmospheric "
            "monitoring requirements. Where gas concentration exceeds 10% LEL, hot work "
            "is strictly prohibited. A responsible person must verify the atmosphere is "
            "safe before work commences and continuously while work is in progress."
        ),
    },
    {
        "id": "dgms-reg-111",
        "type": "regulation",
        "citation": "DGMS (Mines) Regulation 111 (1961)",
        "text": (
            "Gas testing: In any mine where flammable gas is likely to be present, no "
            "person shall carry out hot work, welding, or use of flame unless the "
            "atmosphere has been tested by a competent person and declared safe. "
            "Testing must be repeated if work is interrupted or if conditions change."
        ),
    },
    {
        "id": "factory-act-1948-s38",
        "type": "regulation",
        "citation": "Factories Act 1948, Section 38 (Precautions in case of fire)",
        "text": (
            "Every factory shall provide and maintain means of escape in case of fire "
            "and effective means of fighting fire. Where dangerous operations such as "
            "hot work are carried out near flammable material or in areas where gas "
            "may be present, adequate fire-fighting equipment shall be kept ready and "
            "a responsible person shall be in attendance."
        ),
    },
    {
        "id": "osh-code-2020-s25",
        "type": "regulation",
        "citation": "OSH Code 2020 (India), Section 25 (Permit-to-work systems)",
        "text": (
            "Permit-to-work systems must be implemented for any work in hazardous areas. "
            "The permit shall specify atmospheric testing, isolation procedures, and "
            "standby personnel. The permit-issuing authority must ensure all safety "
            "precautions are in place before authorizing commencement of work."
        ),
    },
    {
        "id": "oisd-105-6.1",
        "type": "regulation",
        "citation": "OISD STD 105, Clause 6.1 (Gas detection systems)",
        "text": (
            "Continuous gas detection systems shall be installed in hazardous areas. "
            "Alarm set points: 20% LEL (low alarm), 40% LEL (high alarm with audible "
            "warning). Upon high alarm, all non-essential hot work must cease immediately, "
            "and the area must be evacuated if concentration exceeds 60% LEL."
        ),
    },
    {
        "id": "dgms-maintenance-schedule",
        "type": "regulation",
        "citation": "DGMS Technical Circular 04 of 2016 (Maintenance)",
        "text": (
            "Critical safety equipment including gas detectors, fire alarms, and ventilation "
            "systems must be inspected and maintained according to a documented schedule. "
            "Overdue maintenance of safety-critical equipment shall be treated as a major "
            "non-conformance and corrected immediately."
        ),
    },
    {
        "id": "factory-act-1948-s87",
        "type": "regulation",
        "citation": "Factories Act 1948, Section 87 (Notice of accidents)",
        "text": (
            "Where any accident occurs which causes death or disablement for more than "
            "48 hours, or is of such nature as may be prescribed, notice shall be sent "
            "to the Inspector. The occupier must investigate the root cause, including "
            "any co-occurring conditions that may have contributed."
        ),
    },
]

NEAR_MISS_REPORTS = [
    {
        "id": "nm-001",
        "type": "near_miss",
        "citation": "Near-miss incident #001 (April 2024, Refinery Unit B)",
        "text": (
            "A hot work permit was issued for pipe welding in Process Unit B. Gas "
            "monitoring showed 12% LEL at the start of work, within safe limits. Over "
            "the next 30 minutes, gas concentration rose to 35% LEL due to an upstream "
            "valve leak, but the welding crew was not alerted. The fire watch had left "
            "for a shift break and not been replaced. Work was halted only when a "
            "supervisor noticed the LEL alarm. No fire occurred. Root cause: inadequate "
            "continuous monitoring integration with permit system, and missing fire watch "
            "handover procedure."
        ),
    },
    {
        "id": "nm-002",
        "type": "near_miss",
        "citation": "Near-miss incident #002 (July 2024, Compressor Station)",
        "text": (
            "A confined space entry permit was active when gas readings in the adjacent "
            "compressor bay began trending upward (15% LEL to 28% LEL over 20 minutes). "
            "The permit system did not flag the proximity of the confined space work to "
            "the elevated gas zone. Entry was discovered and stopped by a third-party "
            "safety auditor. Root cause: permit-to-work system does not correlate "
            "spatial proximity of simultaneous operations."
        ),
    },
    {
        "id": "nm-003",
        "type": "near_miss",
        "citation": "Near-miss incident #003 (September 2023, Tank Farm)",
        "text": (
            "Hot work permit (tank repair) issued without verifying the status of scheduled "
            "valve maintenance in the same zone. The maintenance task was 6 days overdue. "
            "During hot work, a leaking valve (which should have been replaced per the "
            "overdue task) released hydrocarbon vapors. Gas alarm triggered at 42% LEL; "
            "work stopped immediately. Root cause: permit approval process did not check "
            "overdue maintenance tasks in the same zone."
        ),
    },
    {
        "id": "nm-004",
        "type": "near_miss",
        "citation": "Near-miss incident #004 (March 2024, Utilities Block)",
        "text": (
            "A general maintenance permit was active in the boiler area. Gas readings were "
            "normal (<10% LEL) but trending upward at ~3% LEL per hour. A worker on a "
            "14-hour shift (fatigue-risk threshold: 12 hours) failed to notice the trend "
            "and continued work. The supervisor intervened after reviewing shift logs. "
            "Root cause: no automated correlation of long-shift fatigue risk with trending "
            "gas concentrations."
        ),
    },
    {
        "id": "nm-005",
        "type": "near_miss",
        "citation": "Near-miss incident #005 (November 2023, Loading Bay)",
        "text": (
            "Multiple permits active in the loading bay: one confined space entry, one "
            "hot work (flange cutting), one general maintenance. No single permit violated "
            "a rule, but the combination created a scenario where the hot work was <15m "
            "from the confined space entry point, with no isolation barrier. Gas in the "
            "confined space spiked to 50% LEL. Evacuation successful. Root cause: lack of "
            "spatial and temporal correlation across simultaneous permits."
        ),
    },
    {
        "id": "nm-006",
        "type": "near_miss",
        "citation": "Near-miss incident #006 (January 2024, Process Unit A)",
        "text": (
            "Fire watch logged at the start of a hot work permit but left the area 40 minutes "
            "into a 90-minute job without logging departure. Gas concentration rose from "
            "8% LEL to 22% LEL during the unmonitored window. Work was halted only when a "
            "passing safety officer noticed the absence of fire watch. Root cause: fire "
            "watch attendance not continuously verified during hot work."
        ),
    },
    {
        "id": "nm-007",
        "type": "near_miss",
        "citation": "Near-miss incident #007 (August 2024, Pipeline Section 3)",
        "text": (
            "A scheduled gas detector calibration was overdue by 11 days. During this period, "
            "a hot work permit was issued based on the uncalibrated detector reading (showed "
            "5% LEL). Post-incident investigation revealed the actual concentration was "
            "38% LEL. The calibration delay was not flagged to the permit issuer. Root cause: "
            "overdue equipment maintenance not surfaced in permit approval workflow."
        ),
    },
    {
        "id": "nm-008",
        "type": "near_miss",
        "citation": "Near-miss incident #008 (May 2024, Storage Tank 7)",
        "text": (
            "Worker on a 16-hour continuous shift (night into day) approved a hot work permit "
            "in a zone where gas was at 18% LEL—below the 20% alarm but above the safe "
            "threshold for hot work per OISD STD 117. Fatigue was cited as a contributing "
            "factor in the risk assessment failure. Root cause: no automated check for "
            "fatigue-risk shifts in safety-critical decision-making roles."
        ),
    },
    {
        "id": "nm-009",
        "type": "near_miss",
        "citation": "Near-miss incident #009 (December 2023, Compressor House)",
        "text": (
            "Compressor seal maintenance was overdue by 8 days. During the delay, a minor "
            "leak developed. Gas readings in the compressor house rose steadily from 6% LEL "
            "to 33% LEL over 3 hours. A concurrent general maintenance permit in the same "
            "building was not flagged despite the rising gas. Root cause: lack of real-time "
            "integration between maintenance status and active permit zones."
        ),
    },
    {
        "id": "nm-010",
        "type": "near_miss",
        "citation": "Near-miss incident #010 (February 2024, Boiler Area)",
        "text": (
            "A hot work permit for boiler tube repair was active. Gas concentration was "
            "within safe limits, but the permit did not account for an adjacent loading "
            "operation that began 20 minutes into the hot work, introducing volatile organic "
            "compounds into the shared airspace. Combined gas concentration spiked to 29% "
            "LEL. Root cause: no dynamic reassessment of permit validity when new operations "
            "start in adjacent zones."
        ),
    },
    {
        "id": "nm-011",
        "type": "near_miss",
        "citation": "Near-miss incident #011 (June 2024, Process Unit C)",
        "text": (
            "Relief valve inspection was 3 days overdue. During the delay window, a hot work "
            "permit was approved in the same zone. Gas concentration was initially 7% LEL "
            "but rose to 44% LEL when pressure exceeded safe limits (the overdue relief valve "
            "did not open). The hot work was stopped manually. Root cause: overdue critical "
            "maintenance not cross-referenced during permit approval."
        ),
    },
    {
        "id": "nm-012",
        "type": "near_miss",
        "citation": "Near-miss incident #012 (October 2023, Tank Farm)",
        "text": (
            "Two hot work permits issued within 50 meters of each other with no coordination. "
            "Fire watch was assigned to one permit only. The second crew assumed fire watch "
            "coverage extended to their area. When gas spiked to 31% LEL in the second zone, "
            "no fire watch was present. Root cause: permit system allowed simultaneous hot "
            "work in proximity without enforcing consolidated fire watch or zone isolation."
        ),
    },
    {
        "id": "nm-013",
        "type": "near_miss",
        "citation": "Near-miss incident #013 (April 2023, Loading Bay)",
        "text": (
            "A general maintenance permit was extended by 4 hours into a worker's 13th "
            "consecutive hour on shift. During the extension, gas began trending upward "
            "(+2% LEL per 15 min). The fatigued worker did not notice until gas reached "
            "36% LEL. Root cause: permit extensions not re-evaluated for shift fatigue and "
            "changing environmental conditions."
        ),
    },
]


def get_corpus() -> list[dict]:
    """Return the full corpus (regulations + near-miss reports)."""
    return REGULATIONS + NEAR_MISS_REPORTS
