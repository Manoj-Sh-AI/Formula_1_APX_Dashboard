import type { TrackData } from "../types";

export interface TrackReference {
  xs: Float64Array;
  ys: Float64Array;
  cumDist: Float64Array;
  totalLength: number;
}

/** Match race_replay.py _interpolate_points + cumulative distance build (4000 pts). */
export function buildTrackReference(
  centerX: number[],
  centerY: number[],
  interpPoints = 4000,
): TrackReference {
  const n = centerX.length;
  if (n < 2) {
    return {
      xs: new Float64Array(0),
      ys: new Float64Array(0),
      cumDist: new Float64Array(0),
      totalLength: 0,
    };
  }

  const xs = new Float64Array(interpPoints);
  const ys = new Float64Array(interpPoints);

  for (let i = 0; i < interpPoints; i++) {
    const t = i / (interpPoints - 1);
    const idx = t * (n - 1);
    const i0 = Math.floor(idx);
    const i1 = Math.min(i0 + 1, n - 1);
    const f = idx - i0;
    xs[i] = centerX[i0] * (1 - f) + centerX[i1] * f;
    ys[i] = centerY[i0] * (1 - f) + centerY[i1] * f;
  }

  const cumDist = new Float64Array(interpPoints);
  for (let i = 1; i < interpPoints; i++) {
    cumDist[i] =
      cumDist[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
  }

  return {
    xs,
    ys,
    cumDist,
    totalLength: cumDist[interpPoints - 1],
  };
}

/** Match race_replay.py _project_to_reference (KD-tree nearest + segment projection). */
export function projectToReference(
  x: number,
  y: number,
  ref: TrackReference,
): number {
  if (ref.totalLength === 0 || ref.xs.length === 0) return 0;

  let bestIdx = 0;
  let bestDist2 = Infinity;
  for (let i = 0; i < ref.xs.length; i++) {
    const dx = ref.xs[i] - x;
    const dy = ref.ys[i] - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestDist2) {
      bestDist2 = d2;
      bestIdx = i;
    }
  }

  if (bestIdx < ref.xs.length - 1) {
    const x1 = ref.xs[bestIdx];
    const y1 = ref.ys[bestIdx];
    const x2 = ref.xs[bestIdx + 1];
    const y2 = ref.ys[bestIdx + 1];
    const vx = x2 - x1;
    const vy = y2 - y1;
    const segLen2 = vx * vx + vy * vy;
    if (segLen2 > 0) {
      const t = Math.max(
        0,
        Math.min(1, ((x - x1) * vx + (y - y1) * vy) / segLen2),
      );
      const projX = x1 + t * vx;
      const projY = y1 + t * vy;
      const segDist = Math.hypot(projX - x1, projY - y1);
      return ref.cumDist[bestIdx] + segDist;
    }
  }

  return ref.cumDist[bestIdx];
}

/** World XY on lap centerline at rel_dist (0–1), matching race_replay progress projection. */
export function referencePointAtRelDist(
  relDist: number,
  ref: TrackReference,
): [number, number] {
  const clamped = Math.max(0, Math.min(1, relDist));
  return referencePointAtDistance(clamped * ref.totalLength, ref);
}

export function referencePointAtDistance(
  dist: number,
  ref: TrackReference,
): [number, number] {
  if (ref.xs.length === 0) return [0, 0];

  const target = Math.max(0, Math.min(ref.totalLength, dist));
  let lo = 0;
  let hi = ref.cumDist.length - 1;

  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (ref.cumDist[mid] <= target) lo = mid;
    else hi = mid;
  }

  const i1 = Math.min(lo + 1, ref.xs.length - 1);
  const d0 = ref.cumDist[lo];
  const d1 = ref.cumDist[i1];
  const t = d1 > d0 ? (target - d0) / (d1 - d0) : 0;

  return [
    ref.xs[lo] + (ref.xs[i1] - ref.xs[lo]) * t,
    ref.ys[lo] + (ref.ys[i1] - ref.ys[lo]) * t,
  ];
}

function lateralOffset(
  x: number,
  y: number,
  relDist: number,
  ref: TrackReference,
): [number, number] {
  const [rx, ry] = referencePointAtRelDist(relDist, ref);
  return [x - rx, y - ry];
}

/**
 * Smooth map position: interpolate along-track via rel_dist, preserve lateral grid/racing line offset.
 * Matches original race_replay.py (discrete frame XY + progress ranking) without jump-snap flicker.
 */
export function interpolateDriverMapPosition(
  prev: { x: number; y: number; rel_dist: number },
  src: { x: number; y: number; rel_dist: number },
  alpha: number,
  ref: TrackReference,
): [number, number] {
  const relDist = prev.rel_dist + (src.rel_dist - prev.rel_dist) * alpha;
  const [rx, ry] = referencePointAtRelDist(relDist, ref);

  const [offPrevX, offPrevY] = lateralOffset(prev.x, prev.y, prev.rel_dist, ref);
  const [offSrcX, offSrcY] = lateralOffset(src.x, src.y, src.rel_dist, ref);
  const offX = offPrevX + (offSrcX - offPrevX) * alpha;
  const offY = offPrevY + (offSrcY - offPrevY) * alpha;

  return [rx + offX, ry + offY];
}

/** progress_m = (lap - 1) * lap_length + projected_m — same as race_replay.py on_draw. */
export function computeProgressM(
  x: number,
  y: number,
  lap: number,
  ref: TrackReference,
): number {
  const projected = projectToReference(x, y, ref);
  return (Math.max(lap, 1) - 1) * ref.totalLength + projected;
}

export function buildTrackReferenceFromTrack(track: TrackData): TrackReference {
  return buildTrackReference(track.x, track.y);
}

export interface RankableDriver {
  code: string;
  x: number;
  y: number;
  lap: number;
  rel_dist?: number;
  in_pit: boolean;
  speed: number;
  gear: number;
  drs: number;
  throttle: number;
  brake: number;
  tyre: number;
}

/** Re-rank drivers by projected along-track progress (matches original replay leaderboard). */
export function rankDriversByProgress<T extends RankableDriver>(
  drivers: T[],
  ref: TrackReference,
): (T & { position: number; progressM: number })[] {
  const withProgress = drivers.map((d) => ({
    ...d,
    progressM: computeProgressM(d.x, d.y, d.lap, ref),
  }));

  withProgress.sort((a, b) => b.progressM - a.progressM);

  return withProgress.map((d, i) => ({
    ...d,
    position: i + 1,
  }));
}

export function findLeaderCode(
  drivers: { code: string; progressM: number }[],
): string | null {
  if (drivers.length === 0) return null;
  return drivers.reduce((a, b) => (a.progressM >= b.progressM ? a : b)).code;
}
