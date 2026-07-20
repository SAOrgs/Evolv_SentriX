import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import { getRiskScoreHistory } from "../api/client";
import { riskAccent } from "../utils/riskColor";

const ALERT_THRESHOLD = 70;
const EVAC_THRESHOLD = 90;
const POLL_MS = 2000;

export default function RiskTimeline({ zoneId, zoneName }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    if (!zoneId) {
      setData([]);
      return;
    }

    let cancelled = false;

    async function fetch() {
      try {
        const history = await getRiskScoreHistory(zoneId, 4);
        if (cancelled) return;
        setData(
          history.map((pt) => ({
            risk_score: pt.risk_score,
            timestamp: pt.timestamp,
            time: formatTime(pt.timestamp),
          }))
        );
      } catch (err) {
        console.error("Timeline fetch error:", err);
      }
    }

    fetch();
    const id = setInterval(fetch, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [zoneId]);

  if (!zoneId) {
    return (
      <div className="surface flex h-full items-center justify-center">
        <p className="text-xs text-slate-600">
          Select a zone on the floorplan to view its risk history
        </p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="surface flex h-full flex-col p-4">
        <Header zoneName={zoneName} />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-xs text-slate-600">
            No history yet — advance the simulation
          </p>
        </div>
      </div>
    );
  }

  const latestScore = data[data.length - 1]?.risk_score ?? 0;
  const lineColor = riskAccent(latestScore);

  return (
    <div className="surface flex h-full flex-col p-4">
      <Header zoneName={zoneName} latestScore={latestScore} />

      <div className="mt-2 flex-1" style={{ minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
            {/* Gradient fill under the line */}
            <defs>
              <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={lineColor} stopOpacity={0.20} />
                <stop offset="100%" stopColor={lineColor} stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />

            <XAxis
              dataKey="time"
              tick={{ fontSize: 9, fill: "#475569" }}
              axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 70, 90, 100]}
              tick={{ fontSize: 9, fill: "#475569" }}
              axisLine={false}
              tickLine={false}
              width={28}
            />

            <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(255,255,255,0.08)" }} />

            {/* Danger bands */}
            <ReferenceArea y1={ALERT_THRESHOLD} y2={EVAC_THRESHOLD} fill="#f59e0b" fillOpacity={0.04} ifOverflow="hidden" />
            <ReferenceArea y1={EVAC_THRESHOLD} y2={100} fill="#ef4444" fillOpacity={0.06} ifOverflow="hidden" />

            {/* Threshold lines */}
            <ReferenceLine
              y={ALERT_THRESHOLD}
              stroke="#d97706" strokeWidth={1} strokeDasharray="6 3" strokeOpacity={0.5}
              label={{ value: "Alert", position: "insideTopRight", fontSize: 8, fill: "#d97706" }}
            />
            <ReferenceLine
              y={EVAC_THRESHOLD}
              stroke="#dc2626" strokeWidth={1} strokeDasharray="6 3" strokeOpacity={0.5}
              label={{ value: "Evacuation", position: "insideTopRight", fontSize: 8, fill: "#dc2626" }}
            />

            {/* Risk score area + line */}
            <Area
              type="monotone"
              dataKey="risk_score"
              stroke={lineColor}
              strokeWidth={2}
              fill="url(#areaFill)"
              animationDuration={300}
              dot={<ThresholdDot />}
              activeDot={{ r: 5, stroke: lineColor, strokeWidth: 2, fill: "#0a1020" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function Header({ zoneName, latestScore }) {
  return (
    <div className="flex items-baseline justify-between">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
          Risk Timeline
        </p>
        <p className="text-sm font-semibold text-slate-200">
          {zoneName || "—"}
        </p>
      </div>
      {latestScore !== undefined && (
        <span className="text-xl font-bold" style={{ color: riskAccent(latestScore) }}>
          {latestScore}
        </span>
      )}
    </div>
  );
}

function ThresholdDot(props) {
  const { cx, cy, payload } = props;
  if (!payload) return null;
  const score = payload.risk_score;

  if (score >= EVAC_THRESHOLD) {
    return (
      <>
        <circle cx={cx} cy={cy} r={7} fill="#dc2626" opacity={0.15} />
        <circle cx={cx} cy={cy} r={4} fill="#dc2626" stroke="#0a1020" strokeWidth={2} />
      </>
    );
  }
  if (score >= ALERT_THRESHOLD) {
    return (
      <>
        <circle cx={cx} cy={cy} r={6} fill="#d97706" opacity={0.12} />
        <circle cx={cx} cy={cy} r={3.5} fill="#d97706" stroke="#0a1020" strokeWidth={2} />
      </>
    );
  }
  return null;
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-white/[0.08] bg-[#0c1528]/90 px-3 py-2 text-xs shadow-xl backdrop-blur-md">
      <p className="text-slate-500">{d.time}</p>
      <p className="mt-0.5 font-semibold" style={{ color: riskAccent(d.risk_score) }}>
        Risk Score: {d.risk_score}
      </p>
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
