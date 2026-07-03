import { NavLink } from "react-router-dom";
import { useSession } from "../context/SessionContext";
import { useDensity } from "../context/DensityContext";
import { DensityControl } from "../components/shared/DensityControl";

const RACE_NAV = [
  { to: "/replay", label: "Race Replay", desc: "Track map, timing, playback" },
  { to: "/telemetry", label: "Live Telemetry", desc: "Engineering charts & inspector" },
  { to: "/strategy", label: "Strategy & Events", desc: "Tyre stints & race control" },
] as const;

const QUALI_NAV = [
  { to: "/replay", label: "Qualifying Replay", desc: "Lap trace, sectors, map" },
  { to: "/telemetry", label: "Lap Telemetry", desc: "Speed, throttle, brake, gear" },
  { to: "/strategy", label: "Session Summary", desc: "Results grid & track status" },
] as const;

export function SidebarNav() {
  const { meta } = useSession();
  const { mode } = useDensity();

  const items = meta?.is_qualifying ? QUALI_NAV : RACE_NAV;

  const sessionLabel = meta?.is_qualifying
    ? meta.session_type === "SQ"
      ? "Sprint Qualifying"
      : "Qualifying"
    : meta?.session_type === "S"
      ? "Sprint"
      : "Race";

  return (
    <nav className="sidebar-nav" aria-label="Dashboard navigation">
      <div className="sidebar-brand">
        <span className="brand-title">
          <span className="brand-accent">APX</span> Pit Wall
        </span>
        <span className="brand-sub">{sessionLabel}</span>
      </div>

      <ul className="nav-list">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
            >
              <span className="nav-label">{item.label}</span>
              <span className="nav-desc">{item.desc}</span>
            </NavLink>
          </li>
        ))}
      </ul>

      <div className="sidebar-footer">
        <DensityControl compact={mode === "focus"} />
        <NavLink to="/session" className="nav-link session-link">
          Load Session
        </NavLink>
      </div>
    </nav>
  );
}
