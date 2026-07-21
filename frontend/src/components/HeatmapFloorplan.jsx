import { useState, useRef, useCallback } from "react";
import { riskFill, riskAccent, riskGlow } from "../utils/riskColor";

// ---------------------------------------------------------------------------
const VB_W = 620;
const VB_H = 560;

const PATHWAYS = [
  { x1: 200, y1: 200, x2: 200, y2: 260 },
  { x1: 200, y1: 200, x2: 280, y2: 260 },
  { x1: 410, y1: 160, x2: 500, y2: 240 },
  { x1: 280, y1: 400, x2: 210, y2: 420 },
  { x1: 500, y1: 370, x2: 360, y2: 420 },
  { x1: 60,  y1: 460, x2: 360, y2: 460 },
];

// ---------------------------------------------------------------------------

export default function HeatmapFloorplan({
  zones,
  riskScores,
  permits,
  selectedZoneId,
  onZoneSelect,
}) {
  const [hoveredZoneId, setHoveredZoneId] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  const scoreMap = {};
  for (const rs of riskScores) scoreMap[rs.zone_id] = rs.risk_score;

  const permitMap = {};
  for (const p of permits) {
    if (!permitMap[p.zone_id]) permitMap[p.zone_id] = [];
    permitMap[p.zone_id].push(p);
  }

  const handleMouseMove = useCallback((e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  const hoveredZone = hoveredZoneId
    ? zones.find((z) => z.zone_id === hoveredZoneId)
    : null;
  const hoveredScore = hoveredZoneId ? (scoreMap[hoveredZoneId] ?? 0) : 0;
  const hoveredPermits = hoveredZoneId ? (permitMap[hoveredZoneId] || []) : [];

  return (
    <div ref={containerRef} className="relative select-none" onMouseMove={handleMouseMove}>
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="h-auto w-full" style={{ maxHeight: "460px" }}>
        {/* Dark background */}
        <rect width={VB_W} height={VB_H} fill="#0a1020" rx="6" />

        {/* Subtle grid dots */}
        <pattern id="grid-dot" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="12" cy="12" r="0.5" fill="rgba(255,255,255,0.04)" />
        </pattern>
        <rect width={VB_W} height={VB_H} fill="url(#grid-dot)" rx="6" />

        {/* Plant perimeter */}
        <rect
          x="30" y="30"
          width={VB_W - 60} height={VB_H - 60}
          rx="4" fill="none"
          stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="6 4"
        />
        <text x="50" y="24" fontSize="8" fill="rgba(255,255,255,0.15)" fontFamily="sans-serif" letterSpacing="1">
          PLANT BOUNDARY
        </text>

        {/* Pathways */}
        {PATHWAYS.map((p, i) => (
          <line
            key={i}
            x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2}
            stroke="rgba(255,255,255,0.04)" strokeWidth="3" strokeLinecap="round"
          />
        ))}

        {/* SVG filter for glow */}
        <defs>
          <filter id="zone-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" />
          </filter>
        </defs>

        {/* Zones */}
        {zones.map((zone) => {
          const score = scoreMap[zone.zone_id] ?? 0;
          const isSelected = zone.zone_id === selectedZoneId;
          const isHovered = zone.zone_id === hoveredZoneId;
          const zonePermits = permitMap[zone.zone_id] || [];

          return (
            <g
              key={zone.zone_id}
              onClick={() => onZoneSelect(zone.zone_id)}
              onMouseEnter={() => setHoveredZoneId(zone.zone_id)}
              onMouseLeave={() => setHoveredZoneId(null)}
              style={{ cursor: "pointer" }}
            >
              {/* Glow layer behind zone (only for elevated risk) */}
              {score >= 40 && (
                <rect
                  x={zone.x - 4} y={zone.y - 4}
                  width={zone.width + 8} height={zone.height + 8}
                  rx="6" fill={riskAccent(score)}
                  opacity={0.08 + (score / 100) * 0.12}
                  filter="url(#zone-glow)"
                />
              )}

              {/* Zone rectangle */}
              <rect
                x={zone.x} y={zone.y}
                width={zone.width} height={zone.height}
                rx="4"
                fill={riskFill(score)}
                stroke={isSelected ? "rgba(255,255,255,0.5)" : riskAccent(score)}
                strokeWidth={isSelected ? 2 : isHovered ? 1.5 : 0.8}
                style={{
                  transition: "fill 0.5s ease, stroke 0.3s ease, stroke-width 0.15s ease",
                }}
              />

              {/* Zone name */}
              <text
                x={zone.x + zone.width / 2}
                y={zone.y + zone.height / 2 - 12}
                textAnchor="middle"
                fontSize="10"
                fontWeight="500"
                fontFamily="sans-serif"
                fill="rgba(255,255,255,0.55)"
                letterSpacing="0.3"
              >
                {zone.name}
              </text>

              {/* Risk score */}
              <text
                x={zone.x + zone.width / 2}
                y={zone.y + zone.height / 2 + 12}
                textAnchor="middle"
                fontSize="22"
                fontWeight="700"
                fontFamily="sans-serif"
                fill={riskAccent(score)}
                style={{ transition: "fill 0.5s ease" }}
              >
                {score}
              </text>

              {/* Permit badges */}
              {zonePermits.map((permit, i) => {
                const bx = zone.x + zone.width - 8;
                const by = zone.y + 12 + i * 16;
                return (
                  <g key={permit.permit_id}>
                    <rect
                      x={bx - 50} y={by - 9}
                      width="52" height="14" rx="3"
                      fill="rgba(255,255,255,0.06)"
                      stroke="rgba(255,255,255,0.08)" strokeWidth="0.5"
                    />
                    <text
                      x={bx - 24} y={by + 1}
                      textAnchor="middle"
                      fontSize="7" fontFamily="sans-serif"
                      fill="rgba(255,255,255,0.45)"
                    >
                      {permit.type}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* Legend bar */}
        <defs>
          <linearGradient id="risk-gradient" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%"   stopColor={riskAccent(0)} />
            <stop offset="30%"  stopColor={riskAccent(30)} />
            <stop offset="60%"  stopColor={riskAccent(60)} />
            <stop offset="100%" stopColor={riskAccent(100)} />
          </linearGradient>
        </defs>
        <rect x={VB_W - 180} y={VB_H - 34} width="140" height="6" rx="3" fill="url(#risk-gradient)" opacity="0.7" />
        <text x={VB_W - 180} y={VB_H - 12} fontSize="7" fill="rgba(255,255,255,0.25)" fontFamily="sans-serif">0 Safe</text>
        <text x={VB_W - 40}  y={VB_H - 12} fontSize="7" fill="rgba(255,255,255,0.25)" fontFamily="sans-serif" textAnchor="end">Critical 100</text>
      </svg>

      {/* Tooltip */}
      {hoveredZone && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-white/[0.08] bg-[#0c1528]/90 px-3 py-2.5 text-xs shadow-xl backdrop-blur-md"
          style={{
            left: Math.min(tooltipPos.x + 14, (containerRef.current?.offsetWidth || 400) - 210),
            top: tooltipPos.y - 4,
            maxWidth: 220,
          }}
        >
          <p className="font-semibold text-slate-200">{hoveredZone.name}</p>
          <p className="mt-0.5 text-slate-400">
            Risk Score:{" "}
            <span className="font-semibold" style={{ color: riskAccent(hoveredScore) }}>
              {hoveredScore}
            </span>
          </p>
          {hoveredPermits.length > 0 && (
            <div className="mt-1.5 border-t border-white/[0.06] pt-1.5">
              <p className="font-medium text-slate-300">Active Permits:</p>
              {hoveredPermits.map((p) => (
                <p key={p.permit_id} className="text-slate-500">
                  {p.type} ({p.permit_id})
                  {p.type === "Hot Work" ? " -- no fire watch logged" : ""}
                </p>
              ))}
            </div>
          )}
          <p className="mt-1.5 text-slate-600">Click to inspect</p>
        </div>
      )}
    </div>
  );
}
