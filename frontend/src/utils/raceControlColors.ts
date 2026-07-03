import type { RaceControlMessage } from "../types";

const CAT_COLORS: Record<string, string> = {
  Flag: "var(--yellow, #f5c518)",
  SafetyCar: "var(--sc, #ff8c00)",
  Drs: "var(--green, #00d26a)",
  Other: "var(--muted, #6b7380)",
  CarEvent: "var(--text-secondary, #b4bac6)",
};

const FLAG_COLORS: Record<string, string> = {
  YELLOW: "var(--yellow, #f5c518)",
  "DOUBLE YELLOW": "var(--yellow, #f5c518)",
  RED: "var(--red, #ff3b3b)",
  GREEN: "var(--green, #00d26a)",
  CHEQUERED: "var(--text, #eef0f4)",
  BLUE: "#3498db",
  "BLACK AND WHITE": "var(--text-secondary, #b4bac6)",
  "BLACK AND ORANGE": "var(--sc, #ff8c00)",
  CLEAR: "var(--green, #00d26a)",
};

export function accentForEvent(event: RaceControlMessage): string {
  if (event.flag && FLAG_COLORS[event.flag.toUpperCase()]) {
    return FLAG_COLORS[event.flag.toUpperCase()];
  }
  return CAT_COLORS[event.category] ?? CAT_COLORS.Other;
}

export function formatRcTime(seconds: number): string {
  const t = Math.max(0, seconds);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function eventHash(event: RaceControlMessage): string {
  return `${event.time}|${event.message}`;
}
