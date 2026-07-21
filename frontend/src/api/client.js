// ---------------------------------------------------------------------------
// API Client — single module that every component imports from.
//
// Toggle between mock data and the real backend via the VITE_API_MODE env var:
//   VITE_API_MODE=mock   -> uses src/mocks/api.js  (default during dev)
//   VITE_API_MODE=live   -> calls the real backend at VITE_API_BASE_URL
// ---------------------------------------------------------------------------

import * as mockApi from "../mocks/api.js";

const API_MODE = import.meta.env.VITE_API_MODE || "mock";
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

// ---- Helper for live mode -------------------------------------------------

async function fetchJson(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

// ---- Public API (same signatures regardless of mode) ----------------------

export async function getZones() {
  if (API_MODE === "mock") return mockApi.getZones();
  return fetchJson("/api/zones");
}

export async function getRiskScores() {
  if (API_MODE === "mock") return mockApi.getRiskScores();
  return fetchJson("/api/risk-scores");
}

export async function getRiskScoreHistory(zoneId, hours = 4) {
  if (API_MODE === "mock") return mockApi.getRiskScoreHistory(zoneId, hours);
  return fetchJson(`/api/risk-scores/history?zone_id=${zoneId}&hours=${hours}`);
}

export async function getAlerts() {
  if (API_MODE === "mock") return mockApi.getAlerts();
  return fetchJson("/api/alerts");
}

export async function getPermits() {
  if (API_MODE === "mock") return mockApi.getPermits();
  return fetchJson("/api/permits");
}

export async function advanceSimulation() {
  if (API_MODE === "mock") return mockApi.advanceSimulation();
  return fetchJson("/api/simulate/advance", { method: "POST" });
}
