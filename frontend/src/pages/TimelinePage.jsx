import { useEffect, useState } from "react";
import { getZones, getRiskScores } from "../api/client";
import RiskTimeline from "../components/RiskTimeline";
import { riskAccent, riskBgClass, riskLabel } from "../utils/riskColor";

const POLL_MS = 2000;

export default function TimelinePage() {
  const [zones, setZones] = useState([]);
  const [riskScores, setRiskScores] = useState([]);
  const [selectedZoneId, setSelectedZoneId] = useState("zone-c");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [z, rs] = await Promise.all([getZones(), getRiskScores()]);
      setZones(z);
      setRiskScores(rs);
      setLoading(false);
    }
    load();
    const id = setInterval(async () => {
      const rs = await getRiskScores();
      setRiskScores(rs);
    }, POLL_MS);
    return () => clearInterval(id);
  }, []);

  const scoreMap = {};
  for (const rs of riskScores) scoreMap[rs.zone_id] = rs.risk_score;

  const selectedZone = zones.find((z) => z.zone_id === selectedZoneId);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-slate-600">Loading timeline...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header */}
      <div className="flex-shrink-0">
        <h2 className="text-base font-semibold text-slate-100">Timeline</h2>
        <p className="text-xs text-slate-500">Risk score history by zone</p>
      </div>

      {/* Zone selector */}
      <div className="flex flex-shrink-0 flex-wrap gap-2">
        {zones.map((zone) => {
          const score = scoreMap[zone.zone_id] ?? 0;
          const isActive = zone.zone_id === selectedZoneId;
          return (
            <button
              key={zone.zone_id}
              onClick={() => setSelectedZoneId(zone.zone_id)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition ${
                isActive
                  ? "bg-white/[0.10] text-slate-100"
                  : "bg-white/[0.03] text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
              } border ${
                isActive ? "border-white/[0.12]" : "border-white/[0.06]"
              }`}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: riskAccent(score) }}
              />
              {zone.name}
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${riskBgClass(score)}`}>
                {score}
              </span>
            </button>
          );
        })}
      </div>

      {/* Chart — fills remaining space */}
      <div className="min-h-0 flex-1">
        <RiskTimeline
          zoneId={selectedZoneId}
          zoneName={selectedZone?.name}
        />
      </div>
    </div>
  );
}
