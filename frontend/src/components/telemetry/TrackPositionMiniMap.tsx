import { TrackMap } from "../TrackMap";
import type { InterpolatedDriver, TrackData } from "../../types";

interface TrackPositionMiniMapProps {
  track: TrackData;
  drivers: InterpolatedDriver[];
  driverColors: Record<string, string>;
  leader: string | null;
  selectedDriver: string | null;
  onSelectDriver: (code: string) => void;
  showDrsZones?: boolean;
}

export function TrackPositionMiniMap({
  track,
  drivers,
  driverColors,
  leader,
  selectedDriver,
  onSelectDriver,
  showDrsZones = true,
}: TrackPositionMiniMapProps) {
  return (
    <div className="pit-card mini-map-card">
      <h2 className="panel-title">Track Position</h2>
      <div className="mini-map-wrap">
        <TrackMap
          track={track}
          drivers={drivers}
          driverColors={driverColors}
          leader={leader}
          selectedDriver={selectedDriver}
          onSelectDriver={onSelectDriver}
          showDrsZones={showDrsZones}
        />
      </div>
    </div>
  );
}
