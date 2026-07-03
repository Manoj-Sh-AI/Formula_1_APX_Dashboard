import type { QualifyingResult } from "../../types";

interface QualifyingResultsBoardProps {
  results: QualifyingResult[];
  activeDriver: string | null;
  onSelectDriver: (code: string) => void;
}

function formatTime(raw: string | null): string {
  if (!raw) return "—";
  const sec = parseFloat(raw);
  if (Number.isNaN(sec)) return raw;
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return m > 0 ? `${m}:${s.toFixed(3).padStart(6, "0")}` : s.toFixed(3);
}

export function QualifyingResultsBoard({
  results,
  activeDriver,
  onSelectDriver,
}: QualifyingResultsBoardProps) {
  return (
    <div className="pit-card quali-results-board">
      <h2 className="panel-title">Qualifying Results</h2>
      <div className="quali-results-header">
        <span>Pos</span>
        <span>Driver</span>
        <span>Q1</span>
        <span>Q2</span>
        <span>Q3</span>
      </div>
      <div className="quali-results-rows">
        {results.map((row) => (
          <button
            key={row.code}
            type="button"
            className={`quali-results-row${row.code === activeDriver ? " active" : ""}${row.position <= 3 ? " podium" : ""}`}
            onClick={() => onSelectDriver(row.code)}
            aria-pressed={row.code === activeDriver}
          >
            <span className="quali-pos">{row.position}</span>
            <span className="quali-code">{row.code}</span>
            <span className="quali-time">{formatTime(row.Q1)}</span>
            <span className="quali-time">{formatTime(row.Q2)}</span>
            <span className="quali-time">{formatTime(row.Q3)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}