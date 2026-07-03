import { useEffect, useState } from "react";
import type { QualifyingResult } from "../../types";

interface QualifyingSegmentSelectorProps {
  driver: string;
  results: QualifyingResult[];
  activeSegment: string;
  onApply: (driver: string, segment: string) => Promise<void>;
  loading?: boolean;
}

function availableSegments(result: QualifyingResult | undefined): string[] {
  if (!result) return [];
  const segs: string[] = [];
  if (result.Q1) segs.push("Q1");
  if (result.Q2) segs.push("Q2");
  if (result.Q3) segs.push("Q3");
  return segs;
}

export function QualifyingSegmentSelector({
  driver,
  results,
  activeSegment,
  onApply,
  loading = false,
}: QualifyingSegmentSelectorProps) {
  const [segment, setSegment] = useState(activeSegment);
  const result = results.find((r) => r.code === driver);
  const segments = availableSegments(result);

  useEffect(() => {
    setSegment(activeSegment);
  }, [activeSegment]);

  const handleSelect = (seg: string) => {
    setSegment(seg);
    if (seg !== activeSegment) void onApply(driver, seg);
  };

  return (
    <div className="pit-card quali-segment-selector">
      <h3 className="card-title">Qualifying Runs</h3>
      <div className="segment-pills">
        {segments.map((s) => (
          <button
            key={s}
            type="button"
            className={`segment-pill${segment === s ? " active" : ""}${activeSegment === s ? " loaded" : ""}`}
            disabled={loading}
            onClick={() => handleSelect(s)}
            aria-pressed={segment === s}
          >
            {s}
            {activeSegment === s && <span className="pill-live">●</span>}
          </button>
        ))}
      </div>
      {loading && <p className="quali-loading">Loading lap trace…</p>}
    </div>
  );
}