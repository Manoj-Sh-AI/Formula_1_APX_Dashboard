import type { MapLayerState, TraceColorMode } from "../../hooks/useMapLayers";

type LayerToggleKey = keyof Omit<MapLayerState, "traceMode">;

interface MapLayerControlsProps {
  layers: MapLayerState;
  onToggle: (key: LayerToggleKey) => void;
  onTraceMode: (mode: TraceColorMode) => void;
  showLabels: boolean;
  onToggleLabels: () => void;
  isQuali?: boolean;
}

const TOGGLES: {
  key: LayerToggleKey;
  label: string;
  raceOnly?: boolean;
}[] = [
  { key: "drsZones", label: "DRS" },
  { key: "sectors", label: "Sectors" },
  { key: "pitMarkers", label: "Pit", raceOnly: true },
  { key: "battles", label: "Battles", raceOnly: true },
  { key: "trace", label: "Trace", raceOnly: true },
  { key: "pitRejoin", label: "Rejoin", raceOnly: true },
];

export function MapLayerControls({
  layers,
  onToggle,
  onTraceMode,
  showLabels,
  onToggleLabels,
  isQuali = false,
}: MapLayerControlsProps) {
  return (
    <div className="map-layer-controls">
      <button
        type="button"
        className={`map-layer-toggle${showLabels ? " active" : ""}`}
        onClick={onToggleLabels}
        aria-pressed={showLabels}
      >
        Labels
      </button>
      {TOGGLES.filter((t) => !isQuali || !t.raceOnly).map(({ key, label }) => (
        <button
          key={key}
          type="button"
          className={`map-layer-toggle${layers[key] ? " active" : ""}`}
          onClick={() => onToggle(key)}
          aria-pressed={layers[key]}
        >
          {label}
        </button>
      ))}
      {!isQuali && layers.trace && (
        <select
          className="map-trace-mode-select"
          value={layers.traceMode}
          onChange={(e) => onTraceMode(e.target.value as TraceColorMode)}
          aria-label="Trace color mode"
        >
          <option value="speed">Speed</option>
          <option value="throttle">Throttle</option>
          <option value="brake">Brake</option>
          <option value="drs">DRS</option>
        </select>
      )}
    </div>
  );
}
