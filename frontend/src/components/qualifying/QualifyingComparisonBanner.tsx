import type { QualiComparisonTrace, SectorTimes } from "../../types";
import { bestQualiTime, formatPoleDelta } from "../../utils/qualifying";
import type { QualifyingResult } from "../../types";

interface QualifyingComparisonBannerProps {
  driverCode: string | null;
  segment: string | null;
  lapTime?: number;
  sectorTimes?: SectorTimes;
  compound?: number;
  comparison?: QualiComparisonTrace | null;
  results?: QualifyingResult[];
  driverColor?: string;
}

function formatLapTime(sec: number | undefined): string {
  if (sec == null) return "—";
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return m > 0 ? `${m}:${s.toFixed(3).padStart(6, "0")}` : s.toFixed(3);
}

export function QualifyingComparisonBanner({
  driverCode,
  segment,
  lapTime,
  sectorTimes,
  comparison,
  results,
  driverColor = "#eef0f4",
}: QualifyingComparisonBannerProps) {
  const poleLap = results?.[0] ? bestQualiTime(results[0]) : null;
  const poleDelta = formatPoleDelta(lapTime, poleLap ?? undefined);

  return (
    <div className="quali-comparison-banner">
      <div className="quali-banner-left">
        <span
          className="quali-banner-driver"
          style={{ borderColor: driverColor, color: driverColor }}
        >
          {driverCode ?? "—"}
        </span>
        <span className="quali-banner-segment">{segment ?? "—"}</span>
        <span className="quali-banner-lap">{formatLapTime(lapTime)}</span>
        {poleDelta && (
          <span className={`quali-banner-delta${poleDelta.startsWith("+") ? " slower" : " faster"}`}>
            {poleDelta}
          </span>
        )}
      </div>
      <div className="quali-banner-sectors">
        <span>S1 {sectorTimes?.sector1?.toFixed(3) ?? "—"}</span>
        <span>S2 {sectorTimes?.sector2?.toFixed(3) ?? "—"}</span>
        <span>S3 {sectorTimes?.sector3?.toFixed(3) ?? "—"}</span>
      </div>
      {comparison && (
        <div className="quali-banner-pole">
          <span className="pole-tag">POLE</span>
          <span>
            {comparison.driver} · {comparison.segment}
          </span>
        </div>
      )}
    </div>
  );
}
