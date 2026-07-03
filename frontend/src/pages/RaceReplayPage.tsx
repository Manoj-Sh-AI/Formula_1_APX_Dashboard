import { useEffect, useMemo, useState } from "react";
import { Leaderboard } from "../components/Leaderboard";
import { DriverTelemetry } from "../components/DriverTelemetry";
import { TrackMap } from "../components/TrackMap";
import { MapLayerControls } from "../components/map/MapLayerControls";
import { QualifyingResultsBoard } from "../components/qualifying/QualifyingResultsBoard";
import { QualifyingSegmentSelector } from "../components/qualifying/QualifyingSegmentSelector";
import { useSession } from "../context/SessionContext";
import { usePlaybackContext } from "../context/PlaybackContext";
import { useTelemetryContext } from "../context/TelemetryContext";
import { useMapLayers } from "../hooks/useMapLayers";
import { interpolateQualiGhost } from "../utils/qualiChart";
import { buildTrackMapMeta } from "../utils/mapTrackMeta";
import { referencePointAtRelDist } from "../utils/trackProjection";
import { estimatePitRejoin } from "../utils/pitRejoin";

export function RaceReplayPage() {
  const {
    meta,
    track,
    selectedDriver,
    setSelectedDriver,
    selectQualiDriver,
    selectQualiRun,
    qualiLoading,
  } = useSession();
  const playback = usePlaybackContext();
  const telemetry = useTelemetryContext();
  const { layers, toggle, setTraceMode } = useMapLayers();
  const [showLabels, setShowLabels] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "KeyL") {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
        setShowLabels((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isQuali = meta?.is_qualifying ?? false;

  const traceSamples = useMemo(() => {
    if (!meta || !track || isQuali || !selectedDriver || !layers.trace) return [];
    return telemetry.getMapTrace(selectedDriver);
  }, [meta, track, isQuali, selectedDriver, layers.trace, telemetry.version, telemetry]);

  const selectedForRejoin =
    meta && track
      ? playback.interpolatedDrivers.find((d) => d.code === selectedDriver) ??
        playback.interpolatedDrivers[0] ??
        null
      : null;

  const pitRejoin = useMemo(() => {
    if (!meta || !track || isQuali || !selectedForRejoin || !layers.pitRejoin) return null;
    const estimate = estimatePitRejoin(selectedForRejoin, playback.interpolatedDrivers);
    const lapLen = meta.circuit_length_m ?? 5000;
    const relDist = Math.max(0, Math.min(1, (estimate.projectedDist % lapLen) / lapLen));
    const trackMeta = buildTrackMapMeta(track);
    const [x, y] = referencePointAtRelDist(relDist, trackMeta.ref);
    return { point: { x, y }, estimate };
  }, [
    meta,
    track,
    isQuali,
    selectedForRejoin,
    layers.pitRejoin,
    playback.interpolatedDrivers,
  ]);

  const ghostDriver = useMemo(
    () =>
      isQuali && meta
        ? interpolateQualiGhost(meta.quali_comparison, playback.frameIndex)
        : null,
    [isQuali, meta, playback.frameIndex],
  );

  if (!meta || !track) return null;

  const selected =
    playback.interpolatedDrivers.find((d) => d.code === selectedDriver) ??
    playback.interpolatedDrivers[0] ??
    null;

  const qualiResults = meta.quali_results ?? [];
  const activeDriver = meta.quali_active_driver ?? selectedDriver;

  return (
    <div className="page-grid replay-page">
      <section className="map-section pit-card-hero">
        <div className="map-toolbar">
          <span className="map-toolbar-title">Track Map</span>
          <MapLayerControls
            layers={layers}
            onToggle={toggle}
            onTraceMode={setTraceMode}
            showLabels={showLabels}
            onToggleLabels={() => setShowLabels((v) => !v)}
            isQuali={isQuali}
          />
          {isQuali && meta.quali_comparison && (
            <span className="map-ghost-label">
              <span className="pole-tag">POLE</span> {meta.quali_comparison.driver}
            </span>
          )}
        </div>
        <TrackMap
          track={track}
          drivers={playback.interpolatedDrivers}
          driverColors={meta.driver_colors}
          leader={playback.leader}
          selectedDriver={selectedDriver ?? activeDriver}
          onSelectDriver={
            isQuali ? (code) => void selectQualiDriver(code) : setSelectedDriver
          }
          safetyCar={playback.currentFrame?.safety_car}
          showDriverLabels={showLabels}
          showDrsZones={layers.drsZones}
          trackStatus={playback.trackStatus}
          singleDriver={isQuali}
          ghostDriver={ghostDriver}
          mapLayers={isQuali ? null : layers}
          traceSamples={traceSamples}
          pitRejoin={pitRejoin}
        />
      </section>

      <aside className="data-panel">
        {isQuali ? (
          <>
            <QualifyingResultsBoard
              results={qualiResults}
              activeDriver={activeDriver ?? null}
              onSelectDriver={(code) => void selectQualiDriver(code)}
            />
            <QualifyingSegmentSelector
              driver={activeDriver ?? selectedDriver ?? ""}
              results={qualiResults}
              activeSegment={meta.quali_active_segment ?? "Q1"}
              loading={qualiLoading}
              onApply={selectQualiRun}
            />
          </>
        ) : (
          <>
            <Leaderboard
              drivers={playback.interpolatedDrivers}
              driverColors={meta.driver_colors}
              leader={playback.leader}
              selectedDriver={selectedDriver}
              onSelectDriver={setSelectedDriver}
            />
            <DriverTelemetry
              driver={selected}
              driverColor={
                selectedDriver
                  ? (meta.driver_colors[selectedDriver] ?? "#888")
                  : "#888"
              }
            />
          </>
        )}
      </aside>
    </div>
  );
}
