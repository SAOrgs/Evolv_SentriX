// ---------------------------------------------------------------------------
// Risk-score to color mapping — tuned for dark backgrounds.
//
// Produces a smooth HSL gradient:  green (safe) -> amber (watch) -> red (critical)
// Two fill variants: a translucent tint for dark-bg zone fills and a vivid
// accent for borders, text, and glows.
// ---------------------------------------------------------------------------

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function lerp(t, a, b) {
  return a + (b - a) * t;
}

const STOPS = [
  //  score   hue   sat   light
  [0,    145,  55,   48],   // teal-green
  [25,   110,  58,   50],   // green
  [45,   52,   70,   54],   // amber
  [65,   30,   78,   52],   // orange
  [80,   12,   82,   52],   // red-orange
  [100,  0,    85,   50],   // red
];

function colorAt(score) {
  const s = clamp(score, 0, 100);
  let lo = STOPS[0];
  let hi = STOPS[STOPS.length - 1];
  for (let i = 0; i < STOPS.length - 1; i++) {
    if (s >= STOPS[i][0] && s <= STOPS[i + 1][0]) {
      lo = STOPS[i];
      hi = STOPS[i + 1];
      break;
    }
  }
  const t = hi[0] === lo[0] ? 0 : (s - lo[0]) / (hi[0] - lo[0]);
  return {
    h: lerp(t, lo[1], hi[1]),
    s: lerp(t, lo[2], hi[2]),
    l: lerp(t, lo[3], hi[3]),
  };
}

/** Translucent fill for zone backgrounds on a dark surface. */
export function riskFill(score) {
  const { h, s } = colorAt(score);
  const alpha = 0.10 + (clamp(score, 0, 100) / 100) * 0.15;
  return `hsla(${h}, ${Math.min(s + 10, 90)}%, 52%, ${alpha})`;
}

/** Vivid accent for borders, text, and glows. */
export function riskAccent(score) {
  const { h, s, l } = colorAt(score);
  return `hsl(${h}, ${Math.min(s + 10, 90)}%, ${l + 6}%)`;
}

/** Subtle glow shadow for high-risk zones. */
export function riskGlow(score) {
  if (score < 40) return "none";
  const { h, s } = colorAt(score);
  const intensity = (clamp(score, 40, 100) - 40) / 60; // 0 → 1
  const blur = 6 + intensity * 16;
  const alpha = 0.12 + intensity * 0.30;
  return `0 0 ${blur}px hsla(${h}, ${s}%, 50%, ${alpha})`;
}

/** CSS filter glow for SVG elements. */
export function riskFilterGlow(score) {
  if (score < 50) return "none";
  const intensity = (clamp(score, 50, 100) - 50) / 50;
  const blur = 2 + intensity * 6;
  return `drop-shadow(0 0 ${blur}px ${riskAccent(score)})`;
}

/** Plain-language label. */
export function riskLabel(score) {
  if (score < 30) return "Normal";
  if (score < 60) return "Elevated";
  if (score < 80) return "High";
  return "Critical";
}

/** Tailwind-compatible text class. */
export function riskTextClass(score) {
  if (score < 30) return "text-emerald-400";
  if (score < 60) return "text-amber-400";
  if (score < 80) return "text-orange-400";
  return "text-red-400";
}

/** Badge classes for dark backgrounds. */
export function riskBgClass(score) {
  if (score < 30) return "bg-emerald-500/15 text-emerald-400";
  if (score < 60) return "bg-amber-500/15 text-amber-400";
  if (score < 80) return "bg-orange-500/15 text-orange-400";
  return "bg-red-500/15 text-red-400";
}
