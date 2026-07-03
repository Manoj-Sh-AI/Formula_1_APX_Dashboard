import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useSession } from "./SessionContext";
import { usePlaybackContext } from "./PlaybackContext";
import {
  useTelemetryBuffer,
  type XMode,
} from "../hooks/useTelemetryBuffer";
import type { DriverFrame, InterpolatedDriver, RaceFrame } from "../types";

type TelemetryBuffer = ReturnType<typeof useTelemetryBuffer>;

const TelemetryContext = createContext<TelemetryBuffer | null>(null);

function buildInterpolatedFrame(
  base: RaceFrame | null,
  drivers: InterpolatedDriver[],
): RaceFrame | null {
  if (!base || drivers.length === 0) return base;

  const merged: Record<string, DriverFrame> = { ...base.drivers };
  for (const d of drivers) {
    const existing = merged[d.code];
    if (!existing) continue;
    merged[d.code] = {
      ...existing,
      x: d.x,
      y: d.y,
      speed: d.speed,
      gear: d.gear,
      drs: d.drs,
      throttle: d.throttle,
      brake: d.brake,
      tyre: d.tyre,
      tyre_life: d.tyre_life ?? existing.tyre_life,
      lap: d.lap,
      in_pit: d.in_pit,
      rel_dist: d.rel_dist,
      dist: d.dist ?? existing.dist,
    };
  }

  return { ...base, drivers: merged };
}

/** Keeps telemetry samples accumulating while playback runs across dashboard pages. */
export function TelemetryProvider({ children }: { children: ReactNode }) {
  const { meta, playbackReloadKey } = useSession();
  const playback = usePlaybackContext();
  const isQuali = meta?.is_qualifying ?? false;

  const telemetryFrame = useMemo(
    () => buildInterpolatedFrame(playback.currentFrame, playback.interpolatedDrivers),
    [playback.currentFrame, playback.interpolatedDrivers],
  );

  const buffer = useTelemetryBuffer(
    isQuali ? null : telemetryFrame,
    meta?.circuit_length_m ?? null,
    playbackReloadKey,
    playback.frameIndex,
    playback.subFrame,
  );

  const prevFrameIndex = useRef(playback.frameIndex);
  const prevXMode = useRef(buffer.xMode);

  useEffect(() => {
    if (prevXMode.current !== buffer.xMode && buffer.xMode === "lap") {
      void buffer.backfillCurrentLap(playback.frameIndex);
    }
    prevXMode.current = buffer.xMode;
  }, [buffer.xMode, playback.frameIndex, buffer]);

  useEffect(() => {
    const jump = Math.abs(playback.frameIndex - prevFrameIndex.current);
    if (jump > 1 && buffer.xMode === "lap") {
      void buffer.backfillCurrentLap(playback.frameIndex);
    }
    prevFrameIndex.current = playback.frameIndex;
  }, [playback.frameIndex, buffer]);

  useEffect(() => {
    if (isQuali) {
      buffer.setXMode("lap");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isQuali]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        buffer.resetBuffers();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [buffer]);

  return (
    <TelemetryContext.Provider value={buffer}>
      {children}
    </TelemetryContext.Provider>
  );
}

export function useTelemetryContext() {
  const ctx = useContext(TelemetryContext);
  if (!ctx) {
    throw new Error("useTelemetryContext must be used within TelemetryProvider");
  }
  return ctx;
}

export type { XMode };
