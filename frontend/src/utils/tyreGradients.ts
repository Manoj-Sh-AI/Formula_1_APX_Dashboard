import { remapTyre, TYRE_COLORS } from "./tyreColors";

function adjustHex(hex: string, factor: number): string {
  const h = hex.replace("#", "");
  const r = Math.min(255, Math.round(parseInt(h.slice(0, 2), 16) * factor));
  const g = Math.min(255, Math.round(parseInt(h.slice(2, 4), 16) * factor));
  const b = Math.min(255, Math.round(parseInt(h.slice(4, 6), 16) * factor));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/** CSS gradient matching original QLinearGradient (lighter 130%, darker 70%). */
export function tyreGradientCss(rawTyre: number): string {
  const mapped = remapTyre(rawTyre);
  const info = TYRE_COLORS[mapped] ?? TYRE_COLORS[0];
  const base = info.hex;
  const lighter = adjustHex(base, 1.3);
  const darker = adjustHex(base, 0.7);
  return `linear-gradient(180deg, ${lighter} 0%, ${base} 50%, ${darker} 100%)`;
}

export function tyreTextColor(rawTyre: number): string {
  const mapped = remapTyre(rawTyre);
  return mapped === 2 || mapped === 3 ? "#000" : "#fff";
}
