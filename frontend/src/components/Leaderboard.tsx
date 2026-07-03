import { useMemo, useRef } from "react";
import type { InterpolatedDriver } from "../types";
import { TYRE_LABELS } from "../utils/worldToScreen";
import { tyreInfo } from "../utils/tyreColors";
import { formatGapSeconds, formatInterval } from "../utils/gaps";
import { tyreHealthClass, tyreHealthLabel } from "../utils/tyreHealth";
import { useFlipListAnimation } from "../hooks/useFlipListAnimation";

interface LeaderboardProps {
  drivers: InterpolatedDriver[];
  driverColors: Record<string, string>;
  leader: string | null;
  selectedDriver: string | null;
  onSelectDriver: (code: string) => void;
}

export function Leaderboard({
  drivers,
  driverColors,
  leader,
  selectedDriver,
  onSelectDriver,
}: LeaderboardProps) {
  const listRef = useRef<HTMLDivElement>(null);

  const sorted = useMemo(
    () => [...drivers].sort((a, b) => a.position - b.position),
    [drivers],
  );

  useFlipListAnimation(
    listRef,
    sorted.map((d) => d.code),
  );

  return (
    <div className="pit-card leaderboard">
      <h2 className="panel-title">Timing</h2>
      <div className="leaderboard-header">
        <span>Pos</span>
        <span>Driver</span>
        <span>Tyre</span>
        <span>Age</span>
        <span>Health</span>
        <span>Gap</span>
      </div>
      <div className="leaderboard-list" ref={listRef}>
        {sorted.map((d) => {
          const isOut = d.rel_dist >= 1;
          const drsOn = d.drs >= 10;
          const tyre = tyreInfo(d.tyre);
          const health = d.tyreHealth ?? 100;
          const gapLabel =
            d.code === leader
              ? "LEAD"
              : formatGapSeconds(d.gapToLeader ?? null);
          const intervalLabel = formatInterval(
            d.interval ?? null,
            d.position > 1
              ? sorted.find((x) => x.position === d.position - 1)?.code ?? null
              : null,
          );

          return (
            <button
              key={d.code}
              type="button"
              data-flip-key={d.code}
              className={[
                "leaderboard-row",
                selectedDriver === d.code ? "selected" : "",
                d.code === leader ? "leader" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onSelectDriver(d.code)}
              aria-pressed={selectedDriver === d.code}
            >
              <span className="pos">P{d.position}</span>
              <span className="driver-cell">
                <span
                  className="driver-dot"
                  style={{ backgroundColor: driverColors[d.code] ?? "#888" }}
                />
                <span className="code">{d.code}</span>
              </span>
              <span className="tyre" style={{ color: tyre.hex }}>
                {TYRE_LABELS[Math.round(d.tyre)] ?? "?"}
              </span>
              <span className="lap-tag">L{Math.round(d.tyre_life ?? 0)}</span>
              <span className={`health-tag ${tyreHealthClass(health)}`} title={tyreHealthLabel(health)}>
                {health}%
              </span>
              <span className="gap-col">
                <span
                  className={`drs-dot${drsOn ? " drs-dot-on" : ""}`}
                  title={drsOn ? "DRS open" : "DRS closed"}
                />
                <span className="gap" title={`Interval ${intervalLabel}`}>
                  {gapLabel}
                </span>
                {d.in_pit && <span className="tag pit">PIT</span>}
                {isOut && <span className="tag out">OUT</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
