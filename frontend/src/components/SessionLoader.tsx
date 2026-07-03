import { useCallback, useEffect, useMemo, useState } from "react";
import {
  sessionTypesForEvent,
  type ScheduleEvent,
} from "../utils/sessionTypes";

interface SessionLoaderProps {
  onLoaded: () => void;
  defaultYear?: number;
  defaultRound?: number;
  defaultSessionType?: string;
  autoFetch?: boolean;
  onBeforeLoad?: () => void;
}

type LoadStatus = "idle" | "loading" | "ready" | "error";

interface RecentSession {
  year: number;
  round: number;
  sessionType: string;
  eventName: string;
  loadedAt: number;
}

const RECENT_KEY = "apx-pitwall-recent-sessions";
const MAX_RECENT = 5;

function readRecent(): RecentSession[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as RecentSession[]) : [];
  } catch {
    return [];
  }
}

function saveRecent(entry: RecentSession) {
  const list = readRecent().filter(
    (s) =>
      !(
        s.year === entry.year &&
        s.round === entry.round &&
        s.sessionType === entry.sessionType
      ),
  );
  list.unshift(entry);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
}

const LOAD_STAGES = [
  "Connecting to FastF1…",
  "Loading session telemetry…",
  "Building frame index…",
  "Preparing pit-wall dashboards…",
];

