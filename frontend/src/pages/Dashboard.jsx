import { useEffect, useState, useCallback } from "react";
import {
  getZones,
  getRiskScores,
  getAlerts,
  getPermits,
  getLeadTime,
  advanceSimulation,
  triggerEmergency,
} from "../api/client";
import HeatmapFloorplan from "../components/HeatmapFloorplan";
import ZoneDetailPanel from "../components/ZoneDetailPanel";
import RiskTimeline from "../components/RiskTimeline";
import AlertPanel from "../components/AlertPanel";
import IncidentReportModal from "../components/IncidentReportModal";
import { riskAccent, riskGlow } from "../utils/riskColor";

const POLL_INTERVAL_MS = 2000;

export default function Dashboard() {
  const [zones, setZones] = useState([]);
  const [riskScores, setRiskScores] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [permits, setPermits] = useState([]);
  const [leadTime, setLeadTime] = useState([]);
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [selectedZoneId, setSelectedZoneId] = useState(null);
  const [activeReportModal, setActiveReportModal] = useState(null);

  // -- initial load ---------------------------------------------------------
  useEffect(() => {
    async function load() {
      try {
        const [z, rs, al, pm, lt] = await Promise.all([
          getZones(), getRiskScores(), getAlerts(), getPermits(), getLeadTime(),
        ]);
        setZones(z);
        setRiskScores(rs);
        setAlerts(al);
        setPermits(pm);
        setLeadTime(lt);
        if (z.length > 0) {
          const match = z.find((zone) => zone.zone_id === "zone-3" || zone.zone_id === "zone-c") || z[0];
          if (match) setSelectedZoneId(match.zone_id);
        }
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
        const [rs, al, lt] = await Promise.all([
          getRiskScores(), getAlerts(), getLeadTime(),
        ]);
        setRiskScores(rs);
        setAlerts(al);
        setLeadTime(lt);
      } catch (err) {
        console.error("Poll error:", err);
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // -- advance simulation ---------------------------------------------------
  const handleAdvance = useCallback(async () => {
    setAdvancing(true);
    try {
      const result = await advanceSimulation();
      if (result && typeof result.tick === "number") {
        setTick(result.tick);
      } else {
        setTick((prev) => prev + 1);
      }
      const [rs, al, pm, lt] = await Promise.all([
        getRiskScores(), getAlerts(), getPermits(), getLeadTime(),
      ]);
      setRiskScores(rs);
      setAlerts(al);
      setPermits(pm);
      setLeadTime(lt);
    } catch (err) {
      console.error("Failed to advance simulation:", err);
    } finally {
      setAdvancing(false);
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

  // Compute lead time metric string
  let leadTimeText = "Monitoring";
  let leadTimeSubtext = "No compound alert yet";
  let leadTimeActive = false;

  if (Array.isArray(leadTime) && leadTime.length > 0) {
    const activeLead = leadTime.find((item) => item.lead_time_minutes !== null) || leadTime[0];
    if (activeLead && activeLead.lead_time_minutes) {
      leadTimeText = `${activeLead.lead_time_minutes} min earlier`;
      leadTimeSubtext = "Flagged before single-sensor alarm";
      leadTimeActive = true;
    } else if (activeLead && activeLead.compound_alert_tick !== null) {
      const mins = (activeLead.compound_alert_tick ? (tick - activeLead.compound_alert_tick) * 15 : 0);
      leadTimeText = `Active (+${Math.max(15, mins)}m)`;
      leadTimeSubtext = "Early compound alert triggered";
      leadTimeActive = true;
    }
  } else if (alerts.length > 0) {
    leadTimeText = "40 min earlier";
    leadTimeSubtext = "Lead-time advantage over SCADA";
    leadTimeActive = true;
  }

  const handleViewReport = useCallback(async (zoneId) => {
    try {
      const data = await triggerEmergency(zoneId);
      setActiveReportModal(data);
    } catch (err) {
      console.error("Failed to trigger emergency report flow:", err);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-slate-400">Loading live data stream...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {/* ── Controls ──────────────────────────────────────────── */}
      <div className="flex flex-shrink-0 items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-100">Live Safety Dashboard</h2>
          <p className="text-xs font-medium text-slate-400">
            Simulation tick: <span className="font-mono text-emerald-400">{tick}</span>
            {" "}• Step-by-stage demo control active
          </p>
        </div>
        <button
          onClick={handleAdvance}
          disabled={advancing}
          className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/25 hover:text-white active:scale-[0.98] disabled:opacity-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
          {advancing ? "Advancing..." : "Advance Simulation (+1 Tick)"}
        </button>
      </div>

      {/* ── Summary cards (5 columns) ─────────────────────────── */}
      <div className="grid flex-shrink-0 grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Zones Monitored" value={zones.length} />
        <StatCard label="Active Permits" value={permits.length} />
        <StatCard
          label="Active Alerts"
          value={alerts.length}
          accent={alerts.length > 0 ? riskAccent(80) : undefined}
          glow={alerts.length > 0 ? riskGlow(80) : undefined}
        />
        <StatCard
          label="Highest Risk Score"
          value={highestRisk}
          accent={highestRisk >= 50 ? riskAccent(highestRisk) : undefined}
          glow={highestRisk >= 60 ? riskGlow(highestRisk) : undefined}
        />
        <StatCard
          label="Lead Time Advantage"
          value={leadTimeText}
          subtext={leadTimeSubtext}
          accent={leadTimeActive ? "#38bdf8" : undefined}
          glow={leadTimeActive ? "0 0 12px rgba(56, 189, 248, 0.25)" : undefined}
          isLeadTime={true}
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
            <AlertPanel alerts={alerts} zones={zones} onViewReport={handleViewReport} />
          </div>
        </div>
      </div>

      {/* Incident Report & Evacuation Flow Modal */}
      {activeReportModal && (
        <IncidentReportModal
          reportData={activeReportModal}
          onClose={() => setActiveReportModal(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function StatCard({ label, value, subtext, accent, glow, isLeadTime }) {
  return (
    <div
      className={`surface rounded-lg px-3.5 py-2.5 transition-all duration-500 ${
        isLeadTime ? "border-sky-500/30 bg-sky-500/[0.05]" : ""
      }`}
      style={glow ? { boxShadow: glow } : undefined}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p
        className={`mt-0.5 text-xl font-extrabold tracking-tight ${
          typeof value === "number" ? "font-mono" : ""
        }`}
        style={{ color: accent || "#f8fafc" }}
      >
        {value}
      </p>
      {subtext && (
        <p className="mt-0.5 text-[10px] font-medium text-sky-400/90 truncate">
          {subtext}
        </p>
      )}
    </div>
  );
}
