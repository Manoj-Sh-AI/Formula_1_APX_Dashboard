import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type DensityMode = "operational" | "broadcast" | "focus";

interface DensityContextValue {
  mode: DensityMode;
  setMode: (mode: DensityMode) => void;
  cycleMode: () => void;
}

const STORAGE_KEY = "apx-pitwall-density";

const DensityContext = createContext<DensityContextValue | null>(null);

const MODES: DensityMode[] = ["operational", "broadcast", "focus"];

function readStoredMode(): DensityMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && MODES.includes(stored as DensityMode)) {
      return stored as DensityMode;
    }
  } catch {
    /* ignore */
  }
  return "operational";
}

export function DensityProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<DensityMode>(readStoredMode);

  const setMode = useCallback((next: DensityMode) => {
    setModeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const cycleMode = useCallback(() => {
    setMode(MODES[(MODES.indexOf(mode) + 1) % MODES.length]);
  }, [mode, setMode]);

  useEffect(() => {
    document.documentElement.dataset.density = mode;
  }, [mode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if (e.key === "d" || e.key === "D") {
        cycleMode();
      }
      if (e.key === "Escape") {
        setMode("operational");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cycleMode, setMode]);

  const value = useMemo(
    () => ({ mode, setMode, cycleMode }),
    [mode, setMode, cycleMode],
  );

  return (
    <DensityContext.Provider value={value}>{children}</DensityContext.Provider>
  );
}

export function useDensity() {
  const ctx = useContext(DensityContext);
  if (!ctx) throw new Error("useDensity must be used within DensityProvider");
  return ctx;
}
