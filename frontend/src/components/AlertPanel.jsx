import { riskAccent, riskBgClass, riskLabel, riskGlow } from "../utils/riskColor";

export default function AlertPanel({ alerts, zones, onViewReport }) {
  const zoneNames = {};
  for (const z of zones) zoneNames[z.zone_id] = z.name;

  const sorted = [...alerts].sort((a, b) => {
    if (b.risk_score !== a.risk_score) return b.risk_score - a.risk_score;
    return new Date(b.timestamp) - new Date(a.timestamp);
  });

  return (
    <div className="surface flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
            Active Alerts
          </p>
          <p className="text-sm font-semibold text-slate-200">
            {sorted.length} {sorted.length === 1 ? "alert" : "alerts"}
          </p>
        </div>
        {sorted.length > 0 && (
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4 py-8">
            <p className="text-xs text-slate-600">
              No active alerts — all zones within normal parameters
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.04]">
            {sorted.map((alert) => (
              <AlertCard
                key={alert.alert_id}
                alert={alert}
                zoneName={zoneNames[alert.zone_id] || alert.zone_id}
                onViewReport={onViewReport}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function AlertCard({ alert, zoneName, onViewReport }) {
  const isEvac = alert.risk_score >= 90;
  const accent = riskAccent(alert.risk_score);

  return (
    <li className="relative px-4 py-4">
      {/* Severity stripe */}
      <div
        className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r"
        style={{ backgroundColor: accent, boxShadow: riskGlow(alert.risk_score) }}
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-200">{zoneName}</p>
          <p className="font-mono text-[10px] text-slate-600">{alert.alert_id}</p>
        </div>
        <span className={`flex-shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold ${riskBgClass(alert.risk_score)}`}>
          {alert.risk_score} — {riskLabel(alert.risk_score)}
        </span>
      </div>

      {/* Trigger signals */}
      <div className="mt-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Trigger Signals
        </p>
        <ul className="mt-1.5 space-y-1">
          {alert.trigger_signals.map((sig, i) => (
            <li key={i} className="flex items-start gap-2 text-xs leading-relaxed text-slate-400">
              <span
                className="mt-[5px] block h-1.5 w-1.5 flex-shrink-0 rounded-full"
                style={{ backgroundColor: accent }}
              />
              {sig}
            </li>
          ))}
        </ul>
      </div>

      {/* Explanation */}
      <div className="mt-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Analysis
        </p>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          {alert.explanation}
        </p>
      </div>

      {/* Regulatory citation */}
      {alert.regulatory_citation && (
        <div className="surface-inset mt-3 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Regulatory Reference
          </p>
          <p className="mt-0.5 text-xs font-medium text-slate-300">
            {alert.regulatory_citation.clause}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-600">
            {alert.regulatory_citation.source}
          </p>
        </div>
      )}

      {/* Timestamp */}
      <p className="mt-2 text-[10px] text-slate-600">
        {formatTimestamp(alert.timestamp)}
      </p>

      {/* Incident Report Trigger Button */}
      {onViewReport && alert.risk_score >= 60 && (
        <button
          onClick={() => onViewReport(alert.zone_id)}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-300 transition hover:bg-red-500/20 hover:text-white"
        >
          View Incident Report & Evacuation Plan
        </button>
      )}

      {/* Evacuation call-out */}
      {isEvac && (
        <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/[0.07] px-3 py-2.5">
          <p className="text-xs font-bold text-red-400">
            EVACUATION RECOMMENDED
          </p>
          <p className="mt-0.5 text-[10px] leading-relaxed text-red-400/70">
            Risk score has exceeded the evacuation threshold. Immediate zone
            clearance and incident response activation advised.
          </p>
        </div>
      )}
    </li>
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
