// ---------------------------------------------------------------------------
// Mock API — returns data matching the shared backend contract exactly.
// Every function here mirrors one REST endpoint.  The real client.js will
// call these locally until the backend is ready, then swap to fetch().
// ---------------------------------------------------------------------------

// ---- Static seed data -----------------------------------------------------

const ZONES = [
  { zone_id: "zone-a", name: "Tank Farm Alpha",      x: 120, y: 80,  width: 160, height: 120 },
  { zone_id: "zone-b", name: "Compressor House B",   x: 340, y: 60,  width: 140, height: 100 },
  { zone_id: "zone-c", name: "Reactor Bay C",        x: 180, y: 260, width: 200, height: 140 },
  { zone_id: "zone-d", name: "Loading Dock D",       x: 440, y: 240, width: 120, height: 130 },
  { zone_id: "zone-e", name: "Utility Corridor E",   x: 60,  y: 420, width: 300, height: 80  },
];

const PERMITS = [
  {
    permit_id: "PTW-001",
    zone_id: "zone-a",
    type: "Hot Work",
    start_time: "2025-06-15T08:00:00Z",
    end_time:   "2025-06-15T14:00:00Z",
  },
  {
    permit_id: "PTW-002",
    zone_id: "zone-c",
    type: "Confined Space Entry",
    start_time: "2025-06-15T06:00:00Z",
    end_time:   "2025-06-15T18:00:00Z",
  },
  {
    permit_id: "PTW-003",
    zone_id: "zone-d",
    type: "Crane Lift",
    start_time: "2025-06-15T09:00:00Z",
    end_time:   "2025-06-15T12:00:00Z",
  },
];

// ---- Mutable simulation state ---------------------------------------------

let tick = 0;

// Risk scores start at safe baselines.  advanceSimulation() mutates these.
let riskScores = {
  "zone-a": 12,
  "zone-b": 8,
  "zone-c": 15,
  "zone-d": 5,
  "zone-e": 3,
};

// History accumulates one entry per zone per tick.
let riskHistory = {
  "zone-a": [],
  "zone-b": [],
  "zone-c": [],
  "zone-d": [],
  "zone-e": [],
};

let alerts = [];

// ---- Helpers --------------------------------------------------------------

function now() {
  // Return a deterministic "now" that advances with ticks so the timeline
  // chart shows progression.  Base date + tick * 10 minutes.
  const base = new Date("2025-06-15T06:00:00Z");
  return new Date(base.getTime() + tick * 10 * 60 * 1000).toISOString();
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function snapshotHistory() {
  const ts = now();
  for (const zoneId of Object.keys(riskScores)) {
    riskHistory[zoneId].push({ timestamp: ts, risk_score: riskScores[zoneId] });
  }
}

// Push the initial t=0 snapshot.
snapshotHistory();

// ---- Mock endpoint implementations ---------------------------------------

export function getZones() {
  return structuredClone(ZONES);
}

export function getRiskScores() {
  const ts = now();
  return Object.entries(riskScores).map(([zone_id, risk_score]) => ({
    zone_id,
    risk_score,
    timestamp: ts,
  }));
}

export function getRiskScoreHistory(zoneId, hours = 4) {
  const series = riskHistory[zoneId] || [];
  // "hours" filter: keep entries within the last N hours of simulation time.
  const cutoff = new Date(new Date(now()).getTime() - hours * 3600 * 1000);
  return series.filter((pt) => new Date(pt.timestamp) >= cutoff);
}

export function getAlerts() {
  return structuredClone(alerts);
}

export function getPermits() {
  return structuredClone(PERMITS);
}

/**
 * Advance simulation by one tick.
 *
 * Behaviour:
 *  - Zone C ("Reactor Bay C") steadily climbs by 6-10 points per tick,
 *    simulating a compound risk build-up (hot gas trend + confined space permit).
 *  - Other zones jitter randomly within +/- 3 points.
 *  - When Zone C crosses 70, a compound alert is generated.
 *  - When Zone C crosses 90, an evacuation-level alert appears.
 */
export function advanceSimulation() {
  tick += 1;

  // Zone C: deterministic escalation.
  const climb = 6 + Math.floor(Math.random() * 5); // 6-10
  riskScores["zone-c"] = clamp(riskScores["zone-c"] + climb, 0, 100);

  // Other zones: small random jitter.
  for (const zoneId of ["zone-a", "zone-b", "zone-d", "zone-e"]) {
    const jitter = Math.floor(Math.random() * 7) - 3; // -3 to +3
    riskScores[zoneId] = clamp(riskScores[zoneId] + jitter, 0, 40);
  }

  snapshotHistory();

  // Generate alerts based on thresholds.
  const zoneC = riskScores["zone-c"];

  if (zoneC >= 70 && !alerts.find((a) => a.alert_id === "ALERT-C-COMPOUND")) {
    alerts.push({
      alert_id: "ALERT-C-COMPOUND",
      zone_id: "zone-c",
      risk_score: zoneC,
      trigger_signals: [
        "H2S concentration trending upward (18 ppm, threshold 10 ppm)",
        "Confined Space Entry permit PTW-002 active in same zone",
        "Ventilation system maintenance overdue by 3 days",
      ],
      explanation:
        "Three individually sub-critical signals are co-occurring in Reactor Bay C: " +
        "H2S gas readings have been climbing steadily and now exceed the action threshold, " +
        "while a confined space entry permit is active in the same zone and the ventilation " +
        "system that serves this bay is overdue for scheduled maintenance. The combination " +
        "creates a compound inhalation risk that none of the individual systems would flag alone.",
      regulatory_citation: {
        clause: "OISD-STD-116, Clause 5.3.2 — Fire protection facilities for petroleum refineries",
        source: "Oil Industry Safety Directorate, Ministry of Petroleum and Natural Gas",
      },
      timestamp: now(),
    });
  }

  if (zoneC >= 90 && !alerts.find((a) => a.alert_id === "ALERT-C-EVAC")) {
    alerts.push({
      alert_id: "ALERT-C-EVAC",
      zone_id: "zone-c",
      risk_score: zoneC,
      trigger_signals: [
        "Compound risk score exceeded 90 in Reactor Bay C",
        "H2S concentration at 35 ppm (IDLH threshold: 50 ppm)",
        "No fire watch personnel logged in zone",
      ],
      explanation:
        "Risk score in Reactor Bay C has exceeded the evacuation threshold. " +
        "Gas concentrations are approaching IDLH levels with active confined space " +
        "operations and no fire watch coverage. Immediate evacuation of the zone is recommended.",
      regulatory_citation: {
        clause: "DGMS Tech Circular 02/2014, Section 4 — Emergency preparedness and response plan",
        source: "Directorate General of Mines Safety",
      },
      timestamp: now(),
    });
  }

  return {
    tick,
    timestamp: now(),
    risk_scores: getRiskScores(),
    new_alerts: alerts.filter((a) => a.timestamp === now()),
  };
}

/**
 * Reset mock state — useful during development/testing.
 */
export function resetSimulation() {
  tick = 0;
  riskScores = { "zone-a": 12, "zone-b": 8, "zone-c": 15, "zone-d": 5, "zone-e": 3 };
  riskHistory = { "zone-a": [], "zone-b": [], "zone-c": [], "zone-d": [], "zone-e": [] };
  alerts = [];
  snapshotHistory();
}
