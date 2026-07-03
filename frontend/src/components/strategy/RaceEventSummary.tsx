import { useEffect, useRef } from "react";
import type { RaceControlMessage } from "../../types";
import { trackStatusLabel } from "../../utils/worldToScreen";
import { WeatherStrip } from "../shared/WeatherStrip";
import { usePlaybackContext } from "../../context/PlaybackContext";

interface RaceEventSummaryProps {
  trackStatus: string;
  raceTime: string;
  currentLap: number;
  totalLaps: number;
  displayLap?: string;
  latestEvent: RaceControlMessage | null;
  isQualifying?: boolean;
}

function statusClass(code: string): string {
  switch (code) {
    case "2":
      return "status-yellow";
    case "4":
      return "status-sc";
    case "5":
      return "status-red";
    case "6":
    case "7":
      return "status-vsc";
    default:
      return "status-green";
  }
}

export function RaceEventSummary({
  trackStatus,
  raceTime,
  currentLap,
  totalLaps,
  displayLap,
  latestEvent,
  isQualifying = false,
}: RaceEventSummaryProps) {
  const playback = usePlaybackContext();
  const prevStatus = useRef(trackStatus);
  const statusRef = useRef<HTMLSpanElement>(null);
  const msgRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (prevStatus.current !== trackStatus && statusRef.current) {
      statusRef.current.classList.remove("status-pulse");
      void statusRef.current.offsetWidth;
      statusRef.current.classList.add("status-pulse");
    }
    prevStatus.current = trackStatus;
  }, [trackStatus]);

  useEffect(() => {
    if (latestEvent && msgRef.current) {
      msgRef.current.classList.remove("msg-fade-in");
      void msgRef.current.offsetWidth;
      msgRef.current.classList.add("msg-fade-in");
    }
  }, [latestEvent?.time, latestEvent?.message]);

  const lapLabel = displayLap ?? String(currentLap);

  return (
    <div className="pit-card event-summary">
      <h2 className="panel-title">Session Status</h2>
      <div className="data-strip summary-strip">
        <div className="strip-item">
          <span className="strip-label">Track</span>
          <span
            ref={statusRef}
            className={`strip-value status-badge-inline ${statusClass(trackStatus)}`}
          >
            {trackStatusLabel(trackStatus)}
          </span>
        </div>
        <div className="strip-item">
          <span className="strip-label">Time</span>
          <span className="strip-value">{raceTime}</span>
        </div>
        <div className="strip-item">
          <span className="strip-label">{isQualifying ? "Segment" : "Lap"}</span>
          <span className="strip-value">
            {lapLabel}
            {!isQualifying ? ` / ${totalLaps}` : ""}
          </span>
        </div>
        <div className="strip-item strip-item-wide">
          <span className="strip-label">Latest event</span>
          <span ref={msgRef} className="strip-value latest-msg">
            {latestEvent?.message ?? "—"}
          </span>
        </div>
      </div>
      {!isQualifying && (
        <WeatherStrip weather={playback.currentFrame?.weather} compact />
      )}
    </div>
  );
}
