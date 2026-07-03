"""
Fetch race telemetry directly from FastF1 (bypasses computed_data/*.pkl cache).

Uses the parent project's f1_data pipeline. FastF1's own HTTP cache
(.fastf1-cache/) is still used for API responses — only the local pickle
cache is skipped.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent.parent
TEST_ROOT = Path(__file__).resolve().parent
DATA_DIR = TEST_ROOT / "data"

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
os.chdir(PROJECT_ROOT)

from src.f1_data import (  # noqa: E402
    enable_cache,
    get_circuit_rotation,
    get_driver_colors,
    get_race_telemetry,
    load_session,
)
from src.ui_components import build_track_from_example_lap  # noqa: E402
from frame_codec import slim_frame  # noqa: E402
from track_loader import load_example_lap  # noqa: E402


def _rgb_to_hex(rgb: tuple[int, int, int]) -> str:
    return f"#{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}"


def _downsample(values, target: int = 800) -> list[float]:
    arr = np.asarray(values, dtype=float)
    if len(arr) <= target:
        return arr.tolist()
    indices = np.linspace(0, len(arr) - 1, target, dtype=int)
    return arr[indices].tolist()


def get_race_telemetry_live(session, session_type: str = "R") -> dict:
    """Call get_race_telemetry while forcing a fresh compute (skip pickle cache)."""
    refresh_flag = "--refresh-data"
    had_flag = refresh_flag in sys.argv
    if not had_flag:
        sys.argv.append(refresh_flag)
    try:
        return get_race_telemetry(session, session_type=session_type)
    finally:
        if not had_flag and refresh_flag in sys.argv:
            sys.argv.remove(refresh_flag)


def fetch_from_fastf1(
    year: int,
    round_number: int,
    session_type: str = "R",
    on_progress=None,
) -> dict:
    """
    Fetch and process a session directly from FastF1.

    Returns session_meta, track, and manifest dicts (also written to data/).
    """
    def progress(msg: str):
        if on_progress:
            on_progress(msg)

    progress(f"Loading FastF1 session {year} round {round_number}...")
    enable_cache()
    session = load_session(year, round_number, session_type)

    progress("Processing race telemetry (this may take several minutes)...")
    telemetry = get_race_telemetry_live(session, session_type=session_type)

    frames = telemetry["frames"]
    driver_colors = telemetry["driver_colors"]
    track_statuses = telemetry.get("track_statuses", [])
    race_control_messages = telemetry.get("race_control_messages", [])
    total_laps = telemetry.get("total_laps", 0)

    progress("Building track geometry...")
    example_lap = load_example_lap(session, year, round_number)
    if example_lap is None:
        raise RuntimeError("Could not build track geometry — no valid lap found.")

    circuit_rotation = get_circuit_rotation(session)
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

    circuit_length_m = (
        float(example_lap["Distance"].max()) if "Distance" in example_lap else None
    )
    hex_colors = {code: _rgb_to_hex(rgb) for code, rgb in driver_colors.items()}

    session_meta = {
        "event_name": session.event.get("EventName", "Unknown"),
        "circuit_name": session.event.get("Location", ""),
        "country": session.event.get("Country", ""),
        "year": year,
        "round": round_number,
        "total_laps": total_laps,
        "circuit_length_m": circuit_length_m,
        "driver_colors": hex_colors,
        "track_statuses": track_statuses,
        "race_control_messages": race_control_messages,
        "frame_count": len(frames),
        "fps": 25,
        "source": "fastf1_live",
    }

    track_data = {
        "x": _downsample(plot_x_ref),
        "y": _downsample(plot_y_ref),
        "x_inner": _downsample(x_inner),
        "y_inner": _downsample(y_inner),
        "x_outer": _downsample(x_outer),
        "y_outer": _downsample(y_outer),
        "rotation_deg": float(circuit_rotation),
        "bounds": {
            "x_min": float(x_min),
            "x_max": float(x_max),
            "y_min": float(y_min),
            "y_max": float(y_max),
        },
        "drs_zones": [
            {
                "start": {"x": float(z["start"]["x"]), "y": float(z["start"]["y"])},
                "end": {"x": float(z["end"]["x"]), "y": float(z["end"]["y"])},
            }
            for z in drs_zones
        ],
    }

    progress(f"Preparing {len(frames)} frames in memory...")
    slim = [slim_frame(f) for f in frames]

    session_meta["frame_count"] = len(slim)
    progress("Done.")
    return {
        "session_meta": session_meta,
        "track": track_data,
        "slim_frames": slim,
    }
