import { riskAccent, riskLabel, riskBgClass, riskGlow } from "../utils/riskColor";

export default function ZoneDetailPanel({ zone, score, permits, onClose }) {
  if (!zone) return null;

  return (
    <div className="flex h-full flex-col border-l border-white/[0.06] bg-[#080e1e]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-200">{zone.name}</h3>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-300"
          aria-label="Close panel"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {/* Risk score */}
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
            Risk Score
          </p>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span
              className="text-3xl font-bold"
              style={{ color: riskAccent(score), textShadow: score >= 60 ? riskGlow(score) : "none" }}
            >
              {score}
            </span>
            <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${riskBgClass(score)}`}>
              {riskLabel(score)}
            </span>
          </div>
          {/* Mini bar */}
          <div className="mt-2.5 h-1 w-full rounded-full bg-white/[0.06]">
            <div
              className="h-1 rounded-full transition-all duration-700"
              style={{
                width: `${score}%`,
                backgroundColor: riskAccent(score),
                boxShadow: score >= 50 ? riskGlow(score) : "none",
              }}
            />
          </div>
        </div>

        {/* Zone ID */}
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
            Zone ID
          </p>
          <p className="mt-0.5 font-mono text-xs text-slate-400">{zone.zone_id}</p>
        </div>

        {/* Coordinates */}
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
            Floorplan Position
          </p>
          <p className="mt-0.5 font-mono text-[10px] text-slate-600">
            x:{zone.x} y:{zone.y} w:{zone.width} h:{zone.height}
          </p>
        </div>

        {/* Active permits */}
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
            Active Permits ({permits.length})
          </p>
          {permits.length === 0 ? (
            <p className="mt-1 text-xs text-slate-600">None</p>
          ) : (
            <ul className="mt-1.5 space-y-2">
              {permits.map((p) => (
                <li
                  key={p.permit_id}
                  className="surface-inset rounded-lg px-3 py-2"
                >
                  <p className="text-xs font-medium text-slate-300">{p.type}</p>
                  <p className="font-mono text-[10px] text-slate-600">{p.permit_id}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    {formatTime(p.start_time)} - {formatTime(p.end_time)}
                  </p>
                  {p.type === "Hot Work" && (
                    <p className="mt-1 text-[10px] font-medium text-amber-400">
                      Fire watch: not logged
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Timeline link */}
        <div className="border-t border-white/[0.06] pt-3">
          <button className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs font-medium text-slate-400 transition hover:bg-white/[0.06] hover:text-slate-200">
            View Timeline
          </button>
        </div>
      </div>
    </div>
  );
}

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}
