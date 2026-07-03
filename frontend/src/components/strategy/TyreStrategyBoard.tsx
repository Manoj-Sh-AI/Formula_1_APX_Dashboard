import { useEffect, useRef, useState } from "react";

import type { DriverStrategyRow } from "../../hooks/useTyreStrategy";

import { TYRE_COLORS } from "../../utils/tyreColors";

import { tyreGradientCss, tyreTextColor } from "../../utils/tyreGradients";

import { StrategyHeader } from "./StrategyHeader";



interface TyreStrategyBoardProps {
  rows: DriverStrategyRow[];
  totalLaps: number;
  currentLap: number;
  lapMarkerPct: number;
  displayLap?: string;
  filter?: "all" | "selected" | "top10";
  selectedDriver?: string | null;
  healthByDriver?: Record<string, number>;
}



function posBadgeClass(position: number): string {

  if (position === 1) return "stint-pos stint-pos-p1";

  if (position <= 3) return "stint-pos stint-pos-podium";

  return "stint-pos";

}



function stintWidthLaps(
  stint: DriverStrategyRow["stints"][number],
  lapProgress: number,
): number {
  if (stint.end_lap != null) {
    return Math.max(0, stint.end_lap - stint.start_lap);
  }
  return Math.max(0, lapProgress - (stint.start_lap - 1));
}

function StintRow({

  row,

  totalLaps,

  rowIndex,

  posFlash,

  newStintKeys,

  barTrackWidth,

  tyreHealth,

}: {

  row: DriverStrategyRow;

  totalLaps: number;

  rowIndex: number;

  posFlash: "up" | "down" | null;

  newStintKeys: Set<string>;

  barTrackWidth: number;

  tyreHealth?: number;

}) {

  const barWidth = 100;



  return (

    <div

      className="stint-row animate-fade-in"

      style={{ "--row-i": rowIndex } as React.CSSProperties}

    >

      <div

        className={`${posBadgeClass(row.position)}${posFlash ? ` stint-pos-flash-${posFlash}` : ""}`}

      >

        {row.position}

      </div>

      <div className="stint-code">
        {row.code}
        {tyreHealth != null && (
          <span className={`health-tag ${tyreHealth >= 75 ? "health-good" : tyreHealth >= 50 ? "health-warn" : tyreHealth >= 25 ? "health-low" : "health-critical"}`}>
            {tyreHealth}%
          </span>
        )}
      </div>

      <div className="stint-bar-track">

        {row.stints.map((stint) => {

          const tyre = stint.tyre;

          const info = TYRE_COLORS[tyre] ?? TYRE_COLORS[0];

          const widthLaps = stintWidthLaps(stint, row.lapProgress);

          const left = ((stint.start_lap - 1) / totalLaps) * barWidth;

          const widthPx =

            Math.max((widthLaps / totalLaps) * barTrackWidth, 2) /

            Math.max(barTrackWidth, 1) *

            barWidth;

          const stintKey = `${row.code}-${stint.start_lap}-${tyre}`;

          const isNew = newStintKeys.has(stintKey);

          const widthPxActual = Math.max(

            (widthLaps / totalLaps) * barTrackWidth,

            2,

          );



          return (

            <div

              key={stintKey}

              className={`stint-block${isNew ? " stint-block-new" : ""}`}

              style={{

                left: `${left}%`,

                width: `${widthPx}%`,

                background: tyreGradientCss(stint.tyre),

                color: tyreTextColor(stint.tyre),

              }}

              title={`${info.name} L${stint.start_lap}–${stint.end_lap ?? "…"}`}

            >

              {widthPxActual > 14 ? info.abbr : ""}

            </div>

          );

        })}

      </div>

    </div>

  );

}



