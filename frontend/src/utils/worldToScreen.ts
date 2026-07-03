import type { TrackData } from "../types";

export interface TransformParams {
  track: TrackData;
  width: number;
  height: number;
  padding?: number;
}

export interface ScreenTransform {
  worldToScreen: (x: number, y: number) => [number, number];
  scale: number;
}

function rotateAboutCenter(
  x: number,
  y: number,
  cx: number,
  cy: number,
  cos: number,
  sin: number,
): [number, number] {
  const tx = x - cx;
  const ty = y - cy;
  return [tx * cos - ty * sin + cx, tx * sin + ty * cos + cy];
}

export function buildScreenTransform({
  track,
  width,
  height,
  padding = 0.05,
}: TransformParams): ScreenTransform {
  const { bounds, rotation_deg } = track;
  const worldCx = (bounds.x_min + bounds.x_max) / 2;
  const worldCy = (bounds.y_min + bounds.y_max) / 2;
  const rad = (rotation_deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const rotated: [number, number][] = [];
  for (let i = 0; i < track.x_inner.length; i++) {
    rotated.push(rotateAboutCenter(track.x_inner[i], track.y_inner[i], worldCx, worldCy, cos, sin));
    rotated.push(rotateAboutCenter(track.x_outer[i], track.y_outer[i], worldCx, worldCy, cos, sin));
  }

  const xs = rotated.map((p) => p[0]);
  const ys = rotated.map((p) => p[1]);
  const worldXMin = Math.min(...xs);
  const worldXMax = Math.max(...xs);
  const worldYMin = Math.min(...ys);
  const worldYMax = Math.max(...ys);

  const worldW = Math.max(1, worldXMax - worldXMin);
  const worldH = Math.max(1, worldYMax - worldYMin);

  const rotCx = (worldXMin + worldXMax) / 2;
  const rotCy = (worldYMin + worldYMax) / 2;

  const padX = width * padding;
  const padY = height * padding;
  const usableW = width - padX * 2;
  const usableH = height - padY * 2;
  const scale = Math.min(usableW / worldW, usableH / worldH);

  const screenCx = width / 2;
  const screenCy = height / 2;
  const tx = screenCx - scale * rotCx;
  const ty = screenCy - scale * rotCy;

  const worldToScreen = (x: number, y: number): [number, number] => {
    let [rx, ry] = rotateAboutCenter(x, y, worldCx, worldCy, cos, sin);
    const sx = scale * rx + tx;
    const syWorld = scale * ry + ty;
    const sy = height - syWorld;
    return [sx, sy];
  };

  return { worldToScreen, scale };
}

export function formatRaceTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function getTrackStatusAtTime(
  statuses: { status: string; start_time: number; end_time: number | null }[],
  t: number,
): string {
  for (const s of statuses) {
    const end = s.end_time ?? Infinity;
    if (t >= s.start_time && t < end) {
      return s.status;
    }
  }
  return "1";
}

export function trackStatusLabel(code: string): string {
  switch (code) {
    case "2":
      return "YELLOW";
    case "4":
      return "SAFETY CAR";
    case "5":
      return "RED FLAG";
    case "6":
    case "7":
      return "VSC";
    default:
      return "GREEN";
  }
}

export const TYRE_LABELS: Record<number, string> = {
  0: "S",
  1: "M",
  2: "H",
  3: "I",
  4: "W",
};

export const PLAYBACK_SPEEDS = [0.5, 1, 2, 4];
