import { useEffect, useRef } from "react";
import type { InterpolatedDriver, QualiGhostDriver, TrackData } from "../types";
import type { MapLayerState } from "../hooks/useMapLayers";
import type { MapTraceSample } from "../utils/mapTrace";
import type { TrackMapMeta } from "../utils/mapTrackMeta";
import { buildTrackMapMeta } from "../utils/mapTrackMeta";
import { detectBattles, detectDrsThreats } from "../utils/mapBattles";
import type { PitRejoinEstimate } from "../utils/pitRejoin";
import { buildScreenTransform } from "../utils/worldToScreen";
import {
  drawBattleConnectors,
  drawDrsBadges,
  drawDrsZonesEnhanced,
  drawPitMarkers,
  drawPitRejoinGhost,
  drawSectorMarkers,
  drawTelemetryTrace,
} from "./map/trackMapLayers";

interface TrackMapProps {
  track: TrackData;
  drivers: InterpolatedDriver[];
  driverColors: Record<string, string>;
  leader: string | null;
  selectedDriver: string | null;
  onSelectDriver: (code: string) => void;
  safetyCar?: { x: number; y: number; phase: string; alpha: number } | null;
  showDrsZones?: boolean;
  showDriverLabels?: boolean;
  trackStatus?: string;
  singleDriver?: boolean;
  ghostDriver?: QualiGhostDriver | null;
  mapLayers?: MapLayerState | null;
  traceSamples?: MapTraceSample[];
  pitRejoin?: { point: { x: number; y: number }; estimate: PitRejoinEstimate } | null;
}

function trackEdgeColor(status: string): string {
  switch (status) {
    case "2":
      return "#DCB400";
    case "4":
      return "#B4641E";
    case "5":
      return "#C81E1E";
    case "6":
    case "7":
      return "#C88232";
    default:
      return "#969696";
  }
}

function drawPolyline(
  ctx: CanvasRenderingContext2D,
  xs: number[],
  ys: number[],
  worldToScreen: (x: number, y: number) => [number, number],
  startIdx = 0,
  endIdx?: number,
) {
  const end = endIdx ?? xs.length - 1;
  if (end <= startIdx || xs.length < 2) return;
  ctx.beginPath();
  const [sx, sy] = worldToScreen(xs[startIdx], ys[startIdx]);
  ctx.moveTo(sx, sy);
  for (let i = startIdx + 1; i <= end && i < xs.length; i++) {
    const [px, py] = worldToScreen(xs[i], ys[i]);
    ctx.lineTo(px, py);
  }
  ctx.stroke();
}

function lerpAlpha(current: number, target: number, dt: number): number {
  const speed = 8;
  const t = 1 - Math.exp(-speed * dt);
  return current + (target - current) * t;
}

function nearestTrackNormal(
  x: number,
  y: number,
  track: TrackData,
  worldToScreen: (wx: number, wy: number) => [number, number],
): [number, number] {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < track.x.length; i++) {
    const d = (track.x[i] - x) ** 2 + (track.y[i] - y) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  const i0 = Math.max(0, best - 1);
  const i1 = Math.min(track.x.length - 1, best + 1);
  const [sx0, sy0] = worldToScreen(track.x[i0], track.y[i0]);
  const [sx1, sy1] = worldToScreen(track.x[i1], track.y[i1]);
  const tx = sx1 - sx0;
  const ty = sy1 - sy0;
  const len = Math.hypot(tx, ty) || 1;
  return [-ty / len, tx / len];
}

