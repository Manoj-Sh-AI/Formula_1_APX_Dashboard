import type { QualiComparisonTrace, InterpolatedDriver } from "../../types";
import { CHART_COLORS } from "../../utils/tyreColors";

interface SeriesData {
  xs: number[];
  speeds: number[];
  gears: number[];
  throttles: number[];
  brakes: number[];
  xMin: number;
  xMax: number;
}

interface DriverTelemetryChartsProps {
  series: SeriesData | null;
  xMode: "time" | "lap";
  driverCode: string | null;
  playheadX?: number | null;
  comparison?: QualiComparisonTrace | null;
  comparisonSeries?: SeriesData | null;
  circuitLengthM?: number | null;
  driverColor?: string;
  liveDriver?: InterpolatedDriver | null;
}

function buildComparisonSeries(
  comparison: QualiComparisonTrace | null | undefined,
  circuitLengthM: number | null | undefined,
  xMax: number,
): SeriesData | null {
  if (!comparison?.rel_dist?.length) return null;
  const length = circuitLengthM ?? xMax;
  const xs = comparison.rel_dist.map((rd) => rd * length);
  return {
    xs,
    speeds: comparison.speeds,
    gears: comparison.gears,
    throttles: comparison.throttles,
    brakes: comparison.brakes,
    xMin: 0,
    xMax: length,
  };
}

function buildTicks(min: number, max: number, steps: number): number[] {
  if (steps <= 0 || max <= min) return [min];
  const step = (max - min) / steps;
  return Array.from({ length: steps + 1 }, (_, i) => min + step * i);
}

function formatXTick(value: number, xMode: "time" | "lap", xMax: number): string {
  if (xMode === "time") {
    return value === 0 ? "0" : `${Math.round(value)}`;
  }
  if (xMax >= 5000) {
    return `${(value / 1000).toFixed(1)}`;
  }
  return `${Math.round(value / 100) * 100}`;
}

function formatYTick(value: number, yMax: number): string {
  if (yMax <= 10) return String(Math.round(value));
  if (yMax <= 100) return String(Math.round(value));
  return String(Math.round(value / 10) * 10);
}

function xAxisLabel(xMode: "time" | "lap", xMax: number): string {
  if (xMode === "time") return "Time (s ago)";
  return xMax >= 5000 ? "Distance (km)" : "Distance (m)";
}

