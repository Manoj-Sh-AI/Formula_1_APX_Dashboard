import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { SidebarNav } from "./SidebarNav";
import { DashboardHeader } from "./DashboardHeader";
import { PlaybackControls } from "../components/PlaybackControls";
import { ConnectionStatusBar } from "../components/shared/ConnectionStatusBar";
import { KeyboardHelp } from "../components/shared/KeyboardHelp";
import { useSession } from "../context/SessionContext";
import { usePlaybackContext } from "../context/PlaybackContext";
import { useDensity } from "../context/DensityContext";
import { useShareableState } from "../hooks/useShareableState";

function FocusModeBanner() {
  const { mode, setMode } = useDensity();
  if (mode !== "focus") return null;

  return (
    <div className="focus-mode-banner">
      <span>Focus mode — side panels hidden</span>
      <button type="button" onClick={() => setMode("operational")}>
        Exit focus (Esc)
      </button>
    </div>
  );
}

export function AppShell() {
  const { sessionReady, checkingBackend, loadError, meta, track, selectedDriver, setSelectedDriver } = useSession();
  const playback = usePlaybackContext();
  const { mode, setMode } = useDensity();
  const location = useLocation();

  useShareableState({
    frameIndex: Math.floor(playback.frameIndex),
    selectedDriver,
    density: mode,
    totalFrames: playback.totalFrames,
    isPlaying: playback.isPlaying,
    onSeek: playback.seek,
    onSelectDriver: setSelectedDriver,
    onSetDensity: setMode,
    ready: playback.ready && !!meta,
  });

  if (checkingBackend) {
    return (
      <div className="app loading-screen">
        <div className="spinner" />
        <p>Connecting to APX Pit Wall API…</p>
      </div>
    );
  }

  if (!sessionReady && location.pathname !== "/session") {
    return <Navigate to="/session" replace />;
  }

  if (location.pathname === "/session") {
    return <Outlet />;
  }

  if (loadError || playback.error) {
    return (
      <div className="app error-screen">
        <h1>APX Pit Wall</h1>
        <p className="error-msg">{loadError ?? playback.error}</p>
        <Link to="/session" className="fetch-btn">
          Load another session
        </Link>
      </div>
    );
  }

  if (!meta || !track) {
    return (
      <div className="app loading-screen">
        <div className="spinner" />
        <p>Loading session metadata…</p>
      </div>
    );
  }

  if (!playback.ready) {
    return (
      <div className="app loading-screen">
        <div className="spinner" />
        <p>Starting live frame stream…</p>
        <p className="loading-sub">{meta.event_name}</p>
      </div>
    );
  }

  return (
    <div className="app dashboard-shell">
      <SidebarNav />
      <div className="dashboard-main">
        <ConnectionStatusBar />
        <DashboardHeader />
        <FocusModeBanner />
        <main className="dashboard-content">
          <Outlet />
        </main>
        <PlaybackControls
          isPlaying={playback.isPlaying}
          progress={playback.progress}
          smoothProgress={playback.smoothProgress}
          speed={playback.speed}
          frameIndex={Math.floor(playback.frameIndex)}
          totalFrames={playback.totalFrames}
          meta={meta}
          onTogglePlay={playback.togglePlay}
          onSeek={playback.seek}
          onStepBack={playback.stepBackward}
          onStepForward={playback.stepForward}
          onSetSpeed={playback.setSpeed}
        />
        <KeyboardHelp />
      </div>
    </div>
  );
}
