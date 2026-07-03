"""Convert qualifying telemetry runs into race-like slim frames for playback."""

from __future__ import annotations

from frame_codec import slim_frame


def best_quali_segment(result: dict) -> str | None:
    if result.get("Q3"):
        return "Q3"
    if result.get("Q2"):
        return "Q2"
    if result.get("Q1"):
        return "Q1"
    return None


def pick_default_quali_run(results: list[dict]) -> tuple[str, str] | None:
    if not results:
        return None
    pole = results[0]
    segment = best_quali_segment(pole)
    if not segment:
        return None
    return pole["code"], segment


def quali_run_to_slim_frames(
    segment_data: dict,
    driver_code: str,
    position: int,
) -> list[dict]:
    """Convert one driver's Q1/Q2/Q3 fastest lap into slim playback frames."""
    frames = segment_data.get("frames") or []
    compound = int(segment_data.get("compound") or 0)
    slim: list[dict] = []

    for frame in frames:
        tel = frame.get("telemetry") or {}
        slim.append(
            slim_frame(
                {
                    "t": frame["t"],
                    "lap": 1,
                    "drivers": {
                        driver_code: {
                            "x": tel.get("x", 0.0),
                            "y": tel.get("y", 0.0),
                            "dist": tel.get("dist", 0.0),
                            "lap": 1,
                            "rel_dist": tel.get("rel_dist", 0.0),
                            "tyre": compound,
                            "tyre_life": 0,
                            "position": position,
                            "speed": tel.get("speed", 0.0),
                            "gear": tel.get("gear", 0),
                            "drs": tel.get("drs", 0),
                            "throttle": tel.get("throttle", 0.0),
                            "brake": float(tel.get("brake", 0.0)) / 100.0,
                            "in_pit": False,
                        }
                    },
                }
            )
        )

    return slim