function LineChart({
  label,
  xs,
  ys,
  yMin,
  yMax,
  color,
  xMin,
  xMax,
  height,
  xMode,
  playheadX,
  compareXs,
  compareYs,
  compareColor = CHART_COLORS.pole,
}: {
  label: string;
  xs: number[];
  ys: number[];
  yMin: number;
  yMax: number;
  color: string;
  xMin: number;
  xMax: number;
  height: number;
  xMode: "time" | "lap";
  playheadX?: number | null;
  compareXs?: number[];
  compareYs?: number[];
  compareColor?: string;
}) {
  const W = 600;
  const pad = { top: 10, right: 12, bottom: 26, left: 44 };
  const innerW = W - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const scaleX = (x: number) =>
    pad.left + ((x - xMin) / Math.max(xMax - xMin, 1)) * innerW;
  const scaleY = (y: number) =>
    pad.top + innerH - ((y - yMin) / Math.max(yMax - yMin, 1)) * innerH;

  const xTicks =
    xMode === "time"
      ? [-30, -20, -10, 0]
      : buildTicks(xMin, xMax, 4);
  const yTicks = buildTicks(yMin, yMax, 4);

  const plotPoints = xs
    .map((x, i) => ({ x, y: ys[i] }))
    .filter(
      (p) =>
        p.x >= xMin &&
        p.x <= xMax &&
        p.y != null &&
        !Number.isNaN(p.y),
    );

  const points =
    plotPoints.length > 0
      ? plotPoints.map((p) => `${scaleX(p.x)},${scaleY(p.y)}`).join(" ")
      : "";

  const comparePlotPoints =
    compareXs && compareYs
      ? compareXs
          .map((x, i) => ({ x, y: compareYs[i] ?? 0 }))
          .filter((p) => p.x >= xMin && p.x <= xMax)
      : [];

  const comparePoints =
    comparePlotPoints.length > 0
      ? comparePlotPoints
          .map((p) => `${scaleX(p.x)},${scaleY(p.y)}`)
          .join(" ")
      : "";

  const phX =
    playheadX != null && playheadX >= xMin && playheadX <= xMax
      ? scaleX(playheadX)
      : null;

  const axisColor = CHART_COLORS.axis;
  const gridColor = CHART_COLORS.grid;
  const labelColor = CHART_COLORS.label;

  const currentY = ys.length > 0 ? ys[ys.length - 1] : null;

  return (
    <div className="chart-shell chart-panel">
      <div className="chart-label-row">
        <span className="chart-label">{label}</span>
        {currentY != null && (
          <span className="chart-current-value" style={{ color }}>
            {formatYTick(currentY, yMax)}
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${height}`} className="telemetry-chart chart-fade">
        <rect
          x={pad.left}
          y={pad.top}
          width={innerW}
          height={innerH}
          fill="#111"
          rx={2}
        />

        {yTicks.map((tick) => {
          const y = scaleY(tick);
          return (
            <g key={`y-${tick}`}>
              <line
                x1={pad.left}
                y1={y}
                x2={pad.left + innerW}
                y2={y}
                stroke={gridColor}
                strokeWidth={1}
              />
              <text
                x={pad.left - 6}
                y={y + 3}
                fill={labelColor}
                fontSize={9}
                textAnchor="end"
              >
                {formatYTick(tick, yMax)}
              </text>
            </g>
          );
        })}

        {xTicks.map((tick) => {
          const x = scaleX(tick);
          return (
            <g key={`x-${tick}`}>
              <line
                x1={x}
                y1={pad.top}
                x2={x}
                y2={pad.top + innerH}
                stroke={gridColor}
                strokeWidth={1}
              />
              <text
                x={x}
                y={pad.top + innerH + 14}
                fill={labelColor}
                fontSize={9}
                textAnchor="middle"
              >
                {formatXTick(tick, xMode, xMax)}
              </text>
            </g>
          );
        })}

        <line
          x1={pad.left}
          y1={pad.top + innerH}
          x2={pad.left + innerW}
          y2={pad.top + innerH}
          stroke={axisColor}
          strokeWidth={1}
        />
        <line
          x1={pad.left}
          y1={pad.top}
          x2={pad.left}
          y2={pad.top + innerH}
          stroke={axisColor}
          strokeWidth={1}
        />

        <text
          x={pad.left + innerW / 2}
          y={height - 2}
          fill={labelColor}
          fontSize={9}
          textAnchor="middle"
        >
          {xAxisLabel(xMode, xMax)}
        </text>

        {comparePoints && (
          <polyline
            points={comparePoints}
            fill="none"
            stroke={compareColor}
            strokeWidth={1.5}
            className="chart-compare-line"
          />
        )}
        {points && (
          <polyline
            points={points}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            className="chart-primary-line"
          />
        )}
        {phX != null && (
          <line
            x1={phX}
            y1={pad.top}
            x2={phX}
            y2={pad.top + innerH}
            stroke="rgba(255,255,255,0.55)"
            strokeWidth={1}
            strokeDasharray="3 3"
            className="chart-playhead"
          />
        )}
      </svg>
    </div>
  );
}

export function DriverTelemetryCharts({
  series,
  xMode,
  driverCode,
  playheadX,
  comparison,
  comparisonSeries,
  circuitLengthM,
  driverColor = CHART_COLORS.speed,
  liveDriver,
}: DriverTelemetryChartsProps) {
  if (!driverCode) {
    return (
      <div className="pit-card chart-card">
        <h2 className="panel-title">Telemetry Instruments</h2>
        <p className="telemetry-empty">Select a driver to view live charts</p>
      </div>
    );
  }

  if (!series) {
    return (
      <div className="pit-card chart-card">
        <h2 className="panel-title">Telemetry — {driverCode}</h2>
        <p className="telemetry-empty">Collecting telemetry samples…</p>
      </div>
    );
  }

  const xLabel = xMode === "time" ? "Last 30 seconds" : "Current lap";
  const ph = playheadX ?? (xMode === "time" ? 0 : null);
  const compare =
    comparisonSeries ??
    (xMode === "lap"
      ? buildComparisonSeries(comparison, circuitLengthM, series.xMax)
      : null);

  const chartProps = {
    xMin: series.xMin,
    xMax: series.xMax,
    xMode,
    playheadX: ph,
    compareXs: compare?.xs,
    height: 130,
  };

  return (
    <div className="pit-card chart-card">
      <h2 className="panel-title">
        <span style={{ color: driverColor }}>{driverCode}</span>
        <span className="chart-mode-badge">{xLabel}</span>
      </h2>
      {liveDriver && (
        <div className="data-strip telemetry-sample-rail">
          <div className="strip-item">
            <span className="strip-label">Speed</span>
            <span className="strip-value">{Math.round(liveDriver.speed)} km/h</span>
          </div>
          <div className="strip-item">
            <span className="strip-label">Gear</span>
            <span className="strip-value">{liveDriver.gear}</span>
          </div>
          <div className="strip-item">
            <span className="strip-label">Throttle</span>
            <span className="strip-value">{Math.round(liveDriver.throttle)}%</span>
          </div>
          <div className="strip-item">
            <span className="strip-label">Brake</span>
            <span className="strip-value">{Math.round(liveDriver.brake)}%</span>
          </div>
          <div className="strip-item">
            <span className="strip-label">DRS</span>
            <span className={`strip-value${liveDriver.drs >= 10 ? " drs-on" : ""}`}>
              {liveDriver.drs >= 10 ? "ON" : "OFF"}
            </span>
          </div>
        </div>
      )}
      {compare && (
        <p className="chart-compare-legend">
          <span className="pole-tag">POLE</span> {comparison?.driver} ·{" "}
          {comparison?.segment}
        </p>
      )}
      <div className="charts-stack">
        <LineChart
          label="Speed (km/h)"
          xs={series.xs}
          ys={series.speeds}
          yMin={0}
          yMax={380}
          color={driverColor}
          compareYs={compare?.speeds}
          {...chartProps}
        />
        <LineChart
          label="Gear"
          xs={series.xs}
          ys={series.gears}
          yMin={0}
          yMax={9}
          color={CHART_COLORS.gear}
          compareYs={compare?.gears}
          {...chartProps}
        />
        <LineChart
          label="Throttle (%)"
          xs={series.xs}
          ys={series.throttles}
          yMin={0}
          yMax={100}
          color={CHART_COLORS.throttle}
          compareYs={compare?.throttles}
          {...chartProps}
        />
        <LineChart
          label="Brake (%)"
          xs={series.xs}
          ys={series.brakes}
          yMin={0}
          yMax={100}
          color={CHART_COLORS.brake}
          compareYs={compare?.brakes}
          {...chartProps}
        />
      </div>
    </div>
  );
}
