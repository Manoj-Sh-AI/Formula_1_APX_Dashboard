"""Convert full telemetry frames to/from compact API payloads."""

from __future__ import annotations


def slim_frame(frame: dict) -> dict:
    drivers: dict[str, list] = {}
    for code, d in frame.get("drivers", {}).items():
        drivers[code] = [
            round(d["x"], 1),
            round(d["y"], 1),
            int(d["position"]),
            round(d["speed"]),
            int(d["gear"]),
            int(d["drs"]),
            round(d["throttle"]),
            round(d["brake"] * 100) if d.get("brake", 0) <= 1 else round(d["brake"]),
            round(d["tyre"]),
            int(d["lap"]),
            1 if d.get("in_pit") else 0,
            round(float(d.get("rel_dist", 0)), 4),
            int(d.get("tyre_life", 0)),
            round(float(d.get("dist", 0)), 1),
        ]

    out: dict = {
        "t": round(frame["t"], 2),
        "lap": int(frame["lap"]),
        "d": drivers,
    }

    sc = frame.get("safety_car")
    if sc:
        out["sc"] = [round(sc["x"], 1), round(sc["y"], 1), float(sc.get("alpha", 1))]

    weather = frame.get("weather")
    if weather:
        rain = weather.get("rain_state", "DRY")
        out["w"] = [
            round(weather["track_temp"], 1) if weather.get("track_temp") is not None else None,
            round(weather["air_temp"], 1) if weather.get("air_temp") is not None else None,
            round(weather["humidity"], 1) if weather.get("humidity") is not None else None,
            round(weather["wind_speed"], 1) if weather.get("wind_speed") is not None else None,
            1 if rain == "RAINING" else 0,
        ]

    return out
