"""
Export race telemetry from the parent F1_APX_GP project into JSON for the web POC.

Uses computed_data/*.pkl cache when available; otherwise fetches via FastF1.
"""

from __future__ import annotations

import argparse
import json
import os
import pickle
import sys
from pathlib import Path

import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent
TEST_ROOT = Path(__file__).resolve().parent
DATA_DIR = TEST_ROOT / "data"

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


def _rgb_to_hex(rgb: tuple[int, int, int]) -> str:
    return f"#{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}"


def _downsample(values, target: int = 800) -> list[float]:
    arr = np.asarray(values, dtype=float)
    if len(arr) <= target:
        return arr.tolist()
    indices = np.linspace(0, len(arr) - 1, target, dtype=int)
    return arr[indices].tolist()


def _find_cached_pkl(year: int | None, round_number: int | None) -> Path | None:
    cache_dir = PROJECT_ROOT / "computed_data"
    if not cache_dir.exists():
        return None

    candidates = sorted(cache_dir.rglob("*_race_telemetry.pkl"))
    if not candidates:
        return None

    if year is not None:
        year_matches = [p for p in candidates if str(year) in p.stem]
        if year_matches:
            candidates = year_matches

    return candidates[-1]


def _load_example_lap(session, year: int, round_number: int):
    example_lap = None
    try:
        quali_session = load_session(year, round_number, "Q")
        if quali_session is not None and len(quali_session.laps) > 0:
            fastest_quali = quali_session.laps.pick_fastest()
            if fastest_quali is not None:
                quali_telemetry = fastest_quali.get_telemetry()
                if "DRS" in quali_telemetry.columns:
                    example_lap = quali_telemetry
    except Exception as exc:
        print(f"Could not load qualifying lap: {exc}")

    if example_lap is None:
        fastest_lap = session.laps.pick_fastest()
        if fastest_lap is not None:
            example_lap = fastest_lap.get_telemetry()

    return example_lap


def _load_from_cache(pkl_path: Path) -> dict:
    with open(pkl_path, "rb") as f:
        return pickle.load(f)


def _load_from_fastf1(year: int, round_number: int) -> tuple[dict, object]:
    enable_cache()
    session = load_session(year, round_number, "R")
    telemetry = get_race_telemetry(session, session_type="R")
    return telemetry, session


def _generate_demo_data() -> tuple[dict, dict, list, object]:
    """Minimal synthetic session for offline POC testing."""
    print("Generating demo data (synthetic track + 500 frames)...")
    n_track = 400
    angles = np.linspace(0, 2 * np.pi, n_track, endpoint=False)
    radius = 3000.0
    cx, cy = 5000.0, 4000.0
    xs = cx + radius * np.cos(angles)
    ys = cy + radius * np.sin(angles)
    width = 100.0

    dx = np.gradient(xs)
    dy = np.gradient(ys)
    norm = np.sqrt(dx**2 + dy**2)
    norm[norm == 0] = 1.0
    nx, ny = -dy / norm, dx / norm

    drivers = ["VER", "NOR", "LEC", "HAM", "RUS", "PIA", "SAI", "ALO"]
    colors = {
        "VER": (27, 134, 255),
        "NOR": (255, 135, 0),
        "LEC": (220, 0, 0),
        "HAM": (0, 210, 190),
        "RUS": (0, 210, 190),
        "PIA": (255, 135, 0),
        "SAI": (220, 0, 0),
        "ALO": (0, 111, 98),
    }

    frames = []
    for i in range(500):
        t = i / 25.0
        frame_drivers = {}
        for j, code in enumerate(drivers):
            offset = j * (2 * np.pi / len(drivers))
            angle = angles[i % n_track] + offset * 0.02
            x = cx + radius * np.cos(angle + t * 0.05)
            y = cy + radius * np.sin(angle + t * 0.05)
            frame_drivers[code] = {
                "x": float(x),
                "y": float(y),
                "dist": float(t * 200 + j * 50),
                "lap": 1 + i // 200,
                "rel_dist": float((i % 200) / 200),
                "tyre": float(j % 3),
                "tyre_life": float(5 + j),
                "position": j + 1,
                "speed": float(280 + j * 2),
                "gear": 7 + (i % 2),
                "drs": 10 if i % 40 > 20 else 0,
                "throttle": float(80 + (i % 20)),
                "brake": float(max(0, 30 - (i % 15))),
                "in_pit": False,
            }
        frames.append({"t": round(t, 3), "lap": frame_drivers["VER"]["lap"], "drivers": frame_drivers})

    cached = {
        "frames": frames,
        "driver_colors": colors,
        "track_statuses": [{"status": "1", "start_time": 0.0, "end_time": None}],
        "race_control_messages": [],
        "total_laps": 3,
    }

    class _DemoSession:
        event = {
            "EventName": "Demo Grand Prix",
            "Location": "Demo Circuit",
            "Country": "Demo",
        }

        def get_circuit_info(self):
            class _Info:
                rotation = 0.0

            return _Info()

    demo_lap = pd.DataFrame({
        "X": xs,
        "Y": ys,
        "Distance": np.linspace(0, 6000, n_track),
        "DRS": np.zeros(n_track),
    })

    return cached, _DemoSession(), demo_lap


