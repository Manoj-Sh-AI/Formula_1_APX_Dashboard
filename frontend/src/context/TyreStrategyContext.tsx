import { createContext, useContext, type ReactNode } from "react";
import { useSession } from "./SessionContext";
import { usePlaybackContext } from "./PlaybackContext";
import {
  useTyreStrategy,
  type DriverStrategyRow,
} from "../hooks/useTyreStrategy";

interface TyreStrategyContextValue {
  rows: DriverStrategyRow[];
  currentLap: number;
  totalLaps: number;
}

const TyreStrategyContext = createContext<TyreStrategyContextValue | null>(null);

/** Accumulates tyre stints while playback runs on any dashboard. */
export function TyreStrategyProvider({ children }: { children: ReactNode }) {
  const { meta, playbackReloadKey } = useSession();
  const playback = usePlaybackContext();
  const isQuali = meta?.is_qualifying ?? false;
  const totalLaps = meta?.total_laps ?? 60;

  const { rows, currentLap } = useTyreStrategy(
    isQuali ? null : playback.currentFrame,
    playback.frameIndex,
    playback.subFrame,
    playback.interpolatedDrivers,
    totalLaps,
    !isQuali && playback.ready,
    playbackReloadKey,
  );

  return (
    <TyreStrategyContext.Provider value={{ rows, currentLap, totalLaps }}>
      {children}
    </TyreStrategyContext.Provider>
  );
}

export function useTyreStrategyContext() {
  const ctx = useContext(TyreStrategyContext);
  if (!ctx) {
    throw new Error(
      "useTyreStrategyContext must be used within TyreStrategyProvider",
    );
  }
  return ctx;
}
