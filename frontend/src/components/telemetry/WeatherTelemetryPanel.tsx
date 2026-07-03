import type { ReactNode } from "react";
import type { RaceFrame } from "../../types";
import {
  AirTempIcon,
  HumidityIcon,
  RainIcon,
  TrackTempIcon,
  WindIcon,
} from "../shared/WeatherIcons";

interface WeatherTelemetryPanelProps {
  weather?: RaceFrame["weather"];
}

interface MetricRowProps {
  icon: ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}

function MetricRow({ icon, label, value, accent = false }: MetricRowProps) {
  return (
    <div className={`weather-metric${accent ? " weather-metric-accent" : ""}`}>
      <div className="weather-metric-icon">{icon}</div>
      <div className="weather-metric-body">
        <span className="weather-metric-label">{label}</span>
        <span className="weather-metric-value">{value}</span>
      </div>
    </div>
  );
}

export function WeatherTelemetryPanel({ weather }: WeatherTelemetryPanelProps) {
  const raining = weather?.rain_state === "RAINING";

  if (!weather) {
    return (
      <div className="pit-card weather-telemetry-card">
        <h2 className="panel-title">Weather Telemetry</h2>
        <p className="weather-empty">Weather data unavailable — reload session to fetch track conditions.</p>
      </div>
    );
  }

  return (
    <div className="pit-card weather-telemetry-card">
      <h2 className="panel-title">Weather Telemetry</h2>
      <div className="weather-telemetry-grid">
        <MetricRow
          icon={<TrackTempIcon />}
          label="Track temp"
          value={weather.track_temp != null ? `${Math.round(weather.track_temp)}°C` : "—"}
        />
        <MetricRow
          icon={<AirTempIcon />}
          label="Air temp"
          value={weather.air_temp != null ? `${Math.round(weather.air_temp)}°C` : "—"}
        />
        <MetricRow
          icon={<HumidityIcon />}
          label="Humidity"
          value={weather.humidity != null ? `${Math.round(weather.humidity)}%` : "—"}
        />
        <MetricRow
          icon={<WindIcon direction={weather.wind_direction} />}
          label="Wind"
          value={weather.wind_speed != null ? `${weather.wind_speed.toFixed(1)} km/h` : "—"}
        />
        <MetricRow
          icon={<RainIcon raining={raining} />}
          label="Track state"
          value={raining ? "WET" : "DRY"}
          accent={raining}
        />
      </div>
    </div>
  );
}
