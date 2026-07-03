import { useDensity, type DensityMode } from "../../context/DensityContext";

const MODES: { id: DensityMode; label: string }[] = [
  { id: "operational", label: "Operational" },
  { id: "broadcast", label: "Broadcast" },
  { id: "focus", label: "Focus" },
];

interface DensityControlProps {
  compact?: boolean;
}

export function DensityControl({ compact = false }: DensityControlProps) {
  const { mode, setMode } = useDensity();

  if (compact) {
    return (
      <div className="density-control density-control-compact">
        {mode !== "operational" && (
          <button
            type="button"
            className="density-exit-btn"
            onClick={() => setMode("operational")}
            title="Return to normal layout (Esc)"
          >
            Reset layout
          </button>
        )}
        <select
          className="density-select"
          value={mode}
          onChange={(e) => setMode(e.target.value as DensityMode)}
          aria-label="Layout density"
        >
          {MODES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="density-control">
      <span className="density-control-label">Layout</span>
      <div className="density-segments">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`density-segment${mode === m.id ? " active" : ""}`}
            onClick={() => setMode(m.id)}
            aria-pressed={mode === m.id}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}
