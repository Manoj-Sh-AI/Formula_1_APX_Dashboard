import { useEffect, useRef, useState } from "react";

import type { InterpolatedDriver, RaceFrame } from "../types";

import type { TyreStint } from "../utils/tyreColors";

import { remapTyre } from "../utils/tyreColors";

export interface DriverStrategyRow {
  code: string;
  position: number;
  stints: TyreStint[];
  /** Fractional race progress in laps (lap - 1 + rel_dist). */
  lapProgress: number;
}

interface StintAccumulator {
  stints: Map<string, TyreStint[]>;
  prevTyres: Map<string, number>;
  positions: Map<string, number>;
  lapProgress: Map<string, number>;
}

interface StrategySnapshot {
  frame_index: number;
  current_lap: number;
  total_laps: number;
  rows: DriverStrategyRow[];
}

/** Process at most one frame locally per playback tick; larger jumps use backend snapshot. */
const LOCAL_STEP_THRESHOLD = 1;

function createAccumulator(): StintAccumulator {
  return {
    stints: new Map(),
    prevTyres: new Map(),
    positions: new Map(),
    lapProgress: new Map(),
  };
}

function resetAccumulator(acc: StintAccumulator) {
  acc.stints.clear();
  acc.prevTyres.clear();
  acc.positions.clear();
  acc.lapProgress.clear();
}

/** Process one playback frame into stint state (matches tyre_strategy_window.py). */
export function processTyreFrame(
  acc: StintAccumulator,
  frame: RaceFrame,
  totalLaps: number,
  totalLapsRef: { current: number },
) {
  if (
    totalLaps > 0 &&
    totalLaps !== totalLapsRef.current &&
    frame.lap <= 2
  ) {
    resetAccumulator(acc);
  }
  totalLapsRef.current = totalLaps;

  for (const [code, driver] of Object.entries(frame.drivers)) {
    const pos = driver.position;
    if (pos != null) {
      acc.positions.set(code, Math.floor(pos));
    }

    let tyre: number | null = driver.tyre;
    const lapRaw = driver.lap;

    if (tyre != null && typeof tyre === "number") {
      tyre = remapTyre(Math.round(tyre));
    }

    if (
      tyre == null ||
      lapRaw == null ||
      typeof tyre !== "number" ||
      tyre === 0
    ) {
      continue;
    }

    const lap = Math.floor(lapRaw);
    const relDist = Math.max(0, Math.min(1, driver.rel_dist ?? 0));
    acc.lapProgress.set(code, lap - 1 + relDist);

    if (!acc.stints.has(code)) {
      acc.stints.set(code, [{ tyre, start_lap: lap, end_lap: null }]);
      acc.prevTyres.set(code, tyre);
    } else if (tyre !== acc.prevTyres.get(code)) {
      const stints = acc.stints.get(code)!;
      stints[stints.length - 1].end_lap = lap - 1;
      stints.push({ tyre, start_lap: lap, end_lap: null });
      acc.prevTyres.set(code, tyre);
    }
  }
}

function applyInterpolatedProgress(
  acc: StintAccumulator,
  drivers: InterpolatedDriver[],
) {
  for (const driver of drivers) {
    if (driver.lap == null) continue;
    const lap = Math.floor(driver.lap);
    const relDist = Math.max(0, Math.min(1, driver.rel_dist ?? 0));
    acc.lapProgress.set(driver.code, lap - 1 + relDist);
    if (driver.position != null) {
      acc.positions.set(driver.code, Math.floor(driver.position));
    }
  }
}

function rowsFromAccumulator(acc: StintAccumulator): DriverStrategyRow[] {
  return [...acc.stints.entries()]
    .map(([code, stints]) => ({
      code,
      position: acc.positions.get(code) ?? 999,
      stints,
      lapProgress: acc.lapProgress.get(code) ?? 1,
    }))
    .sort((a, b) => a.position - b.position || a.code.localeCompare(b.code));
}

