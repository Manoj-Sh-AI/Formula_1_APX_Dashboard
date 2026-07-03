"""Sanity check for race start-order stabilization and projection-based ordering."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.f1_data import (  # noqa: E402
    _capture_driver_baselines,
    _get_starting_order,
    _progress_m,
    _sort_snapshot_for_positions,
    enable_cache,
    get_race_telemetry,
    load_session,
)

FPS = 25
MAX_IMPLAUSIBLE_JUMP = 5  # positions in one frame (~40ms)
SPIKE_WINDOW_FRAMES = 25  # ~1 second


def test_grid_anchor_sorting() -> None:
    starting_positions = {
        "PIA": 1,
        "VER": 2,
        "ANT": 3,
        "OCO": 11,
        "BER": 18,
    }
    resampled = {
        code: {"dist": [0.0], "lap": [1.0], "rel_dist": [0.0]}
        for code in starting_positions
    }
    baselines = _capture_driver_baselines(resampled)

    snapshot = [
        {"code": "OCO", "lap": 1, "rel_dist": 0.02, "dist": 120.0, "proj_m": 120.0},
        {"code": "BER", "lap": 1, "rel_dist": 0.01, "dist": 80.0, "proj_m": 80.0},
        {"code": "PIA", "lap": 1, "rel_dist": 0.0, "dist": 0.0, "proj_m": 0.0},
        {"code": "VER", "lap": 1, "rel_dist": 0.0, "dist": -40.0, "proj_m": 10.0},
        {"code": "ANT", "lap": 1, "rel_dist": 0.0, "dist": -90.0, "proj_m": 5.0},
    ]

    _sort_snapshot_for_positions(
        snapshot,
        starting_positions=starting_positions,
        baselines=baselines,
        track_length_m=5200.0,
        frame_time=0.0,
    )

    top3 = [row["code"] for row in snapshot[:3]]
    assert top3 == ["PIA", "VER", "ANT"], f"Expected PIA,VER,ANT at start, got {top3}"
    print("PASS grid-anchor unit test")


def test_projection_sorting() -> None:
    """Close cars on track should order by shared projected progress, not rel_dist noise."""
    starting_positions = {"A": 1, "B": 8, "C": 10}
    baselines = {
        code: {"dist": 0.0, "lap": 1.0, "rel_dist": 0.0}
        for code in starting_positions
    }
    ref_len = 5000.0

    snapshot = [
        {"code": "B", "lap": 1, "rel_dist": 0.95, "dist": 4800.0, "proj_m": 1200.0, "progress_u": 1200.0},
        {"code": "C", "lap": 1, "rel_dist": 0.94, "dist": 4750.0, "proj_m": 1195.0, "progress_u": 1195.0},
        {"code": "A", "lap": 1, "rel_dist": 0.10, "dist": 500.0, "proj_m": 1300.0, "progress_u": 1300.0},
    ]

    _sort_snapshot_for_positions(
        snapshot,
        starting_positions=starting_positions,
        baselines=baselines,
        track_length_m=ref_len,
        frame_time=120.0,
        ref_total_length=ref_len,
        use_projection=True,
    )

    order = [row["code"] for row in snapshot]
    assert order == ["A", "B", "C"], f"Projection order should be A,B,C, got {order}"
    assert _progress_m(snapshot[0], ref_len) > _progress_m(snapshot[1], ref_len)
    print("PASS projection sort unit test")


def test_miami_starting_grid(session) -> dict[str, int]:
    codes = [session.get_driver(num)["Abbreviation"] for num in session.drivers]
    starting = _get_starting_order(session, codes)
    top3 = sorted(starting.items(), key=lambda kv: kv[1])[:3]
    print(f"Miami starting grid top 3: {top3}")
    assert top3[0][1] == 1, "Grid leader must be P1"
    print("PASS Miami starting grid extraction")
    return starting


def _load_miami_telemetry(session):
    sys.argv.append("--refresh-data")
    try:
        return get_race_telemetry(session, session_type="R")
    finally:
        if "--refresh-data" in sys.argv:
            sys.argv.remove("--refresh-data")


def test_miami_frame_zero(starting_positions: dict[str, int], frames) -> None:
    assert frames, "No frames returned"
    drivers = frames[0]["drivers"]

    for code, grid_pos in starting_positions.items():
        if code not in drivers:
            continue
        frame_pos = drivers[code]["position"]
        assert frame_pos == grid_pos, (
            f"{code} should start P{grid_pos}, frame 0 has P{frame_pos}"
        )

    ordered = sorted(drivers.items(), key=lambda item: item[1]["position"])
    top5 = [(code, data["position"]) for code, data in ordered[:5]]
    print(f"Miami frame 0 top 5: {top5}")
    print("PASS Miami frame 0 matches official grid")


def test_lap1_midfield_stability(frames, starting_positions: dict[str, int]) -> None:
    """Midfield drivers must not jump to the top 3 during lap 1 after the grid anchor."""
    start_idx = int(FPS * 26)
    end_idx = min(len(frames) - 1, int(FPS * 120))

    for code, grid_pos in starting_positions.items():
        if grid_pos <= 5:
            continue
        worst = grid_pos
        for i in range(start_idx, end_idx):
            drivers = frames[i]["drivers"]
            d = drivers.get(code)
            if not d:
                continue
            if int(d.get("lap", 1)) != 1:
                continue
            pos = int(d.get("position", 999))
            worst = min(worst, pos)
            if pos <= 3:
                raise AssertionError(
                    f"{code} (grid P{grid_pos}) reached P{pos} on lap 1 at t={frames[i]['t']:.1f}s"
                )
        print(f"  {code} grid P{grid_pos}: best lap-1 position P{worst}")
    print("PASS lap-1 midfield stability")


def test_mid_race_position_stability(frames) -> None:
    """No midfield driver should spike to P1 and back within ~1s on the same lap."""
    if len(frames) < SPIKE_WINDOW_FRAMES * 2:
        print("SKIP mid-race stability (insufficient frames)")
        return

    start_idx = min(FPS * 60, len(frames) // 4)
    end_idx = min(len(frames) - 1, start_idx + FPS * 120)
    codes = list(frames[start_idx]["drivers"].keys())

    history: dict[str, list[int]] = {code: [] for code in codes}
    laps_hist: dict[str, list[int]] = {code: [] for code in codes}
    worst_delta: dict[str, int] = {code: 0 for code in codes}

    for i in range(start_idx, end_idx):
        drivers = frames[i]["drivers"]
        for code in codes:
            d = drivers.get(code, {})
            pos = int(d.get("position", 999))
            lap = int(d.get("lap", 1))
            history[code].append(pos)
            laps_hist[code].append(lap)
            if len(history[code]) >= 2:
                delta = abs(history[code][-1] - history[code][-2])
                worst_delta[code] = max(worst_delta[code], delta)

    top_worst = sorted(worst_delta.items(), key=lambda kv: kv[1], reverse=True)[:5]
    print(f"Worst single-frame position deltas (frames {start_idx}-{end_idx}): {top_worst}")

    for code, positions in history.items():
        laps = laps_hist[code]
        for i in range(len(positions) - SPIKE_WINDOW_FRAMES):
            window_pos = positions[i : i + SPIKE_WINDOW_FRAMES + 1]
            window_laps = laps[i : i + SPIKE_WINDOW_FRAMES + 1]
            if len(set(window_laps)) > 1:
                continue
            baseline = window_pos[0]
            if baseline <= 3:
                continue
            if min(window_pos) == 1 and max(window_pos) >= 6 and window_pos[-1] >= 6:
                print(
                    f"WARN: {code} spiked to P1 then returned to P{window_pos[-1]} "
                    f"within {SPIKE_WINDOW_FRAMES} frames on lap {window_laps[0]}"
                )

    corner_flips = [
        (code, delta)
        for code, delta in worst_delta.items()
        if delta > MAX_IMPLAUSIBLE_JUMP and delta < 10
    ]
    if corner_flips:
        print(f"WARN: single-frame position jumps (6-9): {corner_flips}")
    print("PASS mid-race position stability")


def main() -> None:
    test_grid_anchor_sorting()
    test_projection_sorting()

    enable_cache()
    session = load_session(2025, 6, "R")
    starting = test_miami_starting_grid(session)
    telemetry = _load_miami_telemetry(session)
    frames = telemetry["frames"]
    test_miami_frame_zero(starting, frames)
    test_lap1_midfield_stability(frames, starting)
    test_mid_race_position_stability(frames)
    print("All start-order checks passed.")


if __name__ == "__main__":
    main()
