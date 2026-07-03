import { useMemo } from "react";
import { PLAYBACK_SPEEDS } from "../utils/worldToScreen";
import type { SessionMeta } from "../types";
import { buildTimelineMarkers } from "../utils/timelineEvents";

interface PlaybackControlsProps {
  isPlaying: boolean;
  progress: number;
  smoothProgress: number;
  speed: number;
  frameIndex: number;
  totalFrames: number;
  meta?: SessionMeta | null;
  onTogglePlay: () => void;
  onSeek: (index: number) => void;
  onStepBack: () => void;
  onStepForward: () => void;
  onSetSpeed: (speed: number) => void;
}

function IconStepBack() {
  return (
    <svg className="ctrl-icon" viewBox="0 0 16 16" aria-hidden>
      <path d="M3 2v12l8-6-8-6zm9 0v12h2V2h-2z" />
    </svg>
  );
}

function IconStepForward() {
  return (
    <svg className="ctrl-icon" viewBox="0 0 16 16" aria-hidden>
      <path d="M13 2v12l-8-6 8-6zM1 2v12h2V2H1z" />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg className="ctrl-icon" viewBox="0 0 16 16" aria-hidden>
      <path d="M4 2l10 6-10 6V2z" />
    </svg>
  );
}

function IconPause() {
  return (
    <svg className="ctrl-icon" viewBox="0 0 16 16" aria-hidden>
      <path d="M3 2h3v12H3V2zm7 0h3v12h-3V2z" />
    </svg>
  );
}

export function PlaybackControls({
  isPlaying,
  progress,
  smoothProgress,
  speed,
  frameIndex,
  totalFrames,
  meta,
  onTogglePlay,
  onSeek,
  onStepBack,
  onStepForward,
  onSetSpeed,
}: PlaybackControlsProps) {
  const markers = useMemo(
    () => buildTimelineMarkers(meta ?? null, totalFrames, meta?.fps ?? 25),
    [meta, totalFrames],
  );

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const p = parseFloat(e.target.value);
    const index = Math.round(p * (totalFrames - 1));
    onSeek(index);
  };

  const seekValue = isPlaying ? smoothProgress : progress;

  return (
    <div className="playback-controls" role="toolbar" aria-label="Playback controls">
      <button type="button" className="ctrl-btn" onClick={onStepBack} title="Step back (←)" aria-label="Step back">
        <IconStepBack />
      </button>
      <button
        type="button"
        className="ctrl-btn play-btn"
        onClick={onTogglePlay}
        title="Play / Pause (Space)"
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? <IconPause /> : <IconPlay />}
      </button>
      <button type="button" className="ctrl-btn" onClick={onStepForward} title="Step forward (→)" aria-label="Step forward">
        <IconStepForward />
      </button>

      <div className="playback-seek-wrap">
        {markers.length > 0 && (
          <div className="timeline-markers" aria-hidden>
            <div className="timeline-track" />
            {markers.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`timeline-marker ${m.kind}${m.severity === "critical" ? " critical" : ""}`}
                style={{ left: `${m.progress * 100}%` }}
                title={m.label}
                onClick={() => onSeek(m.frameIndex)}
              />
            ))}
          </div>
        )}
        <input
          type="range"
          className="seek-bar"
          min={0}
          max={1}
          step={0.0001}
          value={seekValue}
          onChange={handleSeek}
          aria-label="Session timeline"
        />
      </div>

      <span className="frame-counter">
        {frameIndex + 1} / {totalFrames}
      </span>

      <div className="speed-buttons">
        {PLAYBACK_SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            className={`speed-btn${speed === s ? " active" : ""}`}
            onClick={() => onSetSpeed(s)}
            aria-pressed={speed === s}
          >
            {s}x
          </button>
        ))}
      </div>

      <span className="playback-shortcuts">Space · ← → · Esc · ?</span>
    </div>
  );
}
