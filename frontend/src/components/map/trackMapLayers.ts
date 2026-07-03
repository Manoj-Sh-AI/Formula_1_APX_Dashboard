import type { InterpolatedDriver, TrackData } from "../../types";
import type { MapLayerState } from "../../hooks/useMapLayers";
import type { MapTraceSample } from "../../utils/mapTrace";
import { traceColor } from "../../utils/mapTrace";
import type { BattlePair, DrsThreat } from "../../utils/mapBattles";
import type { TrackMapMeta } from "../../utils/mapTrackMeta";
import type { PitRejoinEstimate } from "../../utils/pitRejoin";

type WorldToScreen = (x: number, y: number) => [number, number];

export function drawSectorMarkers(
  ctx: CanvasRenderingContext2D,
  meta: TrackMapMeta,
  worldToScreen: WorldToScreen,
) {
  for (const sector of meta.sectors) {
    if (sector.label === "S/F") continue;
    const [sx, sy] = worldToScreen(sector.x, sector.y);
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.font = "bold 9px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(sector.label, sx, sy - 6);
    ctx.beginPath();
    ctx.arc(sx, sy, 3, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.fill();
  }

  const [fx, fy] = worldToScreen(meta.finishLine.x, meta.finishLine.y);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(fx - 8, fy - 8);
  ctx.lineTo(fx + 8, fy + 8);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 8px sans-serif";
  ctx.fillText("S/F", fx + 10, fy - 4);
}

export function drawPitMarkers(
  ctx: CanvasRenderingContext2D,
  meta: TrackMapMeta,
  worldToScreen: WorldToScreen,
) {
  for (const pt of [meta.pitEntry, meta.pitExit]) {
    const [sx, sy] = worldToScreen(pt.x, pt.y);
    ctx.beginPath();
    ctx.arc(sx, sy, 5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 140, 0, 0.9)";
    ctx.fill();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#ffb347";
    ctx.font = "bold 8px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(pt.label ?? "", sx, sy - 10);
  }
}

export function drawBattleConnectors(
  ctx: CanvasRenderingContext2D,
  battles: BattlePair[],
  drivers: InterpolatedDriver[],
  positions: Map<string, { x: number; y: number }>,
  worldToScreen: WorldToScreen,
) {
  for (const battle of battles) {
    const ahead = drivers.find((d) => d.code === battle.ahead);
    const behind = drivers.find((d) => d.code === battle.behind);
    if (!ahead || !behind) continue;

    const pa = positions.get(ahead.code) ?? { x: ahead.x, y: ahead.y };
    const pb = positions.get(behind.code) ?? { x: behind.x, y: behind.y };
    const [ax, ay] = worldToScreen(pa.x, pa.y);
    const [bx, by] = worldToScreen(pb.x, pb.y);

    ctx.strokeStyle = battle.emphasize
      ? "rgba(255, 60, 60, 0.75)"
      : "rgba(255, 255, 255, 0.25)";
    ctx.lineWidth = battle.emphasize ? 2 : 1;
    ctx.setLineDash(battle.emphasize ? [] : [3, 3]);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.setLineDash([]);

    if (battle.emphasize) {
      const mx = (ax + bx) / 2;
      const my = (ay + by) / 2;
      ctx.fillStyle = "rgba(255, 80, 80, 0.9)";
      ctx.font = "bold 8px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${battle.interval.toFixed(1)}s`, mx, my - 4);
    }
  }
}

export function drawDrsBadges(
  ctx: CanvasRenderingContext2D,
  threats: DrsThreat[],
  drivers: InterpolatedDriver[],
  positions: Map<string, { x: number; y: number }>,
  worldToScreen: WorldToScreen,
) {
  for (const threat of threats) {
    const attacker = drivers.find((d) => d.code === threat.attacker);
    if (!attacker) continue;
    const pos = positions.get(attacker.code) ?? { x: attacker.x, y: attacker.y };
    const [sx, sy] = worldToScreen(pos.x, pos.y);

    ctx.fillStyle = "rgba(0, 255, 100, 0.95)";
    ctx.font = "bold 7px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("DRS", sx, sy - 12);
  }
}

export function drawTelemetryTrace(
  ctx: CanvasRenderingContext2D,
  samples: MapTraceSample[],
  traceMode: MapLayerState["traceMode"],
  worldToScreen: WorldToScreen,
) {
  if (samples.length < 2) return;

  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    const [x0, y0] = worldToScreen(a.x, a.y);
    const [x1, y1] = worldToScreen(b.x, b.y);
    ctx.strokeStyle = traceColor(b, traceMode);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.35 + (i / samples.length) * 0.55;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export function drawPitRejoinGhost(
  ctx: CanvasRenderingContext2D,
  point: { x: number; y: number },
  estimate: PitRejoinEstimate,
  worldToScreen: WorldToScreen,
) {
  const [sx, sy] = worldToScreen(point.x, point.y);
  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = "rgba(255, 165, 0, 0.85)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(sx, sy, 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(255, 165, 0, 0.35)";
  ctx.beginPath();
  ctx.arc(sx, sy, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffb347";
  ctx.font = "bold 9px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`REJOIN P${estimate.rejoinPosition}`, sx, sy - 14);
  if (estimate.gapAhead != null && estimate.carAhead) {
    ctx.font = "8px monospace";
    ctx.fillStyle = "rgba(255, 200, 120, 0.9)";
    ctx.fillText(
      `+${estimate.gapAhead.toFixed(1)}s to ${estimate.carAhead}`,
      sx,
      sy + 18,
    );
  }
}

export function drawDrsZonesEnhanced(
  ctx: CanvasRenderingContext2D,
  track: TrackData,
  worldToScreen: WorldToScreen,
) {
  if (!track.drs_zones?.length) return;
  ctx.lineWidth = 8;
  ctx.strokeStyle = "rgba(0, 255, 80, 0.35)";
  ctx.lineCap = "round";
  for (const zone of track.drs_zones) {
    const sIdx = zone.start.index;
    const eIdx = zone.end.index;
    if (sIdx != null && eIdx != null && eIdx > sIdx) {
      drawPolylineSegment(ctx, track.x_outer, track.y_outer, worldToScreen, sIdx, eIdx);
    }
  }
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(0, 255, 80, 0.9)";
  for (const zone of track.drs_zones) {
    const sIdx = zone.start.index;
    const eIdx = zone.end.index;
    if (sIdx != null && eIdx != null && eIdx > sIdx) {
      drawPolylineSegment(ctx, track.x_outer, track.y_outer, worldToScreen, sIdx, eIdx);
      const [lx, ly] = worldToScreen(zone.start.x, zone.start.y);
      ctx.fillStyle = "#00ff66";
      ctx.font = "bold 7px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("DRS", lx + 4, ly - 4);
    }
  }
}

function drawPolylineSegment(
  ctx: CanvasRenderingContext2D,
  xs: number[],
  ys: number[],
  worldToScreen: WorldToScreen,
  startIdx: number,
  endIdx: number,
) {
  if (endIdx <= startIdx || xs.length < 2) return;
  ctx.beginPath();
  const [sx, sy] = worldToScreen(xs[startIdx], ys[startIdx]);
  ctx.moveTo(sx, sy);
  for (let i = startIdx + 1; i <= endIdx && i < xs.length; i++) {
    const [px, py] = worldToScreen(xs[i], ys[i]);
    ctx.lineTo(px, py);
  }
  ctx.stroke();
}
