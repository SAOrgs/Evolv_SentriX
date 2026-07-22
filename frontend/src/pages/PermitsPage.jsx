import { useEffect, useState } from "react";
import { getPermits, getZones, getRiskScores } from "../api/client";
import { riskAccent, riskBgClass, riskLabel, formatPermitType } from "../utils/riskColor";

const POLL_MS = 2000;

export default function PermitsPage() {
  const [permits, setPermits] = useState([]);
  const [zones, setZones] = useState([]);
  const [riskScores, setRiskScores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [pm, z, rs] = await Promise.all([getPermits(), getZones(), getRiskScores()]);
        setPermits(pm);
        setZones(z);
        setRiskScores(rs);
      } catch (err) {
        console.error("Failed to load permits:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
    const id = setInterval(async () => {
      try {
        const [pm, rs] = await Promise.all([getPermits(), getRiskScores()]);
        setPermits(pm);
        setRiskScores(rs);
      } catch (err) {
        console.error("Poll error (permits):", err);
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, []);

  const zoneNames = {};
  for (const z of zones) zoneNames[z.zone_id] = z.name;

  const scoreMap = {};
  for (const rs of riskScores) scoreMap[rs.zone_id] = rs.risk_score;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-slate-600">Loading permits...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto">
      {/* Header */}
      <div className="flex-shrink-0">
        <h2 className="text-base font-semibold text-slate-100">Permits</h2>
        <p className="text-xs text-slate-500">
          {permits.length} active {permits.length === 1 ? "permit" : "permits"}
        </p>
      </div>

      {/* Table */}
      <div className="surface flex-1 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3">Permit ID</th>
                <th className="px-5 py-3">Zone</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Zone Risk</th>
                <th className="px-5 py-3">Start</th>
                <th className="px-5 py-3">End</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {permits.map((p) => {
                const zoneScore = scoreMap[p.zone_id] ?? 0;
                const isHighRisk = zoneScore >= 60;
                return (
                  <tr
                    key={p.permit_id}
                    className={`transition ${
                      isHighRisk
                        ? "bg-red-500/[0.03]"
                        : "hover:bg-white/[0.02]"
                    }`}
                  >
                    <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-400">
                      {p.permit_id}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <p className="font-medium text-slate-200">
                        {zoneNames[p.zone_id] || p.zone_id}
                      </p>
                      <p className="font-mono text-[10px] text-slate-600">
                        {p.zone_id}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-300">
                      {formatPermitType(p.type)}
                      {(p.type === "hot_work" || p.type === "Hot Work") && (
                        <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">
                          {p.fire_watch_logged ? "Fire Watch Logged" : "Fire Watch Required"}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-bold ${riskBgClass(zoneScore)}`}
                      >
                        {zoneScore} — {riskLabel(zoneScore)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">
                      {formatTime(p.start_time)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">
                      {formatTime(p.end_time)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-semibold text-emerald-400">
                        Active
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function formatTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString([], {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
