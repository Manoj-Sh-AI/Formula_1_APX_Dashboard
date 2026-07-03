import type { InterpolatedDriver } from "../../types";
import { trackStatusLabel } from "../../utils/worldToScreen";
import { rawTyreLabel } from "../../hooks/useTelemetryBuffer";

interface TelemetryInspectorProps {
  driver: InterpolatedDriver | null;
  driverColor: string;
  driverCount: number;
  trackStatus: string;
  isPlaying: boolean;
  frameIndex: number;
  totalFrames: number;
  raceTime: string;
}

export function TelemetryInspector({
  driver,
  driverColor,
  driverCount,
  trackStatus,
  isPlaying,
  frameIndex,
  totalFrames,
  raceTime,
}: TelemetryInspectorProps) {
  return (
    <div className="pit-card inspector-card">
      <h2 className="panel-title">Inspector</h2>

      <div className="data-strip inspector-strip">
        <div className="strip-item">
          <span className="strip-label">Time</span>
          <span className="strip-value">{raceTime}</span>
        </div>
        <div className="strip-item">
          <span className="strip-label">Status</span>
          <span className="strip-value">{trackStatusLabel(trackStatus)}</span>
        </div>
        <div className="strip-item">
          <span className="strip-label">Drivers</span>
          <span className="strip-value">{driverCount}</span>
        </div>
        <div className="strip-item">
          <span className="strip-label">Frame</span>
          <span className="strip-value">
            {frameIndex + 1}/{totalFrames}
          </span>
        </div>
        <div className="strip-item">
          <span className="strip-label">State</span>
          <span className={`strip-value${isPlaying ? " live-pulse" : ""}`}>
            {isPlaying ? "LIVE" : "PAUSED"}
          </span>
        </div>
      </div>

      <h3 className="inspector-subtitle">Selected driver</h3>
      {!driver ? (
        <p className="telemetry-empty">No driver selected</p>
      ) : (
        <div className="raw-telemetry">
          <div className="raw-header">
            <span className="driver-dot" style={{ backgroundColor: driverColor }} />
            <strong>{driver.code}</strong>
            <span>P{driver.position}</span>
          </div>
          <div className="inspector-metrics">
            <div className="metric-tile">
              <span className="label">Speed</span>
              <span className="value">{Math.round(driver.speed)}</span>
            </div>
            <div className="metric-tile">
              <span className="label">Gear</span>
              <span className="value">{driver.gear}</span>
            </div>
            <div className="metric-tile">
              <span className="label">DRS</span>
              <span className="value">{driver.drs >= 10 ? "ON" : "OFF"}</span>
            </div>
            <div className="metric-tile">
              <span className="label">Tyre</span>
              <span className="value">{rawTyreLabel(driver.tyre)}</span>
            </div>
            <div className="metric-tile">
              <span className="label">Lap</span>
              <span className="value">{driver.lap}</span>
            </div>
            <div className="metric-tile">
              <span className="label">Rel dist</span>
              <span className="value">{driver.rel_dist.toFixed(4)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
