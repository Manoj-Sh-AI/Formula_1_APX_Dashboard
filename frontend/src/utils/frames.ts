import type { DriverFrame, RaceFrame } from "../types";

/** Slim wire format: [x,y,pos,speed,gear,drs,throttle,brake,tyre,lap,in_pit,rel_dist,tyre_life,dist] */
type SlimDriver = number[];

export interface SlimFrame {
  t: number;
  lap: number;
  d: Record<string, SlimDriver>;
  sc?: [number, number, number];
  w?: [number | null, number | null, number | null, number | null, number];
}

export interface FramesManifest {
  total_frames: number;
  fps: number;
  source?: string;
}

export function expandSlimFrame(slim: SlimFrame): RaceFrame {
  const drivers: Record<string, DriverFrame> = {};
  for (const [code, arr] of Object.entries(slim.d)) {
    drivers[code] = {
      x: arr[0],
      y: arr[1],
      position: arr[2],
      speed: arr[3],
      gear: arr[4],
      drs: arr[5],
      throttle: arr[6],
      brake: arr[7],
      tyre: arr[8],
      lap: arr[9],
      in_pit: arr[10] === 1,
      rel_dist: arr[11] ?? 0,
      tyre_life: arr[12] ?? 0,
      dist: arr[13] ?? 0,
    };
  }

  const frame: RaceFrame = { t: slim.t, lap: slim.lap, drivers };
  if (slim.sc) {
    frame.safety_car = {
      x: slim.sc[0],
      y: slim.sc[1],
      phase: "on_track",
      alpha: slim.sc[2],
    };
  }
  if (slim.w) {
    frame.weather = {
      track_temp: slim.w[0],
      air_temp: slim.w[1],
      humidity: slim.w[2],
      wind_speed: slim.w[3],
      wind_direction: null,
      rain_state: slim.w[4] === 1 ? "RAINING" : "DRY",
    };
  }
  return frame;
}

export async function fetchManifest(): Promise<FramesManifest> {
  const r = await fetch("/api/frames/manifest");
  if (!r.ok) throw new Error("No session in memory. Load a session first.");
  return r.json();
}

export async function fetchFrame(index: number): Promise<RaceFrame> {
  const r = await fetch(`/api/frames/${index}`);
  if (!r.ok) throw new Error(`Frame ${index} not available`);
  const slim: SlimFrame = await r.json();
  return expandSlimFrame(slim);
}
