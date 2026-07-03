import type { TraceColorMode } from "../hooks/useMapLayers";

export interface MapTraceSample {
  x: number;
  y: number;
  speed: number;
  throttle: number;
  brake: number;
  drs: number;
  t: number;
}

const TRACE_WINDOW_S = 12;

export function traceColor(
  sample: MapTraceSample,
  mode: TraceColorMode,
): string {
  switch (mode) {
    case "throttle": {
      const v = Math.max(0, Math.min(100, sample.throttle));
      const g = Math.round(80 + (v / 100) * 175);
      return `rgb(40, ${g}, 60)`;
    }
    case "brake": {
      const v = Math.max(0, Math.min(100, sample.brake));
      const r = Math.round(80 + (v / 100) * 175);
      return `rgb(${r}, 50, 50)`;
    }
    case "drs":
      return sample.drs >= 10 ? "#00ff88" : "#555555";
    case "speed":
    default: {
      const v = Math.max(0, Math.min(380, sample.speed));
      const t = v / 380;
      const r = Math.round(80 + t * 120);
      const g = Math.round(100 + t * 100);
      const b = Math.round(200 - t * 150);
      return `rgb(${r}, ${g}, ${b})`;
    }
  }
}

export function trimTraceSamples(
  samples: MapTraceSample[],
  tNow: number,
): MapTraceSample[] {
  const cutoff = tNow - TRACE_WINDOW_S;
  return samples.filter((s) => s.t >= cutoff);
}

export { TRACE_WINDOW_S };
