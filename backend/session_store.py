"""
In-memory session store — no JSON/chunk files on disk.

FastF1 data is processed once into RAM, then served frame-by-frame via the API.
"""

from __future__ import annotations

import os
import sys
import threading
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

import numpy as np

TEST_ROOT = Path(__file__).resolve().parent.parent
PROJECT_ROOT = TEST_ROOT.parent

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
if str(TEST_ROOT) not in sys.path:
    sys.path.insert(0, str(TEST_ROOT))

os.chdir(PROJECT_ROOT)

from frame_codec import slim_frame  # noqa: E402
from quali_adapter import (  # noqa: E402
    pick_default_quali_run,
    quali_run_to_slim_frames,
)
from track_loader import load_example_lap  # noqa: E402
from src.f1_data import (  # noqa: E402
    enable_cache,
    get_circuit_rotation,
    get_driver_colors,
    get_quali_telemetry,
    get_race_telemetry,
    load_session,
)
from src.ui_components import build_track_from_example_lap  # noqa: E402

RACE_SESSION_TYPES = {"R", "S"}
QUALI_SESSION_TYPES = {"Q", "SQ"}


def _rgb_to_hex(rgb: tuple[int, int, int]) -> str:
    return f"#{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}"


def _downsample(values, target: int = 800) -> list[float]:
    arr = np.asarray(values, dtype=float)
    if len(arr) <= target:
        return arr.tolist()
    indices = np.linspace(0, len(arr) - 1, target, dtype=int)
    return arr[indices].tolist()


def _get_race_telemetry_live(session, session_type: str = "R") -> dict:
    refresh_flag = "--refresh-data"
    had_flag = refresh_flag in sys.argv
    if not had_flag:
        sys.argv.append(refresh_flag)
    try:
        return get_race_telemetry(session, session_type=session_type)
    finally:
        if not had_flag and refresh_flag in sys.argv:
            sys.argv.remove(refresh_flag)


def _get_quali_telemetry_live(session, session_type: str = "Q") -> dict:
    refresh_flag = "--refresh-data"
    had_flag = refresh_flag in sys.argv
    if not had_flag:
        sys.argv.append(refresh_flag)
    try:
        return get_quali_telemetry(session, session_type=session_type)
    finally:
        if not had_flag and refresh_flag in sys.argv:
            sys.argv.remove(refresh_flag)


def _build_track_payload(example_lap, circuit_rotation: float) -> dict:
    (
        plot_x_ref,
        plot_y_ref,
        x_inner,
        y_inner,
        x_outer,
        y_outer,
        x_min,
        x_max,
        y_min,
        y_max,
        drs_zones,
    ) = build_track_from_example_lap(example_lap)

    orig_n = max(len(x_outer), 1)
    ds_outer_x = _downsample(x_outer)
    ds_outer_y = _downsample(y_outer)
    ds_n = max(len(ds_outer_x), 1)

    def scale_index(idx: int) -> int:
        return int(idx / max(orig_n - 1, 1) * (ds_n - 1))

    return {
        "x": _downsample(plot_x_ref),
        "y": _downsample(plot_y_ref),
        "x_inner": _downsample(x_inner),
        "y_inner": _downsample(y_inner),
        "x_outer": ds_outer_x,
        "y_outer": ds_outer_y,
        "rotation_deg": float(circuit_rotation),
        "bounds": {
            "x_min": float(x_min),
            "x_max": float(x_max),
            "y_min": float(y_min),
            "y_max": float(y_max),
        },
        "drs_zones": [
            {
                "start": {
                    "x": float(z["start"]["x"]),
                    "y": float(z["start"]["y"]),
                    "index": scale_index(int(z["start"]["index"])),
                },
                "end": {
                    "x": float(z["end"]["x"]),
                    "y": float(z["end"]["y"]),
                    "index": scale_index(int(z["end"]["index"])),
                },
            }
            for z in drs_zones
        ],
    }


def _position_for_driver(results: list[dict], driver_code: str) -> int:
    for row in results:
        if row.get("code") == driver_code:
            return int(row.get("position") or 999)
    return 999