function applySnapshotToAccumulator(
  acc: StintAccumulator,
  snapshot: StrategySnapshot,
) {
  resetAccumulator(acc);
  for (const row of snapshot.rows) {
    acc.stints.set(row.code, row.stints.map((s) => ({ ...s })));
    acc.positions.set(row.code, row.position);
    acc.lapProgress.set(row.code, row.lapProgress);
    const last = row.stints[row.stints.length - 1];
    if (last) {
      acc.prevTyres.set(row.code, last.tyre);
    }
  }
}

async function fetchStrategySnapshot(
  frameIndex: number,
  signal?: AbortSignal,
): Promise<StrategySnapshot> {
  const r = await fetch(`/api/tyre-strategy?frame_index=${frameIndex}`, {
    signal,
  });
  if (!r.ok) {
    throw new Error(`Failed to fetch tyre strategy snapshot at frame ${frameIndex}`);
  }
  return r.json() as Promise<StrategySnapshot>;
}

/**
 * Stint detection matching original tyre_strategy_window.py.
 * Uses backend snapshot for seeks; cheap local updates during normal playback.
 */
export function useTyreStrategy(
  frame: RaceFrame | null,
  frameIndex: number,
  subFrame: number,
  interpolatedDrivers: InterpolatedDriver[],
  totalLaps: number,
  enabled: boolean,
  reloadKey = 0,
) {
  const accRef = useRef<StintAccumulator>(createAccumulator());
  const lastProcessedRef = useRef(-1);
  const totalLapsRef = useRef({ current: totalLaps });
  const syncGenRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const [rows, setRows] = useState<DriverStrategyRow[]>([]);
  const [currentLap, setCurrentLap] = useState(1);

  useEffect(() => {
    abortRef.current?.abort();
    resetAccumulator(accRef.current);
    lastProcessedRef.current = -1;
    totalLapsRef.current = { current: totalLaps };
    setRows([]);
    setCurrentLap(1);
  }, [reloadKey, totalLaps]);

  useEffect(() => {
    if (!enabled) return;

    const target = Math.floor(frameIndex);
    const lastProcessed = lastProcessedRef.current;
    const delta = target - lastProcessed;

    if (delta === 0) return;

    const useSnapshot =
      target < lastProcessed || delta > LOCAL_STEP_THRESHOLD;

    if (!useSnapshot && frame) {
      processTyreFrame(accRef.current, frame, totalLaps, totalLapsRef.current);
      lastProcessedRef.current = target;
      setCurrentLap(Math.max(1, Math.floor(frame.lap)));
      applyInterpolatedProgress(accRef.current, interpolatedDrivers);
      setRows(rowsFromAccumulator(accRef.current));
      return;
    }

    const gen = ++syncGenRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    void fetchStrategySnapshot(target, controller.signal)
      .then((snapshot) => {
        if (syncGenRef.current !== gen) return;
        applySnapshotToAccumulator(accRef.current, snapshot);
        lastProcessedRef.current = snapshot.frame_index;
        applyInterpolatedProgress(accRef.current, interpolatedDrivers);
        setCurrentLap(snapshot.current_lap);
        setRows(rowsFromAccumulator(accRef.current));
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        if (syncGenRef.current !== gen) return;
        if (frame) {
          processTyreFrame(
            accRef.current,
            frame,
            totalLaps,
            totalLapsRef.current,
          );
          lastProcessedRef.current = target;
          setCurrentLap(Math.max(1, Math.floor(frame.lap)));
          applyInterpolatedProgress(accRef.current, interpolatedDrivers);
          setRows(rowsFromAccumulator(accRef.current));
        } else if (err instanceof Error) {
          console.warn(err.message);
        }
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, frameIndex, frame, totalLaps, reloadKey]);

  useEffect(() => {
    if (!enabled || lastProcessedRef.current < 0) return;
    applyInterpolatedProgress(accRef.current, interpolatedDrivers);
    setRows(rowsFromAccumulator(accRef.current));
  }, [enabled, subFrame, interpolatedDrivers]);

  return { rows, currentLap, totalLaps };
}
