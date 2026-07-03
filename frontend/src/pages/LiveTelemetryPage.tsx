import { useMemo } from "react";
import { DriverTelemetryCharts } from "../components/telemetry/DriverTelemetryCharts";
import { TrackPositionMiniMap } from "../components/telemetry/TrackPositionMiniMap";
import { WeatherTelemetryPanel } from "../components/telemetry/WeatherTelemetryPanel";
import { QualifyingComparisonBanner } from "../components/qualifying/QualifyingComparisonBanner";
import { useSession } from "../context/SessionContext";
import { usePlaybackContext } from "../context/PlaybackContext";
import { useTelemetryContext } from "../context/TelemetryContext";
import { useRaceProgress } from "../hooks/useRaceProgress";
import { buildQualiChartSeries } from "../utils/qualiChart";

export function LiveTelemetryPage() {
  const {
    meta,
    track,
    selectedDriver,
    setSelectedDriver,
    selectQualiDriver,
  } = useSession();
  const playback = usePlaybackContext();
  const buffer = useTelemetryContext();
  const raceProgress = useRaceProgress();

  const isQuali = meta?.is_qualifying ?? false;
  const activeDriver = meta?.quali_active_driver ?? selectedDriver;
  const frameIndex = Math.floor(playback.frameIndex);

  const qualiCharts = useMemo(
    () =>
      buildQualiChartSeries(
        meta?.quali_active_trace,
        meta?.quali_comparison,
        frameIndex,
        meta?.circuit_length_m ?? null,
      ),
    [meta?.quali_active_trace, meta?.quali_comparison, meta?.circuit_length_m, frameIndex],
  );

  const raceSeries = useMemo(() => {
    if (isQuali || !selectedDriver) return null;
    return buffer.xMode === "time"
      ? buffer.getTimeSeries(selectedDriver)
      : buffer.getLapSeries(selectedDriver);
  }, [buffer.xMode, buffer.version, selectedDriver, isQuali]);

  const series = isQuali ? qualiCharts.series : raceSeries;
  const comparisonSeries = isQuali ? qualiCharts.comparison : null;

  if (!meta || !track) return null;

  const selected =
    playback.interpolatedDrivers.find(
      (d) => d.code === (isQuali ? activeDriver : selectedDriver),
    ) ??
    playback.interpolatedDrivers[0] ??
    null;

  const playheadX = useMemo(() => {
    if (isQuali) {
      return selected && meta.circuit_length_m
        ? selected.rel_dist * meta.circuit_length_m
        : raceProgress.leaderRelDist * (meta.circuit_length_m ?? 5000);
    }
    if (buffer.xMode === "lap" && selectedDriver) {
      return buffer.getLapPlayhead(selectedDriver);
    }
    return 0;
  }, [
    isQuali,
    buffer.xMode,
    buffer.version,
    selectedDriver,
    selected,
    meta.circuit_length_m,
    raceProgress.leaderRelDist,
    buffer,
  ]);

  const driverOptions = isQuali
    ? (meta.quali_results ?? []).map((r) => r.code)
    : playback.interpolatedDrivers.map((d) => d.code);

  const activeColor = activeDriver
    ? (meta.driver_colors[activeDriver] ?? "#888")
    : "#888";

  return (
    <div className="page-grid telemetry-page">
      <div className="telemetry-main">
        {isQuali && (
          <QualifyingComparisonBanner
            driverCode={activeDriver}
            segment={meta.quali_active_segment ?? null}
            lapTime={meta.lap_time}
            sectorTimes={meta.sector_times}
            compound={meta.compound}
            comparison={meta.quali_comparison}
            results={meta.quali_results}
            driverColor={activeColor}
          />
        )}

        <div className="chart-controls">
          {!isQuali && (
            <label className="xmode-toggle">
              <span>X Axis</span>
              <select
                value={buffer.xMode}
                onChange={(e) => buffer.setXMode(e.target.value as "time" | "lap")}
              >
                <option value="time">Last 30 seconds</option>
                <option value="lap">Current lap</option>
              </select>
            </label>
          )}
          <label className="driver-select">
            <span>Driver</span>
            <select
              value={(isQuali ? activeDriver : selectedDriver) ?? ""}
              onChange={(e) => {
                const code = e.target.value || null;
                if (!code) return;
                if (isQuali) void selectQualiDriver(code);
                else setSelectedDriver(code);
              }}
            >
              <option value="">Select driver…</option>
              {driverOptions.map((code) => (
                <option key={code} value={code}>
                  {code}
                  {!isQuali &&
                    playback.interpolatedDrivers.find((d) => d.code === code) &&
                    ` (P${playback.interpolatedDrivers.find((d) => d.code === code)!.position})`}
                </option>
              ))}
            </select>
          </label>
        </div>

        <DriverTelemetryCharts
          series={series}
          xMode={isQuali ? "lap" : buffer.xMode}
          driverCode={isQuali ? activeDriver ?? null : selectedDriver}
          playheadX={playheadX}
          comparison={isQuali ? meta.quali_comparison : null}
          comparisonSeries={comparisonSeries}
          circuitLengthM={meta.circuit_length_m}
          driverColor={activeColor}
          liveDriver={selected}
        />
      </div>

      <div className="telemetry-side">
        {!isQuali && (
          <>
            <TrackPositionMiniMap
              track={track}
              drivers={playback.interpolatedDrivers}
              driverColors={meta.driver_colors}
              leader={playback.leader}
              selectedDriver={selectedDriver}
              onSelectDriver={setSelectedDriver}
            />
            <WeatherTelemetryPanel weather={playback.currentFrame?.weather} />
          </>
        )}
      </div>
    </div>
  );
}
