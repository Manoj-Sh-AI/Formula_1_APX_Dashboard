import { useCallback, useEffect, useRef, useState } from "react";
import type { InterpolatedDriver, RaceFrame, SessionMeta, TrackData } from "../types";
import { expandSlimFrame, fetchManifest } from "../utils/frames";
import {
  buildTrackReferenceFromTrack,
  interpolateDriverMapPosition,
  type TrackReference,
} from "../utils/trackProjection";
import {
  formatRaceTime,
  getTrackStatusAtTime,
  PLAYBACK_SPEEDS,
} from "../utils/worldToScreen";
import { computeGapsForDrivers } from "../utils/gaps";
import { estimateTyreHealth } from "../utils/tyreHealth";

const FPS = 25;
const PREFETCH_AHEAD = 8;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function interpolateDrivers(
  frameA: RaceFrame,
  frameB: RaceFrame,
  alpha: number,
  trackRef: TrackReference | null,
): InterpolatedDriver[] {
  const codes = new Set([
    ...Object.keys(frameA.drivers),
    ...Object.keys(frameB.drivers),
  ]);
  const raw: InterpolatedDriver[] = [];

  for (const code of codes) {
    const a = frameA.drivers[code];
    const b = frameB.drivers[code];
    if (!a && !b) continue;
    const src = b ?? a!;
    const prev = a ?? b!;

    let x: number;
    let y: number;
    if (trackRef) {
      [x, y] = interpolateDriverMapPosition(prev, src, alpha, trackRef);
    } else {
      x = lerp(prev.x, src.x, alpha);
      y = lerp(prev.y, src.y, alpha);
    }

    const relDist = lerp(prev.rel_dist, src.rel_dist, alpha);
    const position = alpha < 0.5 ? prev.position : src.position;

    raw.push({
      code,
      x,
      y,
      speed: lerp(prev.speed, src.speed, alpha),
      gear: src.gear,
      drs: src.drs,
      throttle: lerp(prev.throttle, src.throttle, alpha),
      brake: lerp(prev.brake, src.brake, alpha),
      tyre: src.tyre,
      tyre_life: lerp(prev.tyre_life ?? 0, src.tyre_life ?? 0, alpha),
      lap: src.lap,
      in_pit: src.in_pit,
      rel_dist: relDist,
      dist: lerp(prev.dist ?? 0, src.dist ?? 0, alpha),
      position,
    });
  }

  raw.sort((a, b) => a.position - b.position || a.code.localeCompare(b.code));
  return enrichDrivers(raw);
}

function enrichDrivers(drivers: InterpolatedDriver[]): InterpolatedDriver[] {
  const gaps = computeGapsForDrivers(drivers);
  return drivers.map((d) => ({
    ...d,
    gapToLeader: gaps[d.code]?.gapToLeader ?? null,
    interval: gaps[d.code]?.interval ?? null,
    tyreHealth: estimateTyreHealth(d.tyre, Math.round(d.tyre_life ?? 0)),
  }));
}

export interface UsePlaybackResult {
  frameIndex: number;
  interpolatedDrivers: InterpolatedDriver[];
  currentFrame: RaceFrame | null;
  leader: string | null;
  trackStatus: string;
  raceTime: string;
  isPlaying: boolean;
  speed: number;
  totalFrames: number;
  progress: number;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (index: number) => void;
  stepForward: () => void;
  stepBackward: () => void;
  cycleSpeed: () => void;
  setSpeed: (speed: number) => void;
  subFrame: number;
  smoothProgress: number;
  ready: boolean;
  error: string | null;
}

async function fetchRangeIntoCache(
  start: number,
  count: number,
  cache: Map<number, RaceFrame>,
): Promise<void> {
  const r = await fetch(`/api/frames/range?start=${start}&count=${count}`);
  if (!r.ok) throw new Error(`Failed to fetch frames at ${start}`);
  const data = await r.json();
  for (let i = 0; i < data.frames.length; i++) {
    cache.set(start + i, expandSlimFrame(data.frames[i]));
  }
}

