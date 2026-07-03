import type { QualifyingResult, SectorTimes } from "../../types";
import { tyreInfo } from "../../utils/tyreColors";
import { bestQualiTime, formatPoleDelta } from "../../utils/qualifying";

interface QualifyingLapInfoProps {
  driverCode: string | null;
  segment: string | null;
  sectorTimes?: SectorTimes;
  lapTime?: number;
  compound?: number;
  speed?: number;
  gear?: number;
  drs?: number;
  results?: QualifyingResult[];
}

function formatSector(sec: number | null | undefined): string {
  if (sec == null || Number.isNaN(sec)) return "—";
  return sec.toFixed(3);
}

function formatLapTime(sec: number | undefined): string {
  if (sec == null) return "—";
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return m > 0 ? `${m}:${s.toFixed(3).padStart(6, "0")}` : s.toFixed(3);
}

function sectorClass(
  sector: number | null | undefined,
  sectors: SectorTimes | undefined,
): string {
  if (sector == null || !sectors) return "";
  const values = [sectors.sector1, sectors.sector2, sectors.sector3].filter(
    (v): v is number => v != null,
  );
  if (values.length < 2) return "";
  const best = Math.min(...values);
  const worst = Math.max(...values);
  if (sector === best) return " sector-best";
  if (sector === worst) return " sector-worst";
  return "";
}

export function QualifyingLapInfo({
  driverCode,
  segment,
  sectorTimes,
  lapTime,
  compound,
  speed,
  gear,
  drs,
  results,
}: QualifyingLapInfoProps) {
  const tyre = compound != null ? tyreInfo(compound) : null;
  const drsOn = drs != null && drs >= 10;
  const poleLap = results?.[0] ? bestQualiTime(results[0]) : null;
  const poleDelta = formatPoleDelta(lapTime, poleLap ?? undefined);

  return (
    <div className="pit-card quali-lap-info">
      <h3 className="card-title">
        {driverCode ?? "—"} · {segment ?? "—"}
        {poleDelta && (
          <span className={`quali-pole-delta${poleDelta.startsWith("+") ? " slower" : " faster"}`}>
            {poleDelta}
          </span>
        )}
      </h3>
      <div className="quali-lap-grid">
        <div className="metric-tile">
          <span className="label">Lap Time</span>
          <span className="value">{formatLapTime(lapTime)}</span>
        </div>
        <div className="metric-tile">
          <span className="label">Compound</span>
          <span className="value" style={{ color: tyre?.hex }}>
            {tyre?.abbr ?? "—"}
          </span>
        </div>
        <div className={`metric-tile${sectorClass(sectorTimes?.sector1, sectorTimes)}`}>
          <span className="label">S1</span>
          <span className="value">{formatSector(sectorTimes?.sector1)}</span>
        </div>
        <div className={`metric-tile${sectorClass(sectorTimes?.sector2, sectorTimes)}`}>
          <span className="label">S2</span>
          <span className="value">{formatSector(sectorTimes?.sector2)}</span>
        </div>
        <div className={`metric-tile${sectorClass(sectorTimes?.sector3, sectorTimes)}`}>
          <span className="label">S3</span>
          <span className="value">{formatSector(sectorTimes?.sector3)}</span>
        </div>
        <div className="metric-tile">
          <span className="label">Speed</span>
          <span className="value">
            {speed != null ? `${Math.round(speed)} km/h` : "—"}
          </span>
        </div>
        <div className="metric-tile">
          <span className="label">Gear</span>
          <span className="value">{gear ?? "—"}</span>
        </div>
        <div className="metric-tile">
          <span className="label">DRS</span>
          <span className={`value${drsOn ? " drs-on" : ""}`}>
            {drsOn ? "ON" : "OFF"}
          </span>
        </div>
      </div>
    </div>
  );
}