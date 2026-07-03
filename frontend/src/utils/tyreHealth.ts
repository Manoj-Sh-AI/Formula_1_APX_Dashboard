import { remapTyre } from "./tyreColors";

/** Degradation factor per lap by compound (seconds/lap proxy for health decay). */
const DEG_PER_LAP: Record<number, number> = {
  1: 5.0,
  2: 3.5,
  3: 2.0,
  4: 2.5,
  5: 1.5,
};

export function estimateTyreHealth(tyreRaw: number, tyreLife: number): number {
  const tyre = remapTyre(tyreRaw);
  const deg = DEG_PER_LAP[tyre] ?? 4;
  return Math.max(0, Math.min(100, Math.round(100 - tyreLife * deg)));
}

export function tyreHealthClass(health: number): string {
  if (health >= 75) return "health-good";
  if (health >= 50) return "health-warn";
  if (health >= 25) return "health-low";
  return "health-critical";
}

export function tyreHealthLabel(health: number): string {
  if (health >= 75) return "Fresh";
  if (health >= 50) return "Wearing";
  if (health >= 25) return "Cliff";
  return "Critical";
}
