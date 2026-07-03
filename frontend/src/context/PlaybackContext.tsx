import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useSession } from "./SessionContext";
import { usePlayback, type UsePlaybackResult } from "../hooks/usePlayback";

const PlaybackContext = createContext<UsePlaybackResult | null>(null);

export function PlaybackProvider({ children }: { children: ReactNode }) {
  const { meta, track, sessionReady, playbackReloadKey } = useSession();
  const playback = usePlayback(meta, track, sessionReady && !!meta, playbackReloadKey);

  useEffect(() => {
    if (!sessionReady || !playback.ready) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if (e.code === "Space") {
        e.preventDefault();
        playback.togglePlay();
      } else if (e.code === "ArrowLeft") {
        playback.stepBackward();
      } else if (e.code === "ArrowRight") {
        playback.stepForward();
      } else if (e.code === "ArrowUp") {
        playback.cycleSpeed();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sessionReady, playback]);

  return (
    <PlaybackContext.Provider value={playback}>
      {children}
    </PlaybackContext.Provider>
  );
}

export function usePlaybackContext() {
  const ctx = useContext(PlaybackContext);
  if (!ctx) throw new Error("usePlaybackContext must be used within PlaybackProvider");
  return ctx;
}
