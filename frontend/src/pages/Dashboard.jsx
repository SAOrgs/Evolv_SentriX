import { useEffect, useState, useCallback } from "react";
import {
  getZones,
  getRiskScores,
  getAlerts,
  getPermits,
  advanceSimulation,
} from "../api/client";
import HeatmapFloorplan from "../components/HeatmapFloorplan";
import ZoneDetailPanel from "../components/ZoneDetailPanel";
import RiskTimeline from "../components/RiskTimeline";
import AlertPanel from "../components/AlertPanel";
import { riskAccent, riskGlow } from "../utils/riskColor";

const POLL_INTERVAL_MS = 2000;

export default function Dashboard() {
  const [zones, setZones] = useState([]);
  const [riskScores, setRiskScores] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [permits, setPermits] = useState([]);
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedZoneId, setSelectedZoneId] = useState("zone-c");

  // -- initial load ---------------------------------------------------------
  useEffect(() => {
    async function load() {
      try {
        const [z, rs, al, pm] = await Promise.all([
          getZones(), getRiskScores(), getAlerts(), getPermits(),
        ]);
        setZones(z);
        setRiskScores(rs);
        setAlerts(al);
        setPermits(pm);
      } catch (err) {
        console.error("Failed to load initial data:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // -- polling --------------------------------------------------------------
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const [rs, al] = await Promise.all([getRiskScores(), getAlerts()]);
        setRiskScores(rs);
        setAlerts(al);
      } catch (err) {
        console.error("Poll error:", err);
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // -- advance simulation ---------------------------------------------------
  const handleAdvance = useCallback(async () => {
    try {
      const result = await advanceSimulation();
      setTick(result.tick);
      const [rs, al, pm] = await Promise.all([
        getRiskScores(), getAlerts(), getPermits(),
      ]);
      setRiskScores(rs);
      setAlerts(al);
      setPermits(pm);
    } catch (err) {
      console.error("Failed to advance simulation:", err);
    }
  }, []);

  // -- derived data ---------------------------------------------------------
  const selectedZone = selectedZoneId
    ? zones.find((z) => z.zone_id === selectedZoneId) : null;
  const selectedScore = selectedZoneId
    ? (riskScores.find((r) => r.zone_id === selectedZoneId)?.risk_score ?? 0) : 0;
  const selectedPermits = selectedZoneId
    ? permits.filter((p) => p.zone_id === selectedZoneId) : [];
  const highestRisk = riskScores.length > 0
    ? Math.max(...riskScores.map((r) => r.risk_score)) : 0;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-slate-600">Loading data...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {/* ── Controls ──────────────────────────────────────────── */}
      <div className="flex flex-shrink-0 items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-100">Dashboard</h2>
          <p className="text-xs text-slate-500">Simulation tick: {tick}</p>
        </div>
        <button
          onClick={handleAdvance}
          className="rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.08] hover:text-white active:scale-[0.98]"
        >
          Advance Simulation
        </button>
      </div>

      {/* ── Summary cards ─────────────────────────────────────── */}
      <div className="grid flex-shrink-0 grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatCard label="Zones" value={zones.length} />
        <StatCard label="Active Permits" value={permits.length} />
        <StatCard
          label="Active Alerts"
          value={alerts.length}
          accent={alerts.length > 0 ? riskAccent(80) : undefined}
          glow={alerts.length > 0 ? riskGlow(80) : undefined}
        />
        <StatCard
          label="Highest Risk"
          value={highestRisk}
          accent={highestRisk >= 50 ? riskAccent(highestRisk) : undefined}
          glow={highestRisk >= 60 ? riskGlow(highestRisk) : undefined}
        />
      </div>

      {/* ── Main content ──────────────────────────────────────── */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-5">
        {/* Left: heatmap + zone detail */}
        <div className="flex min-h-0 lg:col-span-3">
          <div
            className={`surface flex-1 p-3 ${
              selectedZone ? "rounded-r-none border-r-0" : ""
            }`}
          >
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Plant Floorplan
            </p>
            <HeatmapFloorplan
              zones={zones}
              riskScores={riskScores}
              permits={permits}
              selectedZoneId={selectedZoneId}
              onZoneSelect={(id) =>
                setSelectedZoneId(id === selectedZoneId ? null : id)
              }
            />
          </div>

          {selectedZone && (
            <div className="w-52 flex-shrink-0 rounded-r-[10px] border border-l-0 border-white/[0.06] bg-[#080e1e]">
              <ZoneDetailPanel
                zone={selectedZone}
                score={selectedScore}
                permits={selectedPermits}
                onClose={() => setSelectedZoneId(null)}
              />
            </div>
          )}
        </div>

        {/* Right: timeline + alerts */}
        <div className="flex min-h-0 flex-col gap-3 lg:col-span-2">
          <div className="h-60 flex-shrink-0">
            <RiskTimeline zoneId={selectedZoneId} zoneName={selectedZone?.name} />
          </div>
          <div className="min-h-0 flex-1">
            <AlertPanel alerts={alerts} zones={zones} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function StatCard({ label, value, accent, glow }) {
  return (
    <div
      className="surface rounded-lg px-4 py-3 transition-shadow duration-500"
      style={glow ? { boxShadow: glow } : undefined}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p
        className="mt-1 text-2xl font-bold text-slate-100"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </p>
    </div>
  );
}
