import { useEffect, useRef } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import type { DensityMode } from "../context/DensityContext";

interface ShareableStateOptions {
  frameIndex: number;
  selectedDriver: string | null;
  density: DensityMode;
  totalFrames: number;
  isPlaying: boolean;
  onSeek: (index: number) => void;
  onSelectDriver: (code: string | null) => void;
  onSetDensity: (mode: DensityMode) => void;
  ready: boolean;
}

function clampFrame(index: number, totalFrames: number): number {
  if (totalFrames <= 0) return 0;
  return Math.max(0, Math.min(Math.floor(index), totalFrames - 1));
}

function buildSearch(frame: number, driver: string | null, density: DensityMode): string {
  const next = new URLSearchParams();
  next.set("frame", String(frame));
  if (driver) next.set("driver", driver);
  if (density !== "operational") next.set("layout", density);
  return next.toString();
}

export function useShareableState({
  frameIndex,
  selectedDriver,
  density,
  totalFrames,
  isPlaying,
  onSeek,
  onSelectDriver,
  onSetDensity,
  ready,
}: ShareableStateOptions) {
  const location = useLocation();
  const [, setSearchParams] = useSearchParams();
  const hydrated = useRef(false);
  const lastSyncedSearch = useRef<string | null>(null);
  const pathGeneration = useRef(0);
  const rafRef = useRef<number | null>(null);
  const wasPlayingRef = useRef(isPlaying);
  const frameRef = useRef(frameIndex);
  const driverRef = useRef(selectedDriver);
  const densityRef = useRef(density);

  frameRef.current = frameIndex;
  driverRef.current = selectedDriver;
  densityRef.current = density;

  const canWriteUrl = () => ready && hydrated.current && totalFrames > 0;

  const writeUrl = (frame: number) => {
    if (!canWriteUrl()) return;

    const search = buildSearch(frame, driverRef.current, densityRef.current);
    if (lastSyncedSearch.current === search) return;

    const gen = pathGeneration.current;

    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (gen !== pathGeneration.current) return;

      lastSyncedSearch.current = search;
      setSearchParams(new URLSearchParams(search), { replace: true });
    });
  };

  useEffect(() => {
    pathGeneration.current += 1;
    lastSyncedSearch.current = null;
  }, [location.pathname]);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    if (!ready || hydrated.current || totalFrames <= 0) return;

    const params = new URLSearchParams(location.search);
    const frame = params.get("frame");
    const driver = params.get("driver");
    const layout = params.get("layout") as DensityMode | null;

    if (frame != null) {
      const idx = parseInt(frame, 10);
      if (!Number.isNaN(idx)) {
        const clamped = clampFrame(idx, totalFrames);
        onSeek(clamped);
        lastSyncedSearch.current = buildSearch(clamped, driver, layout ?? "operational");
      }
    }
    if (driver) onSelectDriver(driver);
    if (layout && ["operational", "broadcast", "focus"].includes(layout)) {
      onSetDensity(layout);
    }

    hydrated.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, totalFrames]);

  useEffect(() => {
    if (!canWriteUrl() || isPlaying) return;
    writeUrl(clampFrame(frameRef.current, totalFrames));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDriver, density, ready, totalFrames, isPlaying]);

  useEffect(() => {
    if (!canWriteUrl() || isPlaying) return;
    writeUrl(clampFrame(frameIndex, totalFrames));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameIndex, isPlaying, ready, totalFrames]);

  useEffect(() => {
    if (!canWriteUrl()) return;

    const justPaused = wasPlayingRef.current && !isPlaying;
    wasPlayingRef.current = isPlaying;

    if (justPaused) {
      writeUrl(clampFrame(frameRef.current, totalFrames));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, ready, totalFrames]);

  useEffect(() => {
    if (!canWriteUrl() || isPlaying) return;
    writeUrl(clampFrame(frameRef.current, totalFrames));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, ready, totalFrames, isPlaying]);
}
