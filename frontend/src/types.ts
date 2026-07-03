export interface DriverFrame {
  x: number;
  y: number;
  dist: number;
  lap: number;
  rel_dist: number;
  tyre: number;
  tyre_life: number;
  position: number;
  speed: number;
  gear: number;
  drs: number;
  throttle: number;
  brake: number;
  in_pit: boolean;
}

export interface RaceFrame {
  t: number;
  lap: number;
  drivers: Record<string, DriverFrame>;
  weather?: {
    track_temp: number | null;
    air_temp: number | null;
    humidity: number | null;
    wind_speed: number | null;
    wind_direction: number | null;
    rain_state: string;
  };
  safety_car?: {
    x: number;
    y: number;
    phase: string;
    alpha: number;
  } | null;
}

export interface TrackStatus {
  status: string;
  start_time: number;
  end_time: number | null;
}

export interface RaceControlMessage {
  time: number;
  category: string;
  message: string;
  flag: string;
  scope: string;
  sector: string;
  racing_number: string;
}

export interface SessionMeta {
  event_name: string;
  circuit_name: string;
  country: string;
  year: number;
  round: number;
  session_type: string;
  is_qualifying: boolean;
  total_laps: number;
  circuit_length_m: number | null;
  driver_colors: Record<string, string>;
  track_statuses: TrackStatus[];
  race_control_messages: RaceControlMessage[];
  frame_count: number;
  fps: number;
  source?: string;
  quali_results?: QualifyingResult[];
  quali_active_driver?: string;
  quali_active_segment?: string;
  sector_times?: SectorTimes;
  lap_time?: number;
  compound?: number;
  max_speed?: number;
  min_speed?: number;
  quali_comparison?: QualiComparisonTrace | null;
  quali_active_trace?: QualiComparisonTrace | null;
  timeline_events?: TimelineEvent[];
}

export interface TimelineEvent {
  frame_index: number;
  progress: number;
  kind: string;
  label: string;
  severity: string;
}

export interface QualifyingResult {
  code: string;
  full_name?: string;
  position: number;
  Q1: string | null;
  Q2: string | null;
  Q3: string | null;
}

export interface SectorTimes {
  sector1: number | null;
  sector2: number | null;
  sector3: number | null;
}

export interface QualiComparisonTrace {
  driver: string;
  segment: string;
  rel_dist: number[];
  speeds: number[];
  gears: number[];
  throttles: number[];
  brakes: number[];
  x?: number[];
  y?: number[];
}

export interface QualiGhostDriver {
  code: string;
  segment: string;
  x: number;
  y: number;
}

export interface TrackData {
  x: number[];
  y: number[];
  x_inner: number[];
  y_inner: number[];
  x_outer: number[];
  y_outer: number[];
  rotation_deg: number;
  bounds: {
    x_min: number;
    x_max: number;
    y_min: number;
    y_max: number;
  };
  drs_zones: {
    start: { x: number; y: number; index?: number };
    end: { x: number; y: number; index?: number };
  }[];
}

export interface InterpolatedDriver {
  code: string;
  x: number;
  y: number;
  position: number;
  speed: number;
  gear: number;
  drs: number;
  throttle: number;
  brake: number;
  tyre: number;
  tyre_life: number;
  lap: number;
  in_pit: boolean;
  rel_dist: number;
  dist?: number;
  gapToLeader?: number | null;
  interval?: number | null;
  tyreHealth?: number;
}

export interface PlaybackState {
  frameIndex: number;
  interpolatedDrivers: InterpolatedDriver[];
  currentFrame: RaceFrame | null;
  leader: string | null;
  trackStatus: string;
  raceTime: string;
}
