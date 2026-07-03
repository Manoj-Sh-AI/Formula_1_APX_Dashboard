import type { RaceFrame } from "../../types";

interface WeatherStripProps {
  weather?: RaceFrame["weather"];
  compact?: boolean;
}

export function WeatherStrip({ weather, compact = false }: WeatherStripProps) {
  if (!weather) {
    return (
      <div className={`weather-strip${compact ? " weather-strip-compact" : ""}`}>
        <span className="weather-empty">Weather data unavailable</span>
      </div>
    );
  }

  const rain = weather.rain_state === "RAINING";

  return (
    <div className={`weather-strip${compact ? " weather-strip-compact" : ""}`}>
      <div className="weather-item">
        <span className="weather-label">Track</span>
        <span className="weather-value">
          {weather.track_temp != null ? `${Math.round(weather.track_temp)}°C` : "—"}
        </span>
      </div>
      <div className="weather-item">
        <span className="weather-label">Air</span>
        <span className="weather-value">
          {weather.air_temp != null ? `${Math.round(weather.air_temp)}°C` : "—"}
        </span>
      </div>
      <div className="weather-item">
        <span className="weather-label">Humidity</span>
        <span className="weather-value">
          {weather.humidity != null ? `${Math.round(weather.humidity)}%` : "—"}
        </span>
      </div>
      <div className="weather-item">
        <span className="weather-label">Wind</span>
        <span className="weather-value">
          {weather.wind_speed != null ? `${weather.wind_speed.toFixed(1)} km/h` : "—"}
        </span>
      </div>
      <div className="weather-item">
        <span className="weather-label">Rain</span>
        <span className={`weather-value${rain ? " rain-active" : ""}`}>
          {rain ? "WET" : "DRY"}
        </span>
      </div>
    </div>
  );
}
