import { useEffect, useRef } from "react";
import type { RaceControlMessage } from "../../types";
import {
  accentForEvent,
  formatRcTime,
} from "../../utils/raceControlColors";

interface RaceControlFeedProps {
  events: RaceControlMessage[];
  hasData: boolean;
  currentTime: number;
}

function cleanSector(val: string): string {
  if (!val) return "";
  const f = Number(val);
  if (Number.isNaN(f)) return val;
  return String(Math.round(f));
}

function isFlagEvent(event: RaceControlMessage): boolean {
  const cat = event.category?.toLowerCase() ?? "";
  const flag = event.flag?.toUpperCase() ?? "";
  return (
    cat === "flag" ||
    cat === "safetycar" ||
    ["YELLOW", "RED", "DOUBLE YELLOW", "CHEQUERED"].includes(flag)
  );
}

function severityClass(event: RaceControlMessage): string {
  const flag = event.flag?.toUpperCase() ?? "";
  const cat = event.category?.toLowerCase() ?? "";
  if (flag.includes("RED") || cat === "safetycar") return "rc-severity-critical";
  if (flag.includes("YELLOW") || flag.includes("DOUBLE")) return "rc-severity-warning";
  if (cat === "drs") return "rc-severity-info";
  return "rc-severity-normal";
}

export function RaceControlFeed({
  events,
  hasData,
  currentTime,
}: RaceControlFeedProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const prevLen = useRef(0);
  const latestKey = events.length > 0
    ? `${events[events.length - 1].time}|${events[events.length - 1].message}`
    : "";

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (events.length > prevLen.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
    prevLen.current = events.length;
  }, [events.length, currentTime]);

  if (!hasData) {
    return (
      <div className="pit-card rc-feed">
        <h2 className="panel-title">Race Control</h2>
        <p className="telemetry-empty">
          No race control data available for this session.
        </p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="pit-card rc-feed">
        <h2 className="panel-title">Race Control</h2>
        <p className="telemetry-empty">Waiting for race control messages…</p>
      </div>
    );
  }

  return (
    <div className="pit-card rc-feed">
      <h2 className="panel-title">Race Control · Event Tape</h2>
      <div className="rc-list" ref={listRef}>
        {events.map((event) => {
          const accent = accentForEvent(event);
          const sector = cleanSector(event.sector);
          const key = `${event.time}|${event.message}`;
          const isLatest = key === latestKey;
          const flagPulse = isLatest && isFlagEvent(event);

          return (
            <div
              className={`rc-item rc-item-enter ${severityClass(event)}${flagPulse ? " rc-item-flag-pulse" : ""}${isLatest ? " rc-item-latest" : ""}`}
              key={key}
            >
              <div className="rc-accent" style={{ backgroundColor: accent }} />
              <div className="rc-time">{formatRcTime(event.time)}</div>
              <div className="rc-body">
                <div className="rc-message">{event.message}</div>
                {(event.flag || event.category) && (
                  <div className="rc-meta">
                    {event.flag && <span className="rc-flag">{event.flag}</span>}
                    {event.category && (
                      <span className="rc-category">{event.category}</span>
                    )}
                  </div>
                )}
                {sector && <div className="rc-sector">Sector {sector}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