export function TyreStrategyBoard({

  rows,

  totalLaps,

  currentLap,

  lapMarkerPct,

  displayLap,

  filter = "all",

  selectedDriver,

  healthByDriver = {},

}: TyreStrategyBoardProps) {

  const step = Math.max(1, Math.floor(totalLaps / 10));

  const prevPositions = useRef<Map<string, number>>(new Map());

  const prevStintCounts = useRef<Map<string, number>>(new Map());

  const barTrackRef = useRef<HTMLDivElement>(null);

  const [barTrackWidth, setBarTrackWidth] = useState(400);

  const [posFlashes, setPosFlashes] = useState<

    Record<string, "up" | "down" | null>

  >({});

  const [newStintKeys, setNewStintKeys] = useState<Set<string>>(new Set());



  useEffect(() => {

    const el = barTrackRef.current;

    if (!el) return;

    const ro = new ResizeObserver(() => {

      setBarTrackWidth(el.clientWidth || 400);

    });

    ro.observe(el);

    setBarTrackWidth(el.clientWidth || 400);

    return () => ro.disconnect();

  }, []);



  useEffect(() => {

    const flashes: Record<string, "up" | "down" | null> = {};

    const newKeys = new Set<string>();



    for (const row of rows) {

      const prev = prevPositions.current.get(row.code);

      if (prev !== undefined && prev !== row.position) {

        flashes[row.code] = row.position < prev ? "up" : "down";

      }

      prevPositions.current.set(row.code, row.position);



      const stintCount = row.stints.length;

      const prevCount = prevStintCounts.current.get(row.code) ?? 0;

      if (stintCount > prevCount && prevCount > 0) {

        const latest = row.stints[row.stints.length - 1];

        newKeys.add(`${row.code}-${latest.start_lap}-${latest.tyre}`);

      }

      prevStintCounts.current.set(row.code, stintCount);

    }



    if (Object.keys(flashes).length > 0) {

      setPosFlashes(flashes);

      const t = setTimeout(() => setPosFlashes({}), 400);

      return () => clearTimeout(t);

    }



    if (newKeys.size > 0) {

      setNewStintKeys(newKeys);

      const t = setTimeout(() => setNewStintKeys(new Set()), 600);

      return () => clearTimeout(t);

    }

  }, [rows]);



  const showLapMarker = currentLap > 1;

  const filteredRows = rows.filter((row) => {
    if (filter === "selected") return row.code === selectedDriver;
    if (filter === "top10") return row.position <= 10;
    return true;
  });



  return (

    <div className="pit-card strategy-board strategy-board-polished">

      <StrategyHeader

        currentLap={currentLap}

        totalLaps={totalLaps}

        displayLap={displayLap}

      />



      <div className="tyre-legend strategy-legend">

        {Object.entries(TYRE_COLORS)

          .filter(([k]) => k !== "0" && k !== "6")

          .map(([, info]) => (

            <span key={info.abbr} style={{ color: info.hex }}>

              ● {info.name}

            </span>

          ))}

      </div>



      <div className="stint-rows-wrapper" ref={barTrackRef}>

        {showLapMarker && (

          <div

            className="shared-lap-marker transition-x"

            style={{ left: `${lapMarkerPct}%` }}

          />

        )}

        <div className="stint-rows">

          {filteredRows.length === 0 ? (

            <p className="telemetry-empty">No drivers match this filter…</p>

          ) : (

            filteredRows.map((row, i) => (

              <StintRow

                key={row.code}

                row={row}

                totalLaps={totalLaps}

                rowIndex={i}

                posFlash={posFlashes[row.code] ?? null}

                newStintKeys={newStintKeys}

                barTrackWidth={barTrackWidth}

                tyreHealth={healthByDriver[row.code]}

              />

            ))

          )}

        </div>

      </div>



      <div className="lap-axis strategy-lap-axis">

        {Array.from({ length: Math.floor(totalLaps / step) + 1 }, (_, i) => {

          const lap = i * step;

          return (

            <span

              key={lap}

              className="lap-tick"

              style={{ left: `${(lap / totalLaps) * 100}%` }}

            >

              {lap}

            </span>

          );

        })}

      </div>



      <div className="strategy-status">

        ● Live · {filteredRows.length} drivers · Lap {displayLap ?? currentLap}

      </div>

    </div>

  );

}

