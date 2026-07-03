/** Chart channel colors aligned with pit-wall tokens */
export const CHART_COLORS = {
  speed: "#eef0f4",
  gear: "#b4bac6",
  throttle: "#00d26a",
  brake: "#ff3b3b",
  pole: "#ffd700",
  grid: "rgba(255,255,255,0.08)",
  axis: "rgba(255,255,255,0.35)",
  label: "rgba(255,255,255,0.55)",
} as const;

/** Tyre compound mapping from original tyre_strategy_window.py */

export const TYRE_REMAP: Record<number, number> = {
  0: 1, // Soft
  1: 2, // Medium
  2: 3, // Hard
  3: 4, // Inter
  4: 5, // Wet
};

export const TYRE_COLORS: Record<number, { hex: string; abbr: string; name: string }> = {
  0: { hex: "#888888", abbr: "?", name: "Unknown" },
  1: { hex: "#E8002D", abbr: "S", name: "Soft" },
  2: { hex: "#FFF200", abbr: "M", name: "Medium" },
  3: { hex: "#CACACA", abbr: "H", name: "Hard" },
  4: { hex: "#39B54A", abbr: "I", name: "Inter" },
  5: { hex: "#0067FF", abbr: "W", name: "Wet" },
  6: { hex: "#888888", abbr: "?", name: "Unknown" },
};

export function remapTyre(raw: number): number {
  return TYRE_REMAP[Math.round(raw)] ?? Math.round(raw);
}

export function tyreInfo(raw: number) {
  const mapped = remapTyre(raw);
  return TYRE_COLORS[mapped] ?? TYRE_COLORS[0];
}

export interface TyreStint {
  tyre: number;
  start_lap: number;
  end_lap: number | null;
}