export function SessionLoader({
  onLoaded,
  defaultYear = 2025,
  defaultRound = 6,
  defaultSessionType = "R",
  autoFetch = false,
  onBeforeLoad,
}: SessionLoaderProps) {
  const [year, setYear] = useState(defaultYear);
  const [round, setRound] = useState(defaultRound);
  const [sessionType, setSessionType] = useState(defaultSessionType);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [message, setMessage] = useState("");
  const [stageIndex, setStageIndex] = useState(0);
  const [recent, setRecent] = useState<RecentSession[]>(readRecent);

  const loadSchedule = useCallback(async (selectedYear: number) => {
    setScheduleLoading(true);
    setScheduleError(null);
    try {
      const r = await fetch(`/api/schedule?year=${selectedYear}`);
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.detail || "Could not load season schedule");
      }
      const data = await r.json();
      const list: ScheduleEvent[] = data.events ?? [];
      setEvents(list);
      if (list.length > 0) {
        setRound((prev) => {
          const match = list.find((e) => e.round_number === prev);
          return match ? prev : list[0].round_number;
        });
      }
    } catch (e) {
      setEvents([]);
      setScheduleError(e instanceof Error ? e.message : "Schedule unavailable");
    } finally {
      setScheduleLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSchedule(year);
  }, [year, loadSchedule]);

  useEffect(() => {
    if (status !== "loading") return;
    const id = setInterval(() => {
      setStageIndex((i) => (i + 1) % LOAD_STAGES.length);
    }, 2200);
    return () => clearInterval(id);
  }, [status]);

  const selectedEvent = events.find((e) => e.round_number === round);
  const availableSessionTypes = useMemo(
    () => sessionTypesForEvent(selectedEvent),
    [selectedEvent],
  );

  useEffect(() => {
    if (availableSessionTypes.length === 0) return;
    const valid = availableSessionTypes.some((st) => st.value === sessionType);
    if (!valid) {
      setSessionType(availableSessionTypes[0].value);
    }
  }, [availableSessionTypes, sessionType]);

  const pollStatus = async () => {
    const r = await fetch("/api/session/load/status");
    const data = await r.json();
    setMessage(data.message || data.status);

    if (data.status === "ready") {
      setStatus("ready");
      if (selectedEvent) {
        saveRecent({
          year,
          round,
          sessionType,
          eventName: selectedEvent.event_name,
          loadedAt: Date.now(),
        });
        setRecent(readRecent());
      }
      onLoaded();
      return;
    }
    if (data.status === "error") {
      setStatus("error");
      setMessage(data.error || "Fetch failed");
      return;
    }
    if (data.status === "loading" || data.status === "started") {
      setTimeout(pollStatus, 2000);
    }
  };

  const handleFetch = async () => {
    onBeforeLoad?.();
    setStatus("loading");
    setStageIndex(0);
    setMessage(LOAD_STAGES[0]);

    const r = await fetch(
      `/api/session/load?year=${year}&round=${round}&session_type=${sessionType}`,
      { method: "POST" },
    );
    const data = await r.json();

    if (data.status === "ready") {
      setStatus("ready");
      if (selectedEvent) {
        saveRecent({
          year,
          round,
          sessionType,
          eventName: selectedEvent.event_name,
          loadedAt: Date.now(),
        });
        setRecent(readRecent());
      }
      onLoaded();
      return;
    }

    if (data.status === "error") {
      setStatus("error");
      setMessage(data.error || data.message || "Fetch failed");
      return;
    }

    setMessage(data.message || LOAD_STAGES[0]);
    setTimeout(pollStatus, 1500);
  };

  const loadRecent = (s: RecentSession) => {
    setYear(s.year);
    setRound(s.round);
    setSessionType(s.sessionType);
    void (async () => {
      onBeforeLoad?.();
      setStatus("loading");
      setStageIndex(0);
      setMessage(LOAD_STAGES[0]);
      const r = await fetch(
        `/api/session/load?year=${s.year}&round=${s.round}&session_type=${s.sessionType}`,
        { method: "POST" },
      );
      const data = await r.json();
      if (data.status === "ready") {
        setStatus("ready");
        saveRecent({ ...s, loadedAt: Date.now() });
        setRecent(readRecent());
        onLoaded();
        return;
      }
      setMessage(data.message || LOAD_STAGES[0]);
      setTimeout(pollStatus, 1500);
    })();
  };

  useEffect(() => {
    if (autoFetch) {
      void handleFetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFetch]);

  const isSprintWeekend = selectedEvent?.type?.toLowerCase().includes("sprint");

  return (
    <div className="session-page">
      <div className="session-loader-card">
        <h1>
          <span className="loader-brand">APX</span> Pit Wall
        </h1>
        <p className="loader-sub">Race weekend command center · FastF1 live memory</p>

        {selectedEvent && (
          <div className="event-card">
            <div className="event-card-header">
              <span className="event-round">R{selectedEvent.round_number}</span>
              <span className="event-name">{selectedEvent.event_name}</span>
              {isSprintWeekend && <span className="sprint-badge">Sprint</span>}
            </div>
            <div className="event-card-meta">
              {selectedEvent.country} · {selectedEvent.date}
            </div>
            <div className="event-sessions">
              {availableSessionTypes.map((st) => (
                <button
                  key={st.value}
                  type="button"
                  className={`session-chip${sessionType === st.value ? " active" : ""}`}
                  onClick={() => setSessionType(st.value)}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="loader-form">
          <label>
            Season
            <input
              type="number"
              value={year}
              min={2018}
              max={2026}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </label>
          <label className="loader-form-wide">
            Grand Prix
            <select
              value={round}
              disabled={scheduleLoading || events.length === 0}
              onChange={(e) => setRound(Number(e.target.value))}
            >
              {events.length === 0 ? (
                <option value={round}>
                  {scheduleLoading ? "Loading schedule…" : "No events found"}
                </option>
              ) : (
                events.map((ev) => (
                  <option key={ev.round_number} value={ev.round_number}>
                    R{ev.round_number} — {ev.event_name}
                  </option>
                ))
              )}
            </select>
          </label>
        </div>

        {scheduleError && (
          <p className="loader-msg error-msg">{scheduleError}</p>
        )}

        <button
          type="button"
          className="fetch-btn"
          onClick={handleFetch}
          disabled={
            status === "loading" ||
            scheduleLoading ||
            events.length === 0 ||
            availableSessionTypes.length === 0
          }
        >
          {status === "loading" ? "Loading session…" : "Load Session"}
        </button>

        {status === "loading" && (
          <div className="load-progress">
            <div className="load-stage">{message || LOAD_STAGES[stageIndex]}</div>
            <div className="load-bar">
              <div
                className="load-bar-fill"
                style={{ width: `${((stageIndex + 1) / LOAD_STAGES.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {message && status !== "loading" && (
          <p className={`loader-msg${status === "error" ? " error-msg" : ""}`}>
            {message}
          </p>
        )}

        {recent.length > 0 && (
          <div className="recent-sessions">
            <h3 className="card-title">Recent Sessions</h3>
            <div className="recent-list">
              {recent.map((s) => (
                <button
                  key={`${s.year}-${s.round}-${s.sessionType}`}
                  type="button"
                  className="recent-item"
                  onClick={() => loadRecent(s)}
                >
                  <span className="recent-name">{s.eventName}</span>
                  <span className="recent-meta">
                    {s.year} · R{s.round} · {s.sessionType}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