def _build_quali_trace_from_segment(
    segment_data: dict,
    driver: str,
    segment: str,
) -> dict | None:
    """Full-lap telemetry trace from one qualifying segment."""
    if not segment_data or not segment_data.get("frames"):
        return None

    rel_dist: list[float] = []
    speeds: list[float] = []
    gears: list[int] = []
    throttles: list[float] = []
    brakes: list[float] = []
    xs: list[float] = []
    ys: list[float] = []

    for frame in segment_data["frames"]:
        tel = frame.get("telemetry") or {}
        rel_dist.append(float(tel.get("rel_dist", 0)))
        speeds.append(float(tel.get("speed", 0)))
        gears.append(int(tel.get("gear", 0)))
        throttles.append(float(tel.get("throttle", 0)))
        brakes.append(float(tel.get("brake", 0)))
        xs.append(float(tel.get("x", 0)))
        ys.append(float(tel.get("y", 0)))

    return {
        "driver": driver,
        "segment": segment,
        "rel_dist": rel_dist,
        "speeds": speeds,
        "gears": gears,
        "throttles": throttles,
        "brakes": brakes,
        "x": xs,
        "y": ys,
    }


def _build_pole_comparison_trace(
    quali_telemetry: dict,
    quali_results: list[dict],
    active_driver: str,
    active_segment: str,
) -> dict | None:
    """Pole Q3 lap trace for overlay, matching original qualifying replay."""
    if not quali_results:
        return None

    pole = quali_results[0]
    pole_code = pole.get("code")
    if not pole_code:
        return None

    pole_segment = "Q3" if pole.get("Q3") else ("Q2" if pole.get("Q2") else "Q1")
    if pole_code == active_driver and pole_segment == active_segment:
        return None

    pole_data = quali_telemetry.get(pole_code, {}).get(pole_segment)
    return _build_quali_trace_from_segment(pole_data, pole_code, pole_segment)


TYRE_REMAP: dict[int, int] = {0: 1, 1: 2, 2: 3, 3: 4, 4: 5}


def _remap_tyre(raw: int) -> int:
    return TYRE_REMAP.get(round(raw), round(raw))


def _process_slim_frame_for_strategy(
    stints: dict[str, list[dict]],
    prev_tyres: dict[str, int],
    positions: dict[str, int],
    lap_progress: dict[str, float],
    slim: dict,
    total_laps: int,
    total_laps_ref: list[int],
) -> None:
    """Update stint accumulator from one slim frame (matches tyre_strategy_window.py)."""
    frame_lap = int(slim.get("lap", 1))
    if (
        total_laps > 0
        and total_laps != total_laps_ref[0]
        and frame_lap <= 2
    ):
        stints.clear()
        prev_tyres.clear()
        positions.clear()
        lap_progress.clear()
    total_laps_ref[0] = total_laps

    for code, arr in slim.get("d", {}).items():
        if len(arr) < 12:
            continue

        pos = arr[2]
        tyre_raw = arr[8]
        lap_raw = arr[9]
        rel_dist = float(arr[11])

        if pos is not None:
            positions[code] = int(pos)

        tyre = _remap_tyre(int(tyre_raw))
        if tyre == 0 or lap_raw is None:
            continue

        lap = int(lap_raw)
        rel = max(0.0, min(1.0, rel_dist))
        lap_progress[code] = lap - 1 + rel

        if code not in stints:
            stints[code] = [{"tyre": tyre, "start_lap": lap, "end_lap": None}]
            prev_tyres[code] = tyre
        elif tyre != prev_tyres[code]:
            stints[code][-1]["end_lap"] = lap - 1
            stints[code].append({"tyre": tyre, "start_lap": lap, "end_lap": None})
            prev_tyres[code] = tyre


def _build_timeline_events(
    track_statuses: list[dict],
    race_control_messages: list[dict],
    total_frames: int,
    fps: int = 25,
) -> list[dict]:
    events: list[dict] = []
    total = max(total_frames - 1, 1)

    for ts in track_statuses or []:
        start = float(ts.get("start_time") or 0)
        frame_index = min(int(round(start * fps)), total_frames - 1)
        code = str(ts.get("status", ""))
        kind = "flag"
        label = f"Track {code}"
        severity = "info"
        if code == "4":
            kind, label, severity = "sc", "Safety Car", "critical"
        elif code in ("6", "7"):
            kind, label, severity = "vsc", "VSC", "warning"
        elif code == "2":
            label, severity = "Yellow", "warning"
        elif code == "5":
            label, severity = "Red Flag", "critical"
        events.append(
            {
                "frame_index": frame_index,
                "progress": frame_index / total,
                "kind": kind,
                "label": label,
                "severity": severity,
            }
        )

    for msg in race_control_messages or []:
        t = float(msg.get("time") or 0)
        frame_index = min(int(round(t * fps)), total_frames - 1)
        flag = (msg.get("flag") or "").upper()
        cat = (msg.get("category") or "").lower()
        kind = "rc"
        if cat == "safetycar" or "SC" in flag:
            kind = "sc"
        elif "VSC" in flag:
            kind = "vsc"
        elif cat == "flag" or flag:
            kind = "flag"
        severity = "critical" if "RED" in flag else "warning" if "YELLOW" in flag else "info"
        events.append(
            {
                "frame_index": frame_index,
                "progress": frame_index / total,
                "kind": kind,
                "label": (msg.get("message") or "")[:48],
                "severity": severity,
            }
        )

    events.sort(key=lambda e: e["frame_index"])
    seen: set[int] = set()
    deduped: list[dict] = []
    for e in events:
        bucket = int(e["progress"] * 200)
        if bucket in seen:
            continue
        seen.add(bucket)
        deduped.append(e)
    return deduped[:120]


