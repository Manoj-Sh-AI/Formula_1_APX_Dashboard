import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { SessionMeta, TrackData } from "../types";
import { resolveQualiSegment } from "../utils/qualifying";

interface SessionContextValue {
  sessionReady: boolean;
  setSessionReady: (ready: boolean) => void;
  meta: SessionMeta | null;
  track: TrackData | null;
  loadError: string | null;
  selectedDriver: string | null;
  setSelectedDriver: (code: string | null) => void;
  checkingBackend: boolean;
  reloadSession: () => void;
  resetSession: () => void;
  updateMeta: (meta: SessionMeta) => void;
  playbackReloadKey: number;
  bumpPlaybackReload: () => void;
  selectQualiDriver: (code: string) => Promise<void>;
  selectQualiRun: (driver: string, segment: string) => Promise<void>;
  qualiLoading: boolean;
  qualiError: string | null;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessionReady, setSessionReady] = useState(false);
  const [meta, setMeta] = useState<SessionMeta | null>(null);
  const [track, setTrack] = useState<TrackData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [checkingBackend, setCheckingBackend] = useState(true);
  const [playbackReloadKey, setPlaybackReloadKey] = useState(0);
  const [qualiLoading, setQualiLoading] = useState(false);
  const [qualiError, setQualiError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((data) => {
        if (data.status === "ready") {
          setSessionReady(true);
        }
      })
      .catch(() => {})
      .finally(() => setCheckingBackend(false));
  }, []);

  const loadSessionData = useCallback(() => {
    setLoadError(null);
    return Promise.all([
      fetch("/api/session").then((r) => {
        if (!r.ok) throw new Error("Session not in memory.");
        return r.json();
      }),
      fetch("/api/track").then((r) => {
        if (!r.ok) throw new Error("Track not available.");
        return r.json();
      }),
    ])
      .then(([sessionMeta, trackData]) => {
        setMeta(sessionMeta);
        setTrack(trackData);
        if (sessionMeta.is_qualifying && sessionMeta.quali_active_driver) {
          setSelectedDriver(sessionMeta.quali_active_driver);
        }
      })
      .catch((e: Error) => setLoadError(e.message));
  }, []);

  useEffect(() => {
    if (sessionReady && !meta) {
      void loadSessionData();
    }
  }, [sessionReady, meta, loadSessionData]);

  const reloadSession = useCallback(() => {
    void loadSessionData();
  }, [loadSessionData]);

  const resetSession = useCallback(() => {
    setMeta(null);
    setTrack(null);
    setSessionReady(false);
    setSelectedDriver(null);
    setLoadError(null);
    setQualiError(null);
    setPlaybackReloadKey((k) => k + 1);
  }, []);

  const updateMeta = useCallback((next: SessionMeta) => {
    setMeta(next);
    if (next.is_qualifying && next.quali_active_driver) {
      setSelectedDriver(next.quali_active_driver);
    }
    setPlaybackReloadKey((k) => k + 1);
  }, []);

  const bumpPlaybackReload = useCallback(() => {
    setPlaybackReloadKey((k) => k + 1);
  }, []);

  const selectQualiRun = useCallback(
    async (driver: string, segment: string) => {
      setQualiLoading(true);
      setQualiError(null);
      setSelectedDriver(driver);
      try {
        const r = await fetch(
          `/api/session/quali-run?driver=${encodeURIComponent(driver)}&segment=${encodeURIComponent(segment)}`,
          { method: "POST" },
        );
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(err.detail || "Failed to load qualifying lap");
        }
        const data = await r.json();
        updateMeta(data.session as SessionMeta);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to load lap";
        setQualiError(msg);
        throw e;
      } finally {
        setQualiLoading(false);
      }
    },
    [updateMeta],
  );

  const selectQualiDriver = useCallback(
    async (code: string) => {
      if (!meta?.quali_results) return;
      const result = meta.quali_results.find((r) => r.code === code);
      const segment = resolveQualiSegment(result);
      if (!segment) return;
      await selectQualiRun(code, segment);
    },
    [meta, selectQualiRun],
  );

  const value = useMemo(
    () => ({
      sessionReady,
      setSessionReady,
      meta,
      track,
      loadError,
      selectedDriver,
      setSelectedDriver,
      checkingBackend,
      reloadSession,
      resetSession,
      updateMeta,
      playbackReloadKey,
      bumpPlaybackReload,
      selectQualiDriver,
      selectQualiRun,
      qualiLoading,
      qualiError,
    }),
    [
      sessionReady,
      meta,
      track,
      loadError,
      selectedDriver,
      checkingBackend,
      reloadSession,
      resetSession,
      updateMeta,
      playbackReloadKey,
      bumpPlaybackReload,
      selectQualiDriver,
      selectQualiRun,
      qualiLoading,
      qualiError,
    ],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
