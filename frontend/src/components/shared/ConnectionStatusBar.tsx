import { useEffect, useState } from "react";

export function ConnectionStatusBar() {
  const [status, setStatus] = useState<"checking" | "ready" | "idle" | "error">(
    "checking",
  );
  const [detail, setDetail] = useState("");

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await fetch("/api/health");
        const data = await r.json();
        if (cancelled) return;
        setStatus(data.status === "ready" ? "ready" : "idle");
        setDetail(
          data.status === "ready"
            ? `${data.total_frames ?? data.frame_count ?? 0} frames in memory`
            : "No session loaded",
        );
      } catch {
        if (!cancelled) {
          setStatus("error");
          setDetail("API unreachable — check backend");
        }
      }
    };
    void poll();
    const id = setInterval(poll, 10000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (status === "ready") {
    return (
      <div className={`connection-bar status-${status}`} aria-live="polite">
        <span className="connection-dot" />
        <span className="connection-detail">{detail}</span>
      </div>
    );
  }

  return (
    <div className={`connection-bar status-${status}`} aria-live="polite">
      <span
        className={`connection-dot${status === "checking" ? " dot-pulse" : ""}`}
      />
      <span className="connection-label">
        {status === "idle"
          ? "Idle"
          : status === "error"
            ? "Disconnected"
            : "Connecting…"}
      </span>
      <span className="connection-detail">{detail}</span>
    </div>
  );
}
