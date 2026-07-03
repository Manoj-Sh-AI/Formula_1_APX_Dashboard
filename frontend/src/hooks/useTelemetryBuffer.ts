import { useCallback, useEffect, useRef, useState } from "react";
import type { RaceFrame } from "../types";
import { expandSlimFrame } from "../utils/frames";
import { trimTraceSamples, type MapTraceSample } from "../utils/mapTrace";
import { remapTyre } from "../utils/tyreColors";

export interface TelemetrySample {
  t: number;
  speed: number;
  gear: number;
  throttle: number;
  brake: number;
}

export interface LapSample extends Omit<TelemetrySample, "t"> {
  dist: number;
}

export type XMode = "time" | "lap";

const TIME_WINDOW = 30;
const PLAYBACK_FPS = 25;
const LAP_LOOKBACK_FRAMES = 2500;

function clearAllBuffers(
  timeBuffers: { current: Map<string, TelemetrySample[]> },
  lapBuffers: {
    current: Map<
      string,
      { lap: number | null; startDist: number; samples: LapSample[] }
    >;
  },
  lapLengths: { current: Map<string, number> },
  mapTraceBuffers?: { current: Map<string, MapTraceSample[]> },
) {
  timeBuffers.current.clear();
  lapBuffers.current.clear();
  lapLengths.current.clear();
  mapTraceBuffers?.current.clear();
}

function lapDistance(
  driver: { rel_dist: number },
  circuitLengthM: number | null,
): number {
  const length = circuitLengthM ?? 5000;
  return driver.rel_dist * length;
}

function ingestFrame(
  frame: RaceFrame,
  sessionT: number,
  circuitLengthM: number | null,
  timeBuffers: Map<string, TelemetrySample[]>,
  lapBuffers: Map<
    string,
    { lap: number | null; startDist: number; samples: LapSample[] }
  >,
  lapLengths: Map<string, number>,
  mapTraceBuffers?: Map<string, MapTraceSample[]>,
) {
  for (const [code, driver] of Object.entries(frame.drivers)) {
    if (!timeBuffers.has(code)) {
      timeBuffers.set(code, []);
    }
    if (!lapBuffers.has(code)) {
      lapBuffers.set(code, {
        lap: null,
        startDist: 0,
        samples: [],
      });
    }

    const dist = lapDistance(driver, circuitLengthM);

    const sample: TelemetrySample = {
      t: sessionT,
      speed: driver.speed,
      gear: driver.gear,
      throttle: driver.throttle,
      brake: driver.brake,
    };

    const tb = timeBuffers.get(code)!;
    tb.push(sample);
    const cutoff = sessionT - TIME_WINDOW;
    while (tb.length > 0 && tb[0].t < cutoff) {
      tb.shift();
    }

    const lb = lapBuffers.get(code)!;
    const lap = driver.lap;
    if (lap != null && lap !== lb.lap) {
      if (lb.samples.length > 0) {
        lapLengths.set(code, lb.samples[lb.samples.length - 1].dist);
      }
      lb.lap = lap;
      lb.startDist = dist;
      lb.samples = [];
    } else if (lb.lap == null && lap != null) {
      lb.lap = lap;
      lb.startDist = dist;
      lb.samples = [];
    }

    const lapDist = Math.max(0, dist - lb.startDist);
    lb.samples.push({
      dist: lapDist,
      speed: sample.speed,
      gear: sample.gear,
      throttle: sample.throttle,
      brake: sample.brake,
    });
  }

  if (mapTraceBuffers) {
    for (const [code, driver] of Object.entries(frame.drivers)) {
      if (!mapTraceBuffers.has(code)) {
        mapTraceBuffers.set(code, []);
      }
      const trace = mapTraceBuffers.get(code)!;
      trace.push({
        x: driver.x,
        y: driver.y,
        speed: driver.speed,
        throttle: driver.throttle,
        brake: driver.brake,
        drs: driver.drs,
        t: sessionT,
      });
      const trimmed = trimTraceSamples(trace, sessionT);
      mapTraceBuffers.set(code, trimmed);
    }
  }
}

