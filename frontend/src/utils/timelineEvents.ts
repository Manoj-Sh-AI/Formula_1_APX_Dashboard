import type { RaceControlMessage, SessionMeta } from "../types";

export type TimelineMarkerKind =
  | "flag"
  | "sc"
  | "vsc"
  | "pit"
  | "rc"
  | "fastest";

export interface TimelineMarker {
  id: string;
  frameIndex: number;
  progress: number;
  kind: TimelineMarkerKind;
  label: string;
  severity: "info" | "warning" | "critical";
}

function flagSeverity(flag: string): "info" | "warning" | "critical" {
  const f = flag.toUpperCase();
  if (f.includes("RED")) return "critical";
  if (f.includes("YELLOW") || f.includes("DOUBLE")) return "warning";
  return "info";
}

function rcKind(event: RaceControlMessage): TimelineMarkerKind {
  const cat = event.category?.toLowerCase() ?? "";
  const flag = event.flag?.toUpperCase() ?? "";
  if (cat === "safetycar" || flag.includes("SC")) return "sc";
  if (flag.includes("VSC")) return "vsc";
  if (cat === "flag" || flag) return "flag";
  return "rc";
}

export function buildTimelineMarkers(
  meta: SessionMeta | null,
  totalFrames: number,
  fps: number,
): TimelineMarker[] {
  if (!meta || totalFrames <= 1) return [];

  const markers: TimelineMarker[] = [];

  for (const ts of meta.track_statuses ?? []) {
    const start = ts.start_time ?? 0;
    const frameIndex = Math.round(start * fps);
    const progress = frameIndex / (totalFrames - 1);
    const code = ts.status;
    let kind: TimelineMarkerKind = "flag";
    let label = `Track ${code}`;
    let severity: TimelineMarkerKind extends never ? never : "info" | "warning" | "critical" =
      "info";

    if (code === "4") {
      kind = "sc";
      label = "Safety Car";
      severity = "critical";
    } else if (code === "6" || code === "7") {
      kind = "vsc";
      label = "VSC";
      severity = "warning";
    } else if (code === "2") {
      label = "Yellow";
      severity = "warning";
    } else if (code === "5") {
      label = "Red Flag";
      severity = "critical";
    }

    markers.push({
      id: `ts-${start}-${code}`,
      frameIndex: Math.min(frameIndex, totalFrames - 1),
      progress: Math.min(1, Math.max(0, progress)),
      kind,
      label,
      severity,
    });
  }

  for (const event of meta.race_control_messages ?? []) {
    const frameIndex = Math.round(event.time * fps);
    const progress = frameIndex / (totalFrames - 1);
    const kind = rcKind(event);
    markers.push({
      id: `rc-${event.time}-${event.message.slice(0, 24)}`,
      frameIndex: Math.min(frameIndex, totalFrames - 1),
      progress: Math.min(1, Math.max(0, progress)),
      kind,
      label: event.message.slice(0, 40),
      severity: flagSeverity(event.flag || event.category),
    });
  }

  markers.sort((a, b) => a.frameIndex - b.frameIndex);

  const seen = new Set<number>();
  return markers.filter((m) => {
    const bucket = Math.floor(m.progress * 200);
    if (seen.has(bucket)) return false;
    seen.add(bucket);
    return true;
  });
}
