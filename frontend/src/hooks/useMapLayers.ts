import { useCallback, useState } from "react";

export type TraceColorMode = "speed" | "throttle" | "brake" | "drs";

export interface MapLayerState {
  sectors: boolean;
  drsZones: boolean;
  pitMarkers: boolean;
  battles: boolean;
  trace: boolean;
  pitRejoin: boolean;
  traceMode: TraceColorMode;
}

const DEFAULT_LAYERS: MapLayerState = {
  sectors: false,
  drsZones: true,
  pitMarkers: false,
  battles: true,
  trace: true,
  pitRejoin: false,
  traceMode: "speed",
};

export function useMapLayers(initial?: Partial<MapLayerState>) {
  const [layers, setLayers] = useState<MapLayerState>({
    ...DEFAULT_LAYERS,
    ...initial,
  });

  const toggle = useCallback((key: keyof Omit<MapLayerState, "traceMode">) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const setTraceMode = useCallback((traceMode: TraceColorMode) => {
    setLayers((prev) => ({ ...prev, traceMode }));
  }, []);

  return { layers, toggle, setTraceMode, setLayers };
}
