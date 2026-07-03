"""
Robust example-lap loading for track geometry.

Some FastF1 laps (often the fastest lap) have empty position data, which causes
get_telemetry() to fail with KeyError: "None of ['Date'] are in the columns".
This module falls back to manual pos/car merges and scans alternate laps.
"""

from __future__ import annotations

from src.f1_data import load_session


def _merge_lap_telemetry(lap) -> object | None:
    """Return a telemetry dataframe with X, Y, and DRS for track building."""
    try:
        tel = lap.get_telemetry()
        if tel is not None and not tel.empty and "X" in tel.columns and "Y" in tel.columns:
            if "DRS" not in tel.columns:
                tel = tel.copy()
                tel["DRS"] = 0
            return tel
    except Exception:
        pass

    try:
        pos = lap.get_pos_data()
        if pos is None or pos.empty or "X" not in pos.columns:
            return None

        car = lap.get_car_data()
        if car is not None and not car.empty and "DRS" in car.columns:
            merge_cols = [c for c in ("Time", "DRS") if c in car.columns]
            merged = pos.merge(car[merge_cols], on="Time", how="left")
        else:
            merged = pos.copy()
            merged["DRS"] = 0

        if "DRS" not in merged.columns:
            merged["DRS"] = 0

        return merged
    except Exception:
        return None


def _register_lap(lap, seen: set[tuple], out: list) -> None:
    if lap is None:
        return
    key = (str(lap.get("DriverNumber", "")), str(lap.get("LapNumber", "")))
    if key in seen:
        return
    seen.add(key)
    out.append(lap)


def _candidate_laps(session, year: int, round_number: int):
    """Yield laps to try, preferring quali then race (fastest first)."""
    seen: set[tuple] = set()
    candidates: list = []

    try:
        quali = load_session(year, round_number, "Q")
        if len(quali.laps) > 0:
            _register_lap(quali.laps.pick_fastest(), seen, candidates)
            for _, lap in quali.laps.head(5).iterrows():
                _register_lap(lap, seen, candidates)
    except Exception:
        pass

    if len(session.laps) > 0:
        _register_lap(session.laps.pick_fastest(), seen, candidates)
        for _, lap in session.laps.head(20).iterrows():
            _register_lap(lap, seen, candidates)

    yield from candidates


def load_example_lap(session, year: int, round_number: int):
    """Find a lap with valid X/Y telemetry for track geometry."""
    for lap in _candidate_laps(session, year, round_number):
        tel = _merge_lap_telemetry(lap)
        if tel is not None and len(tel) > 50:
            return tel
    return None