def export_session(
    year: int | None = None,
    round_number: int | None = None,
    demo: bool = False,
) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    pkl_path = _find_cached_pkl(year, round_number)
    session = None
    demo_lap_override = None

    if demo:
        cached, session, demo_lap_override = _generate_demo_data()
        frames = cached["frames"]
        driver_colors = cached["driver_colors"]
        track_statuses = cached.get("track_statuses", [])
        race_control_messages = cached.get("race_control_messages", [])
        total_laps = cached.get("total_laps", 0)
        year = year or 2025
        round_number = round_number or 0
    elif pkl_path and pkl_path.exists():
        print(f"Loading cached telemetry: {pkl_path.name}")
        cached = _load_from_cache(pkl_path)
        frames = cached["frames"]
        driver_colors = cached["driver_colors"]
        track_statuses = cached.get("track_statuses", [])
        race_control_messages = cached.get("race_control_messages", [])
        total_laps = cached.get("total_laps", 0)

        # Parse year/round from filename or use defaults
        if year is None:
            year = 2025
        if round_number is None:
            round_number = 6

        enable_cache()
        session = load_session(year, round_number, "R")
    else:
        if year is None:
            year = 2025
        if round_number is None:
            round_number = 6
        print(f"No cache found — fetching FastF1 data for {year} round {round_number}...")
        cached, session = _load_from_fastf1(year, round_number)
        frames = cached["frames"]
        driver_colors = cached["driver_colors"]
        track_statuses = cached.get("track_statuses", [])
        race_control_messages = cached.get("race_control_messages", [])
        total_laps = cached.get("total_laps", 0)

    if demo_lap_override is not None:
        example_lap = demo_lap_override
        circuit_rotation = 0.0
    else:
        example_lap = _load_example_lap(session, year, round_number)
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

    circuit_length_m = float(example_lap["Distance"].max()) if "Distance" in example_lap else None

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

    with open(DATA_DIR / "track.json", "w", encoding="utf-8") as f:
        json.dump(track_data, f)

    # Write slim chunked frames for web (avoids 700MB+ monolithic JSON)
    from split_frames import write_chunks  # noqa: E402

    print(f"Writing {len(frames)} frames as slim chunks...")
    manifest = write_chunks(frames)
    session_meta["frame_count"] = manifest["total_frames"]

    with open(DATA_DIR / "session_meta.json", "w", encoding="utf-8") as f:
        json.dump(session_meta, f, indent=2)

    print(f"Export complete -> {DATA_DIR}")
    print(f"  session_meta.json  ({session_meta['event_name']})")
    print(f"  track.json         ({len(track_data['x'])} points)")
    print(f"  frames/            ({manifest['num_chunks']} chunks, {manifest['total_frames']} frames)")


def main() -> None:
    parser = argparse.ArgumentParser(description="Export F1 session data for web dashboard POC")
    parser.add_argument("--year", type=int, default=None)
    parser.add_argument("--round", type=int, default=None)
    parser.add_argument(
        "--demo",
        action="store_true",
        help="Generate synthetic demo data (no FastF1 required)",
    )
    parser.add_argument(
        "--live",
        action="store_true",
        help="Fetch directly from FastF1 (skip computed_data pickle cache)",
    )
    args = parser.parse_args()

    if args.live:
        from live_loader import fetch_from_fastf1  # noqa: E402

        fetch_from_fastf1(args.year or 2025, args.round or 6)
        return

    export_session(year=args.year, round_number=args.round, demo=args.demo)


if __name__ == "__main__":
    main()
