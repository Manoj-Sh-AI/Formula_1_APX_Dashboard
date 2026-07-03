import { useEffect, useRef } from "react";
import type { InterpolatedDriver } from "../types";
import { TYRE_LABELS } from "../utils/worldToScreen";
import { tyreInfo } from "../utils/tyreColors";

interface DriverTelemetryProps {
  driver: InterpolatedDriver | null;
  driverColor: string;
}

export function DriverTelemetry({ driver, driverColor }: DriverTelemetryProps) {
  const prevSpeed = useRef<number | null>(null);
  const speedRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!driver || !speedRef.current) return;
    const prev = prevSpeed.current;
    if (prev !== null && Math.abs(driver.speed - prev) > 5) {
      speedRef.current.classList.remove("speed-pulse");
      void speedRef.current.offsetWidth;
      speedRef.current.classList.add("speed-pulse");
    }
    prevSpeed.current = driver.speed;
  }, [driver?.speed]);

  if (!driver) {
    return (
      <div className="pit-card telemetry">
        <h2 className="panel-title">Driver Telemetry</h2>
        <p className="telemetry-empty">Select a driver on the map or timing board</p>
      </div>
    );
  }

  const drsActive = driver.drs >= 10;
  const tyre = tyreInfo(driver.tyre);

  return (
    <div
      className="pit-card telemetry telemetry-selected"
      style={{ "--driver-accent": driverColor } as React.CSSProperties}
    >
      <h2 className="panel-title">
        <span className="driver-dot" style={{ backgroundColor: driverColor }} />
        {driver.code}
        <span className="telemetry-pos">P{driver.position}</span>
      </h2>

      <div className="data-strip telemetry-strip">
        <div className="strip-item">
          <span className="strip-label">Speed</span>
          <span ref={speedRef} className="strip-value">
            {Math.round(driver.speed)} km/h
          </span>
        </div>
        <div className="strip-item">
          <span className="strip-label">Gear</span>
          <span className="strip-value">{driver.gear}</span>
        </div>
        <div className="strip-item">
          <span className="strip-label">DRS</span>
          <span className={`strip-value${drsActive ? " drs-on" : ""}`}>
            {drsActive ? "ON" : "OFF"}
          </span>
        </div>
        <div className="strip-item">
          <span className="strip-label">Tyre</span>
          <span className="strip-value" style={{ color: tyre.hex }}>
            {TYRE_LABELS[Math.round(driver.tyre)] ?? "?"}
          </span>
        </div>
        <div className="strip-item">
          <span className="strip-label">Age</span>
          <span className="strip-value">L{driver.tyre_life ?? 0}</span>
        </div>
        <div className="strip-item">
          <span className="strip-label">Lap</span>
          <span className="strip-value">{driver.lap}</span>
        </div>
      </div>

      <div className="telemetry-bars">
        <div className="telemetry-stat wide">
          <span className="label">Throttle</span>
          <div className="bar-track">
            <div className="bar-fill throttle" style={{ width: `${driver.throttle}%` }} />
          </div>
          <span className="bar-value">{Math.round(driver.throttle)}%</span>
        </div>
        <div className="telemetry-stat wide">
          <span className="label">Brake</span>
          <div className="bar-track">
            <div className="bar-fill brake" style={{ width: `${driver.brake}%` }} />
          </div>
          <span className="bar-value">{Math.round(driver.brake)}%</span>
        </div>
      </div>
    </div>
  );
}
