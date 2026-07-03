import type { InterpolatedDriver, TrackData } from "../types";
import { isInDrsZone } from "./mapTrackMeta";
import type { TrackReference } from "./trackProjection";

export interface BattlePair {
  ahead: string;
  behind: string;
  interval: number;
  emphasize: boolean;
}

export interface DrsThreat {
  attacker: string;
  defender: string;
  interval: number;
}

const BATTLE_THRESHOLD_S = 1.0;
const DRS_RANGE_S = 1.0;

export function detectBattles(
  drivers: InterpolatedDriver[],
  selectedDriver: string | null,
): BattlePair[] {
  const sorted = [...drivers].sort((a, b) => a.position - b.position);
  const pairs: BattlePair[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const behind = sorted[i];
    const ahead = sorted[i - 1];
    const interval = behind.interval;
    if (interval == null || interval > BATTLE_THRESHOLD_S) continue;

    const emphasize =
      selectedDriver != null &&
      (behind.code === selectedDriver || ahead.code === selectedDriver);

    pairs.push({
      ahead: ahead.code,
      behind: behind.code,
      interval,
      emphasize,
    });
  }

  return pairs;
}

export function detectDrsThreats(
  drivers: InterpolatedDriver[],
  track: TrackData,
  ref: TrackReference,
  selectedDriver: string | null,
): DrsThreat[] {
  const sorted = [...drivers].sort((a, b) => a.position - b.position);
  const threats: DrsThreat[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const behind = sorted[i];
    const ahead = sorted[i - 1];
    const interval = behind.interval;
    if (interval == null || interval > DRS_RANGE_S) continue;
    if (!isInDrsZone(behind.rel_dist, track, ref)) continue;

    if (
      selectedDriver != null &&
      behind.code !== selectedDriver &&
      ahead.code !== selectedDriver
    ) {
      continue;
    }

    threats.push({
      attacker: behind.code,
      defender: ahead.code,
      interval,
    });
  }

  return threats;
}

export function findDriver(
  drivers: InterpolatedDriver[],
  code: string,
): InterpolatedDriver | undefined {
  return drivers.find((d) => d.code === code);
}
