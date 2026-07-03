import { useMemo, useState } from "react";
import { TyreStrategyBoard } from "../components/strategy/TyreStrategyBoard";
import { RaceEventSummary } from "../components/strategy/RaceEventSummary";
import { RaceControlFeed } from "../components/race-control/RaceControlFeed";
import { QualifyingResultsBoard } from "../components/qualifying/QualifyingResultsBoard";
import { QualifyingLapInfo } from "../components/qualifying/QualifyingLapInfo";
import { useSession } from "../context/SessionContext";
import { usePlaybackContext } from "../context/PlaybackContext";
import { useTyreStrategyContext } from "../context/TyreStrategyContext";
import { useRaceControlFeed } from "../hooks/useRaceControlFeed";
import { useRaceProgress } from "../hooks/useRaceProgress";

type StrategyFilter = "all" | "selected" | "top10";

export function StrategyRaceControlPage() {
  const { meta, selectedDriver, selectQualiDriver } = useSession();
  const playback = usePlaybackContext();
  const raceProgress = useRaceProgress();
  const [filter, setFilter] = useState<StrategyFilter>("all");

  const isQuali = meta?.is_qualifying ?? false;
  const { rows, currentLap, totalLaps } = useTyreStrategyContext();

  const currentTime = playback.currentFrame?.t ?? 0;
  const { visibleEvents, hasData, latest } = useRaceControlFeed(
    meta?.race_control_messages,
    currentTime,
    Math.floor(playback.frameIndex),
  );

  const healthByDriver = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of playback.interpolatedDrivers) {
      if (d.tyreHealth != null) map[d.code] = d.tyreHealth;
    }
    return map;
  }, [playback.interpolatedDrivers]);

  if (!meta) return null;

  const activeDriver = meta.quali_active_driver ?? selectedDriver;
  const selected =
    playback.interpolatedDrivers.find(
      (d) => d.code === (isQuali ? activeDriver : selectedDriver),
    ) ??
    playback.interpolatedDrivers[0] ??
    null;

  if (isQuali) {
    return (
      <div className="page-grid strategy-page quali-strategy-page">
        <div className="strategy-left">
          <RaceEventSummary
            trackStatus={playback.trackStatus}
            raceTime={playback.raceTime}
            currentLap={1}
            totalLaps={1}
            displayLap={meta.quali_active_segment ?? "Q"}
            latestEvent={latest}
            isQualifying
          />
          <QualifyingLapInfo
            driverCode={activeDriver}
            segment={meta.quali_active_segment ?? null}
            sectorTimes={meta.sector_times}
            lapTime={meta.lap_time}
            compound={meta.compound}
            speed={selected?.speed}
            gear={selected?.gear}
            drs={selected?.drs}
            results={meta.quali_results}
          />
        </div>
        <div className="strategy-right">
          <QualifyingResultsBoard
            results={meta.quali_results ?? []}
            activeDriver={activeDriver}
            onSelectDriver={(code) => void selectQualiDriver(code)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="page-grid strategy-page">
      <div className="strategy-left">
        <RaceEventSummary
          trackStatus={playback.trackStatus}
          raceTime={playback.raceTime}
          currentLap={currentLap}
          totalLaps={totalLaps}
          displayLap={raceProgress.displayLap}
          latestEvent={latest}
        />
        <div className="strategy-filter-bar">
          {(["all", "selected", "top10"] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={`map-layer-toggle${filter === f ? " active" : ""}`}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
            >
              {f === "all" ? "All Drivers" : f === "selected" ? "Selected" : "Top 10"}
            </button>
          ))}
        </div>
        <TyreStrategyBoard
          rows={rows}
          totalLaps={totalLaps}
          currentLap={currentLap}
          lapMarkerPct={raceProgress.lapMarkerPct}
          displayLap={raceProgress.displayLap}
          filter={filter}
          selectedDriver={selectedDriver}
          healthByDriver={healthByDriver}
        />
      </div>
      <div className="strategy-right">
        <RaceControlFeed
          events={visibleEvents}
          hasData={hasData}
          currentTime={currentTime}
        />
      </div>
    </div>
  );
}
