import type { QualiComparisonTrace, QualiGhostDriver } from "../types";

export interface TelemetrySeriesData {
  xs: number[];
  speeds: number[];
  gears: number[];
  throttles: number[];
  brakes: number[];
  xMin: number;
  xMax: number;
}

/** Slice a full qualifying trace to the current playback frame index. */
export function traceToSeries(
  trace: QualiComparisonTrace,
  circuitLengthM: number | null,
  endIndex: number,
): TelemetrySeriesData {
  const length = circuitLengthM ?? 5000;
  const end = Math.min(Math.max(endIndex, 0), trace.rel_dist.length);
  const relDist = trace.rel_dist.slice(0, end);
  return {
    xs: relDist.map((rd) => rd * length),
    speeds: trace.speeds.slice(0, end),
    gears: trace.gears.slice(0, end),
    throttles: trace.throttles.slice(0, end),
    brakes: trace.brakes.slice(0, end),
    xMin: 0,
    xMax: length,
  };
}

/** Build primary and pole-comparison series aligned to playback frame index. */
export function buildQualiChartSeries(
  activeTrace: QualiComparisonTrace | null | undefined,
  comparisonTrace: QualiComparisonTrace | null | undefined,
  frameIndex: number,
  circuitLengthM: number | null,
): {
  series: TelemetrySeriesData | null;
  comparison: TelemetrySeriesData | null;
} {
  if (!activeTrace?.rel_dist.length) {
    return { series: null, comparison: null };
  }

  const end = Math.floor(frameIndex) + 1;
  const series = traceToSeries(activeTrace, circuitLengthM, end);
  const comparison = comparisonTrace
    ? traceToSeries(comparisonTrace, circuitLengthM, end)
    : null;

  return { series, comparison };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Pole-position ghost car at the current playback frame index. */
export function interpolateQualiGhost(
  trace: QualiComparisonTrace | null | undefined,
  frameIndex: number,
): QualiGhostDriver | null {
  if (!trace?.x?.length || !trace?.y?.length) return null;

  const idx = Math.floor(frameIndex);
  const alpha = frameIndex - idx;
  const i0 = Math.min(Math.max(idx, 0), trace.x.length - 1);
  const i1 = Math.min(i0 + 1, trace.x.length - 1);

  return {
    code: trace.driver,
    segment: trace.segment,
    x: lerp(trace.x[i0], trace.x[i1], alpha),
    y: lerp(trace.y[i0], trace.y[i1], alpha),
  };
}
