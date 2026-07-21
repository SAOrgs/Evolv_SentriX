import { useEffect, useState } from "react";
import { getAlerts, getZones } from "../api/client";
import { riskAccent, riskBgClass, riskLabel, riskGlow } from "../utils/riskColor";

const POLL_MS = 2000;

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [al, z] = await Promise.all([getAlerts(), getZones()]);
      setAlerts(al);
      setZones(z);
      setLoading(false);
    }
    load();
    const id = setInterval(async () => {
      const al = await getAlerts();
      setAlerts(al);
    }, POLL_MS);
    return () => clearInterval(id);
  }, []);

  const zoneNames = {};
  for (const z of zones) zoneNames[z.zone_id] = z.name;

  const sorted = [...alerts].sort((a, b) => {
    if (b.risk_score !== a.risk_score) return b.risk_score - a.risk_score;
    return new Date(b.timestamp) - new Date(a.timestamp);
  });

  if (loading) {
    return <Loader />;
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-100">Alerts</h2>
          <p className="text-xs text-slate-500">
            {sorted.length} active {sorted.length === 1 ? "alert" : "alerts"}
          </p>
        </div>
        {sorted.length > 0 && (
          <span className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />
            Live
          </span>
        )}
      </div>

      {/* Alert list */}
      {sorted.length === 0 ? (
        <div className="surface flex flex-1 items-center justify-center">
          <p className="text-sm text-slate-600">
            No active alerts — all zones within normal parameters
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {sorted.map((alert) => (
            <AlertCard
              key={alert.alert_id}
              alert={alert}
              zoneName={zoneNames[alert.zone_id] || alert.zone_id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AlertCard({ alert, zoneName }) {
  const isEvac = alert.risk_score >= 90;
  const accent = riskAccent(alert.risk_score);

  return (
    <div
      className="surface relative overflow-hidden p-5 transition-shadow duration-500"
      style={{ boxShadow: alert.risk_score >= 60 ? riskGlow(alert.risk_score) : "none" }}
    >
      {/* Severity stripe */}
      <div
        className="absolute bottom-3 left-0 top-3 w-[3px] rounded-r"
        style={{ backgroundColor: accent }}
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-3 pl-3">
        <div>
          <p className="text-base font-semibold text-slate-100">{zoneName}</p>
          <p className="font-mono text-[10px] text-slate-600">{alert.alert_id}</p>
        </div>
        <span className={`rounded-md px-2.5 py-1 text-xs font-bold ${riskBgClass(alert.risk_score)}`}>
          {alert.risk_score} — {riskLabel(alert.risk_score)}
        </span>
      </div>

      {/* Trigger signals */}
      <div className="mt-4 pl-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Trigger Signals
        </p>
        <ul className="mt-2 space-y-1.5">
          {alert.trigger_signals.map((sig, i) => (
            <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-slate-400">
              <span
                className="mt-[7px] block h-1.5 w-1.5 flex-shrink-0 rounded-full"
                style={{ backgroundColor: accent }}
              />
              {sig}
            </li>
          ))}
        </ul>
      </div>

      {/* Explanation */}
      <div className="mt-4 pl-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Analysis
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
          {alert.explanation}
        </p>
      </div>

      {/* Regulatory citation */}
      {alert.regulatory_citation && (
        <div className="surface-inset mt-4 ml-3 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Regulatory Reference
          </p>
          <p className="mt-1 text-sm font-medium text-slate-300">
            {alert.regulatory_citation.clause}
          </p>
          <p className="mt-0.5 text-xs text-slate-600">
            {alert.regulatory_citation.source}
          </p>
        </div>
      )}

      {/* Timestamp */}
      <p className="mt-3 pl-3 text-[10px] text-slate-600">
        {formatTimestamp(alert.timestamp)}
      </p>

      {/* Evacuation call-out */}
      {isEvac && (
        <div className="mt-4 ml-3 rounded-lg border border-red-500/20 bg-red-500/[0.07] px-4 py-3">
          <p className="text-sm font-bold text-red-400">EVACUATION RECOMMENDED</p>
          <p className="mt-1 text-xs leading-relaxed text-red-400/70">
            Risk score has exceeded the evacuation threshold. Immediate zone
            clearance and incident response activation advised.
          </p>
        </div>
      )}
    </div>
  );
}

function Loader() {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-sm text-slate-600">Loading alerts...</p>
    </div>
  );
}

function formatTimestamp(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}