export function usePlayback(
  meta: SessionMeta | null,
  track: TrackData | null,
  enabled: boolean,
  reloadKey = 0,
): UsePlaybackResult {
  const [totalFrames, setTotalFrames] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [subFrame, setSubFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeedState] = useState(1);
  const [, setCacheVersion] = useState(0);

  const frameCache = useRef<Map<number, RaceFrame>>(new Map());
  const trackRef = useRef<TrackReference | null>(null);
  const loadingRanges = useRef<Set<string>>(new Set());
  const frameIndexRef = useRef(0);
  const subFrameRef = useRef(0);
  const isPlayingRef = useRef(false);
  const speedRef = useRef(1);
  const totalFramesRef = useRef(0);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const getFrame = useCallback((index: number): RaceFrame | null => {
    return frameCache.current.get(index) ?? null;
  }, []);

  const ensureRange = useCallback(async (start: number, count: number) => {
    const total = totalFramesRef.current;
    if (total <= 0 || start >= total) return;

    const clampedCount = Math.min(count, total - start);
    if (clampedCount <= 0) return;

    let needsFetch = false;
    for (let i = start; i < start + clampedCount; i++) {
      if (!frameCache.current.has(i)) {
        needsFetch = true;
        break;
      }
    }
    if (!needsFetch) return;

    const key = `${start}:${clampedCount}`;
    if (loadingRanges.current.has(key)) return;
    loadingRanges.current.add(key);
    try {
      await fetchRangeIntoCache(start, clampedCount, frameCache.current);
      setCacheVersion((v) => v + 1);
    } finally {
      loadingRanges.current.delete(key);
    }
  }, []);

  const prefetchAround = useCallback(
    (index: number) => {
      const total = totalFramesRef.current;
      if (total <= 0) return;

      const base = Math.max(0, Math.min(Math.floor(index), total - 1));
      const baseCount = Math.min(2, total - base);
      if (baseCount > 0) void ensureRange(base, baseCount);

      if (isPlayingRef.current) {
        const aheadStart = base + 2;
        const aheadCount = Math.min(PREFETCH_AHEAD, total - aheadStart);
        if (aheadCount > 0) void ensureRange(aheadStart, aheadCount);
      }
    },
    [ensureRange],
  );

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    frameCache.current.clear();
    loadingRanges.current.clear();
    frameIndexRef.current = 0;
    subFrameRef.current = 0;
    isPlayingRef.current = false;
    setFrameIndex(0);
    setSubFrame(0);
    setIsPlaying(false);
    setReady(false);
    setError(null);

    fetchManifest()
      .then((manifest) => {
        if (cancelled) return;
        totalFramesRef.current = manifest.total_frames;
        setTotalFrames(manifest.total_frames);
        return ensureRange(0, 2);
      })
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, ensureRange, reloadKey]);

  useEffect(() => {
    trackRef.current = track ? buildTrackReferenceFromTrack(track) : null;
  }, [track]);

  const idx = Math.floor(frameIndex);
  const currentFrame = getFrame(idx);
  const nextFrame = getFrame(Math.min(idx + 1, totalFrames - 1));

  const interpolatedDrivers =
    currentFrame && nextFrame
      ? interpolateDrivers(currentFrame, nextFrame, subFrame, trackRef.current)
      : [];

  const leader =
    interpolatedDrivers.find((d) => d.position === 1)?.code ??
    (interpolatedDrivers.length > 0 ? interpolatedDrivers[0].code : null);

  const raceTime = currentFrame ? formatRaceTime(currentFrame.t) : "00:00";
  const trackStatus =
    currentFrame && meta
      ? getTrackStatusAtTime(meta.track_statuses, currentFrame.t)
      : "1";

  useEffect(() => {
    if (ready) prefetchAround(frameIndexRef.current);
  }, [ready, frameIndex, prefetchAround]);

  const stopRaf = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  const tick = useCallback(
    (now: number) => {
      if (!isPlayingRef.current || totalFramesRef.current === 0) {
        stopRaf();
        return;
      }

      const dt = lastTimeRef.current ? (now - lastTimeRef.current) / 1000 : 0;
      lastTimeRef.current = now;

      subFrameRef.current += dt * FPS * speedRef.current;

      while (subFrameRef.current >= 1) {
        subFrameRef.current -= 1;
        frameIndexRef.current = Math.min(
          frameIndexRef.current + 1,
          totalFramesRef.current - 1,
        );
        if (frameIndexRef.current >= totalFramesRef.current - 1) {
          isPlayingRef.current = false;
          setIsPlaying(false);
          stopRaf();
          break;
        }
      }

      prefetchAround(frameIndexRef.current);
      setFrameIndex(frameIndexRef.current);
      setSubFrame(subFrameRef.current);
      rafRef.current = requestAnimationFrame(tick);
    },
    [prefetchAround, stopRaf],
  );

  useEffect(() => {
    if (!isPlaying) {
      stopRaf();
      return;
    }
    lastTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(tick);
    return () => stopRaf();
  }, [isPlaying, tick, stopRaf]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        lastTimeRef.current = 0;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const play = useCallback(() => {
    if (totalFramesRef.current <= 1) return;
    isPlayingRef.current = true;
    setIsPlaying(true);
    lastTimeRef.current = 0;
  }, []);

  const pause = useCallback(() => {
    isPlayingRef.current = false;
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlayingRef.current) pause();
    else play();
  }, [play, pause]);

  const seek = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, totalFramesRef.current - 1));
      frameIndexRef.current = clamped;
      subFrameRef.current = 0;
      setFrameIndex(clamped);
      setSubFrame(0);
      prefetchAround(clamped);
    },
    [prefetchAround],
  );

  const stepForward = useCallback(() => seek(frameIndexRef.current + 1), [seek]);
  const stepBackward = useCallback(() => seek(frameIndexRef.current - 1), [seek]);

  const cycleSpeed = useCallback(() => {
    const i = PLAYBACK_SPEEDS.indexOf(speedRef.current);
    const next = PLAYBACK_SPEEDS[(i + 1) % PLAYBACK_SPEEDS.length];
    speedRef.current = next;
    setSpeedState(next);
  }, []);

  const setSpeed = useCallback((s: number) => {
    speedRef.current = s;
    setSpeedState(s);
  }, []);

  return {
    frameIndex,
    subFrame,
    interpolatedDrivers,
    currentFrame,
    leader,
    trackStatus,
    raceTime,
    isPlaying,
    speed,
    totalFrames,
    progress: totalFrames > 1 ? frameIndex / (totalFrames - 1) : 0,
    smoothProgress:
      totalFrames > 1 ? (frameIndex + subFrame) / (totalFrames - 1) : 0,
    play,
    pause,
    togglePlay,
    seek,
    stepForward,
    stepBackward,
    cycleSpeed,
    setSpeed,
    ready,
    error,
  };
}