def _estimate_tyre_health(tyre_raw: int, tyre_life: int) -> int:
    tyre = _remap_tyre(tyre_raw)
    deg = {1: 5.0, 2: 3.5, 3: 2.0, 4: 2.5, 5: 1.5}.get(tyre, 4.0)
    return max(0, min(100, int(round(100 - tyre_life * deg))))


def _tyre_health_from_slim(slim: dict) -> dict[str, dict]:
    health: dict[str, dict] = {}
    for code, arr in slim.get("d", {}).items():
        if len(arr) < 13:
            continue
        tyre_raw = int(arr[8])
        tyre_life = int(arr[12]) if len(arr) > 12 else 0
        h = _estimate_tyre_health(tyre_raw, tyre_life)
        health[code] = {
            "health": h,
            "tyre_life": tyre_life,
            "tyre": _remap_tyre(tyre_raw),
        }
    return health


def _build_strategy_rows(
    stints: dict[str, list[dict]],
    positions: dict[str, int],
    lap_progress: dict[str, float],
) -> list[dict]:
    rows = []
    for code, driver_stints in stints.items():
        rows.append(
            {
                "code": code,
                "position": positions.get(code, 999),
                "stints": driver_stints,
                "lapProgress": lap_progress.get(code, 1.0),
            }
        )
    rows.sort(key=lambda r: (r["position"], r["code"]))
    return rows