export function useTelemetryBuffer(
  frame: RaceFrame | null,
  circuitLengthM: number | null,
  resetKey = 0,
  frameIndex = 0,
  subFrame = 0,
) {
  const [xMode, setXModeState] = useState<XMode>("time");
  const timeBuffers = useRef<Map<string, TelemetrySample[]>>(new Map());
  const lapBuffers = useRef<
    Map<string, { lap: number | null; startDist: number; samples: LapSample[] }>
  >(new Map());
  const lapLengths = useRef<Map<string, number>>(new Map());
  const mapTraceBuffers = useRef<Map<string, MapTraceSample[]>>(new Map());
  const lastSessionTRef = useRef<number | null>(null);
  const lastFrameIndexRef = useRef<number | null>(null);
  const backfillRef = useRef(0);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    clearAllBuffers(timeBuffers, lapBuffers, lapLengths, mapTraceBuffers);
    lastSessionTRef.current = null;
    lastFrameIndexRef.current = null;
    setVersion((n) => n + 1);
  }, [resetKey]);

  useEffect(() => {
    if (!frame) return;

    const sessionT = frame.t + subFrame / PLAYBACK_FPS;

    if (lastFrameIndexRef.current != null) {
      const jump = Math.abs(frameIndex - lastFrameIndexRef.current);
      if (jump > 1) {
        clearAllBuffers(timeBuffers, lapBuffers, lapLengths, mapTraceBuffers);
        lastSessionTRef.current = null;
      }
    }
    lastFrameIndexRef.current = frameIndex;

    if (
      lastSessionTRef.current != null &&
      sessionT < lastSessionTRef.current - 0.05
    ) {
      clearAllBuffers(timeBuffers, lapBuffers, lapLengths, mapTraceBuffers);
    }
    lastSessionTRef.current = sessionT;

    ingestFrame(
      frame,
      sessionT,
      circuitLengthM,
      timeBuffers.current,
      lapBuffers.current,
      lapLengths.current,
      mapTraceBuffers.current,
    );

    setVersion((n) => n + 1);
  }, [frame, circuitLengthM, frameIndex, subFrame]);

  const backfillCurrentLap = useCallback(
    async (targetIndex: number) => {
      if (targetIndex < 0) return;

      const token = ++backfillRef.current;
      const lookback = Math.min(targetIndex, LAP_LOOKBACK_FRAMES);
      const start = targetIndex - lookback;
      const count = lookback + 1;

      try {
        const r = await fetch(`/api/frames/range?start=${start}&count=${count}`);
        if (!r.ok || token !== backfillRef.current) return;

        const data = await r.json();
        const frames: RaceFrame[] = (data.frames ?? []).map(expandSlimFrame);
        if (frames.length === 0 || token !== backfillRef.current) return;

        lapBuffers.current.clear();
        lapLengths.current.clear();

        for (let i = 0; i < frames.length; i++) {
          const f = frames[i];
          const t = f.t + (i === frames.length - 1 ? subFrame / PLAYBACK_FPS : 0);
          ingestFrame(
            f,
            t,
            circuitLengthM,
            timeBuffers.current,
            lapBuffers.current,
            lapLengths.current,
            mapTraceBuffers.current,
          );
        }

        if (token === backfillRef.current) {
          setVersion((n) => n + 1);
        }
      } catch {
        /* ignore backfill errors */
      }
    },
    [circuitLengthM, subFrame],
  );

  const setXMode = useCallback((mode: XMode) => {
    setXModeState(mode);
  }, []);

  function getTimeSeries(code: string) {
    const samples = timeBuffers.current.get(code) ?? [];
    if (samples.length === 0) return null;

    const tNow = samples[samples.length - 1].t;
    const cutoff = tNow - TIME_WINDOW;

    const windowed = samples
      .filter((s) => s.t >= cutoff && s.t <= tNow)
      .sort((a, b) => a.t - b.t);

    if (windowed.length === 0) return null;

    const relXs = windowed.map((s) => s.t - tNow);

    return {
      xs: relXs,
      speeds: windowed.map((s) => s.speed),
      gears: windowed.map((s) => s.gear),
      throttles: windowed.map((s) => s.throttle),
      brakes: windowed.map((s) => s.brake),
      xMin: -TIME_WINDOW,
      xMax: 0,
    };
  }

  function getLapSeries(code: string) {
    const lb = lapBuffers.current.get(code);
    if (!lb || lb.samples.length === 0) return null;

    const xs = lb.samples.map((s) => s.dist);
    const lapLength =
      circuitLengthM ??
      lapLengths.current.get(code) ??
      Math.max(...xs, 1);

    return {
      xs,
      speeds: lb.samples.map((s) => s.speed),
      gears: lb.samples.map((s) => s.gear),
      throttles: lb.samples.map((s) => s.throttle),
      brakes: lb.samples.map((s) => s.brake),
      xMin: 0,
      xMax: lapLength,
    };
  }

  function getLapPlayhead(code: string): number | null {
    const lb = lapBuffers.current.get(code);
    if (!lb || lb.samples.length === 0) return null;
    return lb.samples[lb.samples.length - 1].dist;
  }

  function getMapTrace(code: string): MapTraceSample[] {
    return mapTraceBuffers.current.get(code) ?? [];
  }

  function resetBuffers() {
    clearAllBuffers(timeBuffers, lapBuffers, lapLengths, mapTraceBuffers);
    lastSessionTRef.current = null;
    lastFrameIndexRef.current = null;
    setVersion((n) => n + 1);
  }

  return {
    xMode,
    setXMode,
    getTimeSeries,
    getLapSeries,
    getLapPlayhead,
    getMapTrace,
    backfillCurrentLap,
    resetBuffers,
    version,
  };
}

export function rawTyreLabel(tyre: number): string {
  const mapped = remapTyre(tyre);
  const labels: Record<number, string> = {
    1: "Soft",
    2: "Medium",
    3: "Hard",
    4: "Inter",
    5: "Wet",
  };
  return labels[mapped] ?? "?";
}
