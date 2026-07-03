import { useMemo } from "react";
import { usePlaybackContext } from "../context/PlaybackContext";
import { useSession } from "../context/SessionContext";

export interface RaceProgress {
  lapFraction: number;
  lapMarkerPct: number;
  subFrameProgress: number;
  smoothProgress: number;
  displayLap: string;
  leaderRelDist: number;
}

export function useRaceProgress(): RaceProgress {
  const playback = usePlaybackContext();
  const { meta } = useSession();
  const totalLaps = meta?.total_laps ?? 60;

  return useMemo(() => {
    const leaderCode = playback.leader;
    const leader = playback.interpolatedDrivers.find(
      (d) => d.code === leaderCode,
    );
    const frameLap = playback.currentFrame?.lap ?? leader?.lap ?? 1;
    const relDist = leader?.rel_dist ?? 0;
    const lap = leader?.lap ?? frameLap;

    const lapFraction = Math.min(
      totalLaps,
      Math.max(0, lap - 1 + relDist),
    );
    const lapMarkerPct =
      totalLaps > 0 ? (lapFraction / totalLaps) * 100 : 0;

    const subFrameProgress = playback.frameIndex + playback.subFrame;
    const smoothProgress =
      playback.totalFrames > 1
        ? subFrameProgress / (playback.totalFrames - 1)
        : 0;

    const displayLap =
      relDist > 0.001 && relDist < 0.999
        ? `${lap}.${Math.round(relDist * 10)}`
        : String(Math.round(lap));

    return {
      lapFraction,
      lapMarkerPct,
      subFrameProgress,
      smoothProgress,
      displayLap,
      leaderRelDist: relDist,
    };
  }, [
    playback.leader,
    playback.interpolatedDrivers,
    playback.currentFrame,
    playback.frameIndex,
    playback.subFrame,
    playback.totalFrames,
    totalLaps,
  ]);
}
