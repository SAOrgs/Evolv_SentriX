"""
Emergency response module (MOCKED for demo).

Drafts evacuation instructions + incident reports when a zone crosses a hard
risk threshold. Does NOT send real SMS/PA/app notifications — returns canned
channel lists as strings to demonstrate the capability. The incident report is
auto-drafted by Claude using the alert data from A4/A5, formatted as a
preliminary regulatory report.

For the hackathon, this is explicitly MOCKED and labeled as such — we're not
building live integrations with emergency notification systems.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime
from typing import Optional

logger = logging.getLogger("sentrix.emergency")

# --- Tunables -------------------------------------------------------------
EMERGENCY_THRESHOLD = 85  # trigger automatic emergency response above this score


# --- Incident report drafting (Claude) -----------------------------------
_INCIDENT_REPORT_SYSTEM = (
    "You are a safety officer drafting a preliminary incident report for "
    "regulatory compliance (DGMS / Factory Act / OISD). You receive structured "
    "data about a high-risk compound condition detected by an automated safety "
    "system. Write a concise preliminary incident report (3-4 paragraphs) in "
    "formal regulatory language covering: (1) incident classification and time, "
    "(2) zone and contributing factors (gas, permits, maintenance, shifts), "
    "(3) immediate response action taken, and (4) relevant regulatory clause. "
    "Use past tense as if the response has been initiated. Be factual and compliance-focused; "
    "avoid speculation. All data is synthetic for demonstration purposes; do not add disclaimers."
)


def _call_claude_for_report(zone_id: str, zone_name: str, alert_data: dict) -> Optional[str]:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return None
    try:
        import anthropic
        import json
        client = anthropic.Anthropic(api_key=api_key)

        payload = json.dumps({
            "zone_id": zone_id,
            "zone_name": zone_name,
            "risk_score": alert_data.get("risk_score"),
            "timestamp": alert_data.get("timestamp"),
            "trigger_signals": alert_data.get("trigger_signals", []),
            "explanation": alert_data.get("explanation"),
            "regulatory_citation": alert_data.get("regulatory_citation"),
        }, indent=2)

        user_prompt = (
            f"ALERT DATA (zone {zone_id} - {zone_name}):\n{payload}\n\n"
            "Draft the preliminary incident report now (3-4 paragraphs, formal tone)."
        )

        msg = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=600,
            system=_INCIDENT_REPORT_SYSTEM,
            messages=[{"role": "user", "content": user_prompt}],
        )
        text = "".join(
            block.text for block in msg.content
            if getattr(block, "type", None) == "text"
        ).strip()
        return text or None
    except Exception as exc:
        logger.warning("Claude incident report drafting failed (%s); using fallback.", exc)
        return None


def _fallback_report(zone_id: str, zone_name: str, alert_data: dict) -> str:
    """Deterministic incident report template when Claude is unavailable."""
    timestamp = alert_data.get("timestamp", "N/A")
    score = alert_data.get("risk_score", 0)
    explanation = alert_data.get("explanation", "No explanation available.")
    citation = alert_data.get("regulatory_citation", {})
    clause = citation.get("clause", "No regulatory clause retrieved.")
    source = citation.get("source", "N/A")

    return (
        f"PRELIMINARY INCIDENT REPORT\n\n"
        f"Incident Classification: High compound risk condition (automated detection)\n"
        f"Date/Time: {timestamp}\n"
        f"Location: {zone_name} ({zone_id})\n"
        f"Risk Score: {score}/100\n\n"
        f"Contributing Factors:\n{explanation}\n\n"
        f"Immediate Response:\nEvacuation protocol initiated for {zone_name}. All non-essential "
        f"personnel evacuated. Area isolated and monitoring intensified. Emergency response team "
        f"dispatched.\n\n"
        f"Regulatory Reference:\n{clause}\nSource: {source}\n\n"
        f"This is a preliminary automated report. A full investigation will follow per "
        f"Factories Act 1948, Section 87 and DGMS notification requirements."
    )


# --- Emergency trigger ----------------------------------------------------
def trigger_emergency_response(zone_id: str, zone_name: str, alert_data: dict) -> dict:
    """
    Draft an emergency response for a high-risk zone.
    Returns a JSON payload with evacuation instructions, mocked notification
    channels, and an auto-drafted incident report.
    """
    timestamp = alert_data.get("timestamp", datetime.utcnow().isoformat())
    score = alert_data.get("risk_score", 0)

    # Canned evacuation instruction
    evacuation_instruction = (
        f"EVACUATION ORDER: {zone_name} ({zone_id}). All non-essential personnel "
        f"must evacuate immediately via designated emergency exits. Essential personnel "
        f"(fire watch, shutdown operators) remain on standby. Isolate the zone and cease "
        f"all hot work and confined space operations. Await all-clear from site emergency "
        f"coordinator before re-entry."
    )

    # Mocked notification channels (no real integration)
    alert_channels = [
        "SMS: Emergency contact list (12 personnel)",
        "PA System: Plant-wide announcement triggered",
        "Mobile App: Push notification sent to all on-site personnel",
        "Control Room: Alarm escalated to site emergency coordinator",
        "SCADA: Automated isolation sequence initiated",
    ]

    # Draft incident report (Claude preferred, fallback if unavailable)
    incident_report_llm = _call_claude_for_report(zone_id, zone_name, alert_data)
    incident_report = (
        incident_report_llm if incident_report_llm
        else _fallback_report(zone_id, zone_name, alert_data)
    )

    return {
        "zone_id": zone_id,
        "zone_name": zone_name,
        "risk_score": score,
        "timestamp": timestamp,
        "evacuation_instruction": evacuation_instruction,
        "alert_channels": alert_channels,
        "incident_report": incident_report,
        "status": "MOCKED - no real notifications sent",
    }
