import type { InterpolatedDriver } from "../types";
import { computeRaceDist } from "./gaps";

/** Conservative default pit loss (seconds) when session-specific data unavailable. */
export const DEFAULT_PIT_LOSS_S = 22;

export interface PitRejoinEstimate {
  /** Projected race-distance units after pit stop. */
  projectedDist: number;
  /** Estimated rejoin position (1-based). */
  rejoinPosition: number;
  /** Driver code that would be ahead after rejoin, if any. */
  carAhead: string | null;
  /** Gap to car ahead after rejoin (seconds, approximate). */
  gapAhead: number | null;
  pitLossSeconds: number;
}

/**
 * Estimate where selected driver rejoins after a pit stop using current field snapshot.
 */
export function estimatePitRejoin(
  selected: InterpolatedDriver,
  drivers: InterpolatedDriver[],
  pitLossSeconds = DEFAULT_PIT_LOSS_S,
  refSpeedMps = 55.56,
  metersPerProgressUnit = 10,
): PitRejoinEstimate {
  const distLoss = pitLossSeconds * refSpeedMps * metersPerProgressUnit;
  const currentDist = computeRaceDist(selected);
  const projectedDist = currentDist - distLoss;

  const sorted = [...drivers]
    .filter((d) => d.code !== selected.code)
    .sort((a, b) => computeRaceDist(b) - computeRaceDist(a));

  let rejoinPosition = 1;
  let carAhead: string | null = null;

  for (const d of sorted) {
    if (computeRaceDist(d) > projectedDist) {
      rejoinPosition++;
      carAhead = d.code;
    } else {
      break;
    }
  }

  rejoinPosition = Math.min(rejoinPosition, sorted.length + 1);

  let gapAhead: number | null = null;
  if (carAhead) {
    const ahead = sorted.find((d) => d.code === carAhead);
    if (ahead) {
      gapAhead =
        (computeRaceDist(ahead) - projectedDist) /
        metersPerProgressUnit /
        refSpeedMps;
    }
  }

  return {
    projectedDist,
    rejoinPosition,
    carAhead,
    gapAhead,
    pitLossSeconds,
  };
}
