import { useEffect, useRef } from "react";
import { useSession } from "../context/SessionContext";
import { usePlaybackContext } from "../context/PlaybackContext";
import { useRaceProgress } from "../hooks/useRaceProgress";
import { trackStatusLabel } from "../utils/worldToScreen";

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

function sessionTypeLabel(type: string | undefined, isQuali: boolean): string {
  if (isQuali) return type === "SQ" ? "Sprint Qualifying" : "Qualifying";
  if (type === "S") return "Sprint";
  return "Race";
}

export function DashboardHeader() {
  const { meta, selectedDriver } = useSession();
  const playback = usePlaybackContext();
  const raceProgress = useRaceProgress();
  const badgeRef = useRef<HTMLDivElement>(null);
  const prevStatus = useRef(playback.trackStatus);

  useEffect(() => {
    if (prevStatus.current !== playback.trackStatus && badgeRef.current) {
      badgeRef.current.classList.remove("status-pulse");
      void badgeRef.current.offsetWidth;
      badgeRef.current.classList.add("status-pulse");
    }
    prevStatus.current = playback.trackStatus;
  }, [playback.trackStatus]);

  if (!meta) return null;

  const statusLabel = trackStatusLabel(playback.trackStatus);
  const isQuali = meta.is_qualifying ?? false;
  const activeDriver = isQuali
    ? (meta.quali_active_driver ?? selectedDriver)
    : selectedDriver;
  const driverColor = activeDriver
    ? (meta.driver_colors[activeDriver] ?? "#888")
    : undefined;

  return (
    <header className="header dashboard-header">
      <div className="header-left">
        <h1>{meta.event_name}</h1>
        <span className="header-sub">
          {meta.circuit_name} · {meta.year} · R{meta.round} ·{" "}
          {sessionTypeLabel(meta.session_type, isQuali)}
        </span>
        {activeDriver && (
          <div className="header-selected">
            Selected:{" "}
            <strong style={{ color: driverColor }}>{activeDriver}</strong>
            {!isQuali && selectedDriver && (
              <>
                {" "}
                · P
                {playback.interpolatedDrivers.find((d) => d.code === selectedDriver)
                  ?.position ?? "—"}
              </>
            )}
          </div>
        )}
      </div>

      <div className="header-center">
        <span className="race-time">{playback.raceTime}</span>
        {isQuali ? (
          <span className="lap-counter">
            {meta.quali_active_driver ?? "—"} · {meta.quali_active_segment ?? "—"}
          </span>
        ) : (
          <span className="lap-counter">
            Lap {raceProgress.displayLap} / {meta.total_laps}
          </span>
        )}
      </div>

      <div className="header-right">
        <span className="header-source">FastF1 · Live memory</span>
        <div
          ref={badgeRef}
          className={`status-badge status-pill ${statusClass(playback.trackStatus)}`}
        >
          {statusLabel}
        </div>
      </div>
    </header>
  );
}