@dataclass
class SessionStore:
    """Thread-safe in-memory holder for one loaded session."""

    lock: threading.Lock = field(default_factory=threading.Lock)
    status: str = "idle"
    message: str = ""
    error: str | None = None
    year: int | None = None
    round_number: int | None = None
    session_type: str = "R"
    session_meta: dict | None = None
    track: dict | None = None
    slim_frames: list[dict] = field(default_factory=list)
    quali_telemetry: dict | None = None
    quali_results: list | None = None
    degradation_integrator: object | None = None

    def snapshot_status(self) -> dict:
        with self.lock:
            return {
                "status": self.status,
                "message": self.message,
                "error": self.error,
                "year": self.year,
                "round": self.round_number,
                "session_type": self.session_type,
                "total_frames": len(self.slim_frames),
            }

    def clear(self) -> None:
        with self.lock:
            self.status = "idle"
            self.message = ""
            self.error = None
            self.year = None
            self.round_number = None
            self.session_type = "R"
            self.session_meta = None
            self.track = None
            self.slim_frames = []
            self.quali_telemetry = None
            self.quali_results = None

    def _apply_quali_run(
        self,
        driver_code: str,
        segment: str,
        session_meta: dict,
    ) -> None:
        if not self.quali_telemetry or not self.quali_results:
            raise LookupError("Qualifying telemetry not loaded.")

        driver_data = self.quali_telemetry.get(driver_code)
        if not driver_data:
            raise LookupError(f"Driver {driver_code} not found in qualifying data.")

        segment_data = driver_data.get(segment)
        if not segment_data or not segment_data.get("frames"):
            raise LookupError(f"No {segment} data for driver {driver_code}.")

        position = _position_for_driver(self.quali_results, driver_code)
        slim = quali_run_to_slim_frames(segment_data, driver_code, position)

        session_meta["quali_active_driver"] = driver_code
        session_meta["quali_active_segment"] = segment
        session_meta["sector_times"] = segment_data.get("sector_times") or {}
        session_meta["lap_time"] = slim[-1]["t"] if slim else 0.0
        session_meta["compound"] = segment_data.get("compound")
        session_meta["max_speed"] = segment_data.get("max_speed")
        session_meta["min_speed"] = segment_data.get("min_speed")
        session_meta["frame_count"] = len(slim)
        session_meta["track_statuses"] = segment_data.get("track_statuses") or []
        session_meta["race_control_messages"] = []
        session_meta["quali_active_trace"] = _build_quali_trace_from_segment(
            segment_data,
            driver_code,
            segment,
        )
        session_meta["quali_comparison"] = _build_pole_comparison_trace(
            self.quali_telemetry,
            self.quali_results,
            driver_code,
            segment,
        )

        self.slim_frames = slim
        self.session_meta = session_meta

    def set_quali_run(self, driver_code: str, segment: str) -> dict:
        with self.lock:
            if self.status != "ready" or not self.session_meta:
                raise LookupError("No session loaded.")
            if not self.session_meta.get("is_qualifying"):
                raise LookupError("Current session is not qualifying.")

            meta = dict(self.session_meta)
            self._apply_quali_run(driver_code, segment, meta)
            return self.session_meta

    def load(
        self,
        year: int,
        round_number: int,
        session_type: str = "R",
        on_progress: Callable[[str], None] | None = None,
    ) -> None:
        def progress(msg: str) -> None:
            with self.lock:
                self.message = msg
            if on_progress:
                on_progress(msg)

        session_type = session_type.upper()
        if session_type not in RACE_SESSION_TYPES | QUALI_SESSION_TYPES:
            raise ValueError(f"Unsupported session type: {session_type}")

        with self.lock:
            if self.status == "loading":
                return
            self.status = "loading"
            self.message = "Starting..."
            self.error = None
            self.year = year
            self.round_number = round_number
            self.session_type = session_type
            self.session_meta = None
            self.track = None
            self.slim_frames = []
            self.quali_telemetry = None
            self.quali_results = None

        try:
            progress(f"Loading FastF1 session {year} round {round_number} ({session_type})...")
            enable_cache()
            session = load_session(year, round_number, session_type)

            progress("Building track geometry...")
            example_lap = load_example_lap(session, year, round_number)
            if example_lap is None:
                raise RuntimeError("No valid lap for track geometry.")

            circuit_rotation = get_circuit_rotation(session)
            track = _build_track_payload(example_lap, circuit_rotation)

            circuit_length_m = (
                float(example_lap["Distance"].max()) if "Distance" in example_lap else None
            )
            hex_colors = {
                code: _rgb_to_hex(rgb)
                for code, rgb in get_driver_colors(session).items()
            }

            is_qualifying = session_type in QUALI_SESSION_TYPES

            if is_qualifying:
                progress("Processing qualifying telemetry from FastF1...")
                quali_data = _get_quali_telemetry_live(session, session_type=session_type)
                results = quali_data.get("results") or []
                telemetry = quali_data.get("telemetry") or {}

                default_run = pick_default_quali_run(results)
                if not default_run:
                    raise RuntimeError("No qualifying results with lap times found.")

                driver_code, segment = default_run
                driver_data = telemetry.get(driver_code, {})
                segment_data = driver_data.get(segment) or {}

                session_meta = {
                    "event_name": session.event.get("EventName", "Unknown"),
                    "circuit_name": session.event.get("Location", ""),
                    "country": session.event.get("Country", ""),
                    "year": year,
                    "round": round_number,
                    "session_type": session_type,
                    "is_qualifying": True,
                    "total_laps": 1,
                    "circuit_length_m": circuit_length_m,
                    "driver_colors": hex_colors,
                    "quali_results": results,
                    "quali_active_driver": driver_code,
                    "quali_active_segment": segment,
                    "sector_times": segment_data.get("sector_times") or {},
                    "lap_time": 0.0,
                    "compound": segment_data.get("compound"),
                    "max_speed": quali_data.get("max_speed"),
                    "min_speed": quali_data.get("min_speed"),
                    "track_statuses": segment_data.get("track_statuses") or [],
                    "race_control_messages": [],
                    "frame_count": 0,
                    "fps": 25,
                    "source": "fastf1_live",
                }

                with self.lock:
                    self.quali_telemetry = telemetry
                    self.quali_results = results
                    self.track = track
                    self._apply_quali_run(driver_code, segment, session_meta)
                    self.status = "ready"
                    self.message = "Qualifying session ready — frames served live from memory."
            else:
                progress("Processing race telemetry from FastF1 (several minutes on first load)...")
                telemetry = _get_race_telemetry_live(session, session_type=session_type)
                frames = telemetry["frames"]

                progress(f"Preparing {len(frames)} frames in memory...")
                slim = [slim_frame(f) for f in frames]

                track_statuses = telemetry.get("track_statuses", [])
                rc_messages = telemetry.get("race_control_messages", [])
                timeline_events = _build_timeline_events(
                    track_statuses, rc_messages, len(slim)
                )

                integrator = None
                try:
                    from src.tyre_degradation_integration import TyreDegradationIntegrator

                    candidate = TyreDegradationIntegrator(session=session)
                    if candidate.initialize_from_session():
                        integrator = candidate
                except Exception:
                    integrator = None

                session_meta = {
                    "event_name": session.event.get("EventName", "Unknown"),
                    "circuit_name": session.event.get("Location", ""),
                    "country": session.event.get("Country", ""),
                    "year": year,
                    "round": round_number,
                    "session_type": session_type,
                    "is_qualifying": False,
                    "total_laps": telemetry.get("total_laps", 0),
                    "circuit_length_m": circuit_length_m,
                    "driver_colors": hex_colors,
                    "starting_positions": telemetry.get("starting_positions") or {},
                    "track_statuses": track_statuses,
                    "race_control_messages": rc_messages,
                    "timeline_events": timeline_events,
                    "frame_count": len(slim),
                    "fps": 25,
                    "source": "fastf1_live",
                }

                with self.lock:
                    self.session_meta = session_meta
                    self.track = track
                    self.slim_frames = slim
                    self.degradation_integrator = integrator
                    self.status = "ready"
                    self.message = "Session ready — frames served live from memory."

        except Exception as exc:
            with self.lock:
                self.status = "error"
                self.error = str(exc)
                self.message = f"Failed: {exc}"
                self.slim_frames = []

    def require_ready(self) -> None:
        with self.lock:
            if self.status != "ready" or not self.session_meta:
                raise LookupError("No session loaded. POST /api/session/load first.")

    def get_session_meta(self) -> dict:
        self.require_ready()
        with self.lock:
            return self.session_meta  # type: ignore[return-value]

    def get_track(self) -> dict:
        self.require_ready()
        with self.lock:
            return self.track  # type: ignore[return-value]

    def get_manifest(self) -> dict:
        self.require_ready()
        with self.lock:
            return {
                "total_frames": len(self.slim_frames),
                "fps": 25,
                "source": "memory",
            }

    def get_frame(self, index: int) -> dict:
        self.require_ready()
        with self.lock:
            if index < 0 or index >= len(self.slim_frames):
                raise IndexError("Frame index out of range")
            return self.slim_frames[index]

    def get_frames_range(self, start: int, count: int) -> list[dict]:
        self.require_ready()
        with self.lock:
            end = min(start + count, len(self.slim_frames))
            if start < 0 or start >= len(self.slim_frames):
                raise IndexError("Start index out of range")
            return self.slim_frames[start:end]

    def get_tyre_strategy_snapshot(self, frame_index: int) -> dict:
        """Build tyre stint state by processing in-memory frames up to frame_index."""
        self.require_ready()
        with self.lock:
            if self.session_meta and self.session_meta.get("is_qualifying"):
                raise LookupError("Tyre strategy is not available for qualifying sessions.")

            total = len(self.slim_frames)
            if total == 0:
                raise LookupError("No frames loaded.")

            idx = max(0, min(int(frame_index), total - 1))
            total_laps = int(self.session_meta.get("total_laps") or 60)

            stints: dict[str, list[dict]] = {}
            prev_tyres: dict[str, int] = {}
            positions: dict[str, int] = {}
            lap_progress: dict[str, float] = {}
            total_laps_ref = [total_laps]

            for i in range(idx + 1):
                _process_slim_frame_for_strategy(
                    stints,
                    prev_tyres,
                    positions,
                    lap_progress,
                    self.slim_frames[i],
                    total_laps,
                    total_laps_ref,
                )

            current_lap = int(self.slim_frames[idx].get("lap", 1))

            return {
                "frame_index": idx,
                "current_lap": current_lap,
                "total_laps": total_laps,
                "rows": _build_strategy_rows(stints, positions, lap_progress),
            }

    def get_tyre_health_snapshot(self, frame_index: int) -> dict:
        self.require_ready()
        with self.lock:
            if self.session_meta and self.session_meta.get("is_qualifying"):
                raise LookupError("Tyre health is not available for qualifying sessions.")

            total = len(self.slim_frames)
            if total == 0:
                raise LookupError("No frames loaded.")

            idx = max(0, min(int(frame_index), total - 1))
            slim = self.slim_frames[idx]
            drivers = _tyre_health_from_slim(slim)

            integrator = self.degradation_integrator
            if integrator is not None and hasattr(integrator, "get_tyre_health"):
                for code, arr in slim.get("d", {}).items():
                    if len(arr) < 10:
                        continue
                    lap = int(arr[9])
                    try:
                        data = integrator.get_tyre_health(code, lap)
                        if data and "health" in data:
                            drivers[code] = {
                                **drivers.get(code, {}),
                                "health": int(data["health"]),
                                "source": "bayesian",
                            }
                    except Exception:
                        pass

            return {
                "frame_index": idx,
                "drivers": drivers,
            }


store = SessionStore()
