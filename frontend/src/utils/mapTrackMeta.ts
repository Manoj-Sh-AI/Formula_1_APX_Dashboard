import type { TrackData } from "../types";
import {
  buildTrackReferenceFromTrack,
  referencePointAtRelDist,
  type TrackReference,
} from "./trackProjection";

export interface MapPoint {
  x: number;
  y: number;
  label?: string;
}

export interface SectorMarker {
  id: string;
  label: string;
  relDist: number;
  x: number;
  y: number;
}

export interface TrackMapMeta {
  ref: TrackReference;
  sectors: SectorMarker[];
  pitEntry: MapPoint;
  pitExit: MapPoint;
  finishLine: MapPoint;
}

let cachedMeta: { trackKey: string; meta: TrackMapMeta } | null = null;

function trackKey(track: TrackData): string {
  return `${track.x.length}-${track.rotation_deg}-${track.bounds.x_min}`;
}

export function buildTrackMapMeta(track: TrackData): TrackMapMeta {
  const key = trackKey(track);
  if (cachedMeta?.trackKey === key) return cachedMeta.meta;

  const ref = buildTrackReferenceFromTrack(track);
  const sectorRel = [0, 1 / 3, 2 / 3];
  const sectors: SectorMarker[] = sectorRel.map((rel, i) => {
    const [x, y] = referencePointAtRelDist(rel, ref);
    return {
      id: `s${i + 1}`,
      label: i === 0 ? "S/F" : `S${i}`,
      relDist: rel,
      x,
      y,
    };
  });

  const [pitExitX, pitExitY] = referencePointAtRelDist(0.05, ref);
  const [pitEntryX, pitEntryY] = referencePointAtRelDist(0.95, ref);
  const [finishX, finishY] = referencePointAtRelDist(0, ref);

  const meta: TrackMapMeta = {
    ref,
    sectors,
    pitExit: { x: pitExitX, y: pitExitY, label: "PIT OUT" },
    pitEntry: { x: pitEntryX, y: pitEntryY, label: "PIT IN" },
    finishLine: { x: finishX, y: finishY, label: "S/F" },
  };

  cachedMeta = { trackKey: key, meta };
  return meta;
}

/** True if rel_dist is inside any DRS zone (by index span on outer loop). */
export function isInDrsZone(
  relDist: number,
  track: TrackData,
  ref: TrackReference,
): boolean {
  if (!track.drs_zones?.length || ref.totalLength <= 0) return false;
  const dist = relDist * ref.totalLength;
  const n = track.x_outer.length;
  if (n < 2) return false;

  for (const zone of track.drs_zones) {
    const sIdx = zone.start.index ?? 0;
    const eIdx = zone.end.index ?? n - 1;
    const startD = (sIdx / (n - 1)) * ref.totalLength;
    const endD = (eIdx / (n - 1)) * ref.totalLength;
    if (startD <= endD) {
      if (dist >= startD && dist <= endD) return true;
    } else if (dist >= startD || dist <= endD) {
      return true;
    }
  }
  return false;
}