export function TrackMap({
  track,
  drivers,
  driverColors,
  leader,
  selectedDriver,
  onSelectDriver,
  safetyCar,
  showDrsZones = true,
  showDriverLabels = false,
  trackStatus = "1",
  singleDriver = false,
  ghostDriver = null,
  mapLayers = null,
  traceSamples = [],
  pitRejoin = null,
}: TrackMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<ReturnType<typeof buildScreenTransform> | null>(null);
  const sizeRef = useRef({ width: 0, height: 0 });
  const trackMetaRef = useRef<TrackMapMeta | null>(null);
  const pitAlphaRef = useRef<Map<string, number>>(new Map());
  const smoothPosRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const lastTimeRef = useRef(performance.now());

  const propsRef = useRef({
    track,
    drivers,
    driverColors,
    leader,
    selectedDriver,
    safetyCar,
    showDrsZones,
    showDriverLabels,
    trackStatus,
    singleDriver,
    ghostDriver,
    mapLayers,
    traceSamples,
    pitRejoin,
  });

  propsRef.current = {
    track,
    drivers,
    driverColors,
    leader,
    selectedDriver,
    safetyCar,
    showDrsZones,
    showDriverLabels,
    trackStatus,
    singleDriver,
    ghostDriver,
    mapLayers,
    traceSamples,
    pitRejoin,
  };

  useEffect(() => {
    trackMetaRef.current = buildTrackMapMeta(track);
  }, [track]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      sizeRef.current = { width: rect.width, height: rect.height };
      transformRef.current = buildScreenTransform({
        track: propsRef.current.track,
        width: rect.width,
        height: rect.height,
      });
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [track]);

  useEffect(() => {
    smoothPosRef.current.clear();
    pitAlphaRef.current.clear();
  }, [track]);

  useEffect(() => {
    let rafId = 0;

    const draw = (now: number) => {
      const canvas = canvasRef.current;
      const transform = transformRef.current;
      const meta = trackMetaRef.current;
      if (!canvas || !transform) {
        rafId = requestAnimationFrame(draw);
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        rafId = requestAnimationFrame(draw);
        return;
      }

      const dt = Math.min(0.05, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;

      const {
        track: t,
        drivers: drvs,
        driverColors: colors,
        leader: ldr,
        selectedDriver: sel,
        safetyCar: sc,
        showDrsZones: drsOn,
        showDriverLabels: labelsOn,
        trackStatus: ts,
        singleDriver: single,
        ghostDriver: ghost,
        mapLayers: layers,
        traceSamples: trace,
        pitRejoin: rejoin,
      } = propsRef.current;

      const dpr = window.devicePixelRatio || 1;
      const { width, height } = sizeRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const { worldToScreen } = transform;
      const edgeColor = trackEdgeColor(ts);

      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(0, 0, width, height);

      ctx.lineWidth = 14;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#383838";
      drawPolyline(ctx, t.x_outer, t.y_outer, worldToScreen);
      drawPolyline(ctx, t.x_inner, t.y_inner, worldToScreen);

      const showDrs = drsOn && (!layers || layers.drsZones);
      if (showDrs && t.drs_zones?.length) {
        drawDrsZonesEnhanced(ctx, t, worldToScreen);
      }

      ctx.lineWidth = 4;
      ctx.strokeStyle = edgeColor;
      drawPolyline(ctx, t.x_outer, t.y_outer, worldToScreen);
      drawPolyline(ctx, t.x_inner, t.y_inner, worldToScreen);

      ctx.lineWidth = 1;
      ctx.strokeStyle = "#2a2a2a";
      drawPolyline(ctx, t.x, t.y, worldToScreen);

      if (meta && layers?.sectors) {
        drawSectorMarkers(ctx, meta, worldToScreen);
      }
      if (meta && layers?.pitMarkers) {
        drawPitMarkers(ctx, meta, worldToScreen);
      }

      if (sc && sc.alpha > 0) {
        const [scx, scy] = worldToScreen(sc.x, sc.y);
        const pulse =
          sc.phase === "deploying" || sc.phase === "returning"
            ? 0.5 + 0.5 * Math.sin((now / 1000) * 8)
            : 1;
        ctx.globalAlpha = 0.35 * sc.alpha * pulse;
        ctx.beginPath();
        ctx.arc(scx, scy, 16 + pulse * 6, 0, Math.PI * 2);
        ctx.fillStyle = "#FFC800";
        ctx.fill();
        ctx.globalAlpha = Math.max(0.1, sc.alpha);
        ctx.beginPath();
        ctx.arc(scx, scy, 10, 0, Math.PI * 2);
        ctx.fillStyle = "#FF8C00";
        ctx.fill();
        ctx.strokeStyle = "#FFA500";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 9px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("SC", scx, scy + 3);
      }

      const visibleDrivers =
        single && sel ? drvs.filter((d) => d.code === sel) : drvs;

      const smoothPositions = new Map<string, { x: number; y: number }>();
      for (const driver of drvs) {
        const prevPos = smoothPosRef.current.get(driver.code);
        let wx = driver.x;
        let wy = driver.y;
        if (prevPos) {
          wx = lerpAlpha(prevPos.x, driver.x, dt);
          wy = lerpAlpha(prevPos.y, driver.y, dt);
        }
        smoothPosRef.current.set(driver.code, { x: wx, y: wy });
        smoothPositions.set(driver.code, { x: wx, y: wy });
      }

      if (ghost) {
        const [gx, gy] = worldToScreen(ghost.x, ghost.y);
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(gx, gy, 7, 0, Math.PI * 2);
        ctx.fillStyle = "#FFD700";
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }

      if (layers?.trace && trace.length >= 2) {
        drawTelemetryTrace(ctx, trace, layers.traceMode, worldToScreen);
      }

      if (layers?.battles && meta) {
        const battles = detectBattles(drvs, sel);
        drawBattleConnectors(ctx, battles, drvs, smoothPositions, worldToScreen);
        const drsThreats = detectDrsThreats(drvs, t, meta.ref, sel);
        drawDrsBadges(ctx, drsThreats, drvs, smoothPositions, worldToScreen);
      }

      if (layers?.pitRejoin && rejoin) {
        drawPitRejoinGhost(ctx, rejoin.point, rejoin.estimate, worldToScreen);
      }

      visibleDrivers.forEach((driver, idx) => {
        const targetAlpha = driver.in_pit ? 0.45 : 1;
        const prevA = pitAlphaRef.current.get(driver.code) ?? targetAlpha;
        const alpha = lerpAlpha(prevA, targetAlpha, dt);
        pitAlphaRef.current.set(driver.code, alpha);

        const pos = smoothPositions.get(driver.code) ?? { x: driver.x, y: driver.y };
        const wx = pos.x;
        const wy = pos.y;

        const [dx, dy] = worldToScreen(wx, wy);
        const color = colors[driver.code] ?? "#AAAAAA";
        const isLeader = driver.code === ldr;
        const isSelected = driver.code === sel;
        const radius = isLeader || single ? 7 : 5;
        const showLabel = labelsOn || isSelected;

        ctx.globalAlpha = alpha;

        if (isLeader && !single) {
          ctx.beginPath();
          ctx.arc(dx, dy, radius + 8, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255, 215, 0, 0.35)";
          ctx.fill();
        }

        if (isSelected) {
          const selPulse = 0.5 + 0.5 * Math.sin((now / 1000) * 6);
          ctx.beginPath();
          ctx.arc(dx, dy, radius + 4 + selPulse * 2, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255, 255, 255, ${0.6 + selPulse * 0.4})`;
          ctx.lineWidth = 2;
          ctx.stroke();
        } else if (isLeader && !single) {
          ctx.beginPath();
          ctx.arc(dx, dy, radius + 4, 0, Math.PI * 2);
          ctx.strokeStyle = "#FFD700";
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(dx, dy, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 1;
        ctx.stroke();

        if (showLabel) {
          const [nx, ny] = nearestTrackNormal(wx, wy, t, worldToScreen);
          const offset = idx % 2 === 0 ? 45 : 75;
          const lx = dx + nx * offset;
          const ly = dy + ny * offset;
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(dx, dy);
          ctx.lineTo(lx, ly);
          ctx.stroke();
          ctx.fillStyle = "#FFFFFF";
          ctx.font = "bold 12px sans-serif";
          ctx.textAlign = nx >= 0 ? "left" : "right";
          ctx.fillText(driver.code, lx + (nx >= 0 ? 4 : -4), ly + 4);
        }

        ctx.globalAlpha = 1;
      });

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [track]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const transform = transformRef.current;
    if (!canvas || !transform) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    let closest: string | null = null;
    let closestDist = 20;

    for (const driver of drivers) {
      const pos = smoothPosRef.current.get(driver.code) ?? { x: driver.x, y: driver.y };
      const [dx, dy] = transform.worldToScreen(pos.x, pos.y);
      const dist = Math.hypot(dx - mx, dy - my);
      if (dist < closestDist) {
        closestDist = dist;
        closest = driver.code;
      }
    }

    if (closest) onSelectDriver(closest);
  };

  return (
    <div ref={containerRef} className="track-map-container">
      <canvas ref={canvasRef} onClick={handleClick} className="track-map-canvas" />
    </div>
  );
}
