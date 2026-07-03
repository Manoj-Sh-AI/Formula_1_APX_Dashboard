import type { QualifyingResult } from "../types";

export function resolveQualiSegment(
  result: QualifyingResult | undefined,
): "Q1" | "Q2" | "Q3" | null {
  if (!result) return null;
  if (result.Q3) return "Q3";
  if (result.Q2) return "Q2";
  if (result.Q1) return "Q1";
  return null;
}

export function resolvePoleSegment(
  results: QualifyingResult[] | undefined,
): { driver: string; segment: "Q1" | "Q2" | "Q3" } | null {
  if (!results?.length) return null;
  const pole = results[0];
  const segment = resolveQualiSegment(pole);
  if (!segment) return null;
  return { driver: pole.code, segment };
}

export function bestQualiTime(result: QualifyingResult): number | null {
  for (const key of ["Q3", "Q2", "Q1"] as const) {
    const raw = result[key];
    if (!raw) continue;
    const sec = parseFloat(raw);
    if (!Number.isNaN(sec)) return sec;
  }
  return null;
}

export function formatPoleDelta(
  driverLap?: number,
  poleLap?: number,
): string | null {
  if (driverLap == null || poleLap == null) return null;
  const delta = driverLap - poleLap;
  if (Math.abs(delta) < 0.001) return "POLE";
  return delta > 0 ? `+${delta.toFixed(3)}` : delta.toFixed(3);
}
