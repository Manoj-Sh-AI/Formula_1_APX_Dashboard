import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./app/AppShell";
import { SessionProvider } from "./context/SessionContext";
import { PlaybackProvider } from "./context/PlaybackContext";
import { TelemetryProvider } from "./context/TelemetryContext";
import { TyreStrategyProvider } from "./context/TyreStrategyContext";
import { DensityProvider } from "./context/DensityContext";
import { SessionPage } from "./pages/SessionPage";
import { RaceReplayPage } from "./pages/RaceReplayPage";
import { LiveTelemetryPage } from "./pages/LiveTelemetryPage";
import { StrategyRaceControlPage } from "./pages/StrategyRaceControlPage";
import "./index.css";
import "./styles/pit-wall-fixes.css";

export default function App() {
  return (
    <BrowserRouter>
      <DensityProvider>
        <SessionProvider>
          <PlaybackProvider>
            <TelemetryProvider>
              <TyreStrategyProvider>
                <Routes>
                  <Route path="/session" element={<SessionPage />} />
                  <Route element={<AppShell />}>
                    <Route path="/replay" element={<RaceReplayPage />} />
                    <Route path="/telemetry" element={<LiveTelemetryPage />} />
                    <Route path="/strategy" element={<StrategyRaceControlPage />} />
                  </Route>
                  <Route path="/" element={<Navigate to="/session" replace />} />
                  <Route path="*" element={<Navigate to="/session" replace />} />
                </Routes>
              </TyreStrategyProvider>
            </TelemetryProvider>
          </PlaybackProvider>
        </SessionProvider>
      </DensityProvider>
    </BrowserRouter>
  );
}
