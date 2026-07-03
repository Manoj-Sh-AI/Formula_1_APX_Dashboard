import type { InterpolatedDriver } from "../types";

/** Match desktop leaderboard gap formula (ui_components._calculate_gaps). */
const METERS_PER_PROGRESS_UNIT = 10;
const REF_SPEED_MPS = 55.56;

export interface DriverGapInfo {
  gapToLeader: number | null;
  interval: number | null;
  carAhead: string | null;
}

export function computeRaceDist(driver: InterpolatedDriver & { dist?: number }): number {
  if (driver.dist != null && driver.dist > 0) {
    return driver.dist;
  }
  return (driver.lap - 1 + driver.rel_dist) * 1000;
}

export function formatGapSeconds(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds <= 0.05) return "LEAD";
  if (seconds >= 60) {
    const laps = Math.floor(seconds / 60);
    const rem = seconds - laps * 60;
    return `+${laps}L ${rem.toFixed(1)}s`;
  }
  return `+${seconds.toFixed(1)}s`;
}

export function formatInterval(seconds: number | null, carAhead: string | null): string {
  if (seconds == null || !carAhead) return "—";
  if (seconds <= 0.05) return "LEAD";
  return `+${seconds.toFixed(1)}s`;
}

export function computeGapsForDrivers(
  drivers: (InterpolatedDriver & { dist?: number })[],
): Record<string, DriverGapInfo> {
  const sorted = [...drivers].sort((a, b) => a.position - b.position);
  const result: Record<string, DriverGapInfo> = {};

  if (sorted.length === 0) return result;

  const leaderDist = computeRaceDist(sorted[0]);

  for (let i = 0; i < sorted.length; i++) {
    const d = sorted[i];
    const dist = computeRaceDist(d);

    let gapToLeader: number | null = null;
    let interval: number | null = null;
    let carAhead: string | null = null;

    if (i === 0) {
      gapToLeader = 0;
    } else {
      const rawLeader = Math.abs(leaderDist - dist);
      gapToLeader = rawLeader / METERS_PER_PROGRESS_UNIT / REF_SPEED_MPS;

      const ahead = sorted[i - 1];
      carAhead = ahead.code;
      const rawInterval = Math.abs(dist - computeRaceDist(ahead));
      interval = rawInterval / METERS_PER_PROGRESS_UNIT / REF_SPEED_MPS;
    }

    result[d.code] = { gapToLeader, interval, carAhead };
  }

  return result;
}
