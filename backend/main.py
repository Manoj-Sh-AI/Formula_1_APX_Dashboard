"""
FastAPI backend — live in-memory telemetry from FastF1.

No JSON/chunk files. Session is processed once into RAM, then frames are
served individually via REST or WebSocket.
"""

from __future__ import annotations

import sys
import threading
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

TEST_ROOT = Path(__file__).resolve().parent.parent
if str(TEST_ROOT) not in sys.path:
    sys.path.insert(0, str(TEST_ROOT))

from backend.session_store import store  # noqa: E402

app = FastAPI(title="F1 Dashboard Live API", version="1.0.0")

app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _http_error(exc: Exception) -> HTTPException:
    if isinstance(exc, LookupError):
        return HTTPException(status_code=404, detail=str(exc))
    if isinstance(exc, IndexError):
        return HTTPException(status_code=404, detail=str(exc))
    return HTTPException(status_code=500, detail=str(exc))


@app.get("/api/health")
def health():
    snap = store.snapshot_status()
    return {"api": "ok", "mode": "live_memory", **snap}


@app.post("/api/session/load")
def load_session_live(
    year: int = Query(2025, ge=1950, le=2100),
    round: int = Query(6, ge=1, le=30, alias="round"),
    session_type: str = Query("R", alias="session_type"),
):
    snap = store.snapshot_status()
    if snap["status"] == "loading":
        return snap

    session_type = session_type.upper()
    if (
        snap["status"] == "ready"
        and snap["year"] == year
        and snap["round"] == round
        and snap.get("session_type") == session_type
    ):
        return {**snap, "message": "Session already loaded in memory."}

    def run():
        store.load(year, round, session_type=session_type)

    threading.Thread(target=run, daemon=True).start()
    return {
        "status": "started",
        "year": year,
        "round": round,
        "session_type": session_type,
        "message": "Fetching from FastF1 into memory. Poll /api/session/load/status.",
    }


@app.post("/api/session/quali-run")
def set_quali_run(
    driver: str = Query(..., min_length=2, max_length=3),
    segment: str = Query(..., pattern="^Q[123]$"),
):
    try:
        meta = store.set_quali_run(driver.upper(), segment.upper())
        return {"status": "ready", "session": meta}
    except Exception as exc:
        raise _http_error(exc) from exc


@app.get("/api/session/load/status")
def load_session_status():
    return store.snapshot_status()


@app.get("/api/schedule")
def get_schedule(year: int = Query(2025, ge=1950, le=2100)):
    """List race weekends for a season (event name, country, round)."""
    try:
        from src.f1_data import enable_cache, get_race_weekends_by_year

        enable_cache()
        weekends = get_race_weekends_by_year(year)
        return {"year": year, "events": weekends}
    except Exception as exc:
        raise _http_error(exc) from exc


@app.get("/api/session")
def get_session():
    try:
        return store.get_session_meta()
    except Exception as exc:
        raise _http_error(exc) from exc


@app.get("/api/race-control")
def get_race_control():
    try:
        meta = store.get_session_meta()
        return {
            "messages": meta.get("race_control_messages", []),
            "count": len(meta.get("race_control_messages", [])),
        }
    except Exception as exc:
        raise _http_error(exc) from exc


@app.get("/api/track")
def get_track():
    try:
        return store.get_track()
    except Exception as exc:
        raise _http_error(exc) from exc


@app.get("/api/frames/manifest")
def frames_manifest():
    try:
        return store.get_manifest()
    except Exception as exc:
        raise _http_error(exc) from exc


@app.get("/api/frames/range")
def frames_range(
    start: int = Query(0, ge=0),
    count: int = Query(2, ge=1, le=50),
):
    try:
        frames = store.get_frames_range(start, count)
        return {"start": start, "count": len(frames), "frames": frames}
    except Exception as exc:
        raise _http_error(exc) from exc


@app.get("/api/tyre-health")
def tyre_health(frame_index: int = Query(0, ge=0)):
    try:
        return store.get_tyre_health_snapshot(frame_index)
    except Exception as exc:
        raise _http_error(exc) from exc


@app.get("/api/timeline")
def timeline():
    try:
        meta = store.get_session_meta()
        return {
            "events": meta.get("timeline_events", []),
            "count": len(meta.get("timeline_events", [])),
        }
    except Exception as exc:
        raise _http_error(exc) from exc


@app.get("/api/tyre-strategy")
def tyre_strategy(frame_index: int = Query(0, ge=0)):
    try:
        return store.get_tyre_strategy_snapshot(frame_index)
    except Exception as exc:
        raise _http_error(exc) from exc


@app.get("/api/frames/{index}")
def get_frame(index: int):
    try:
        return store.get_frame(index)
    except Exception as exc:
        raise _http_error(exc) from exc


@app.websocket("/ws/playback")
async def ws_playback(websocket: WebSocket):
    """Client sends frame index requests; server replies with slim frame JSON."""
    await websocket.accept()
    try:
        meta = store.get_session_meta()
        manifest = store.get_manifest()
        await websocket.send_json({"type": "init", "session": meta, "manifest": manifest})

        while True:
            msg = await websocket.receive_json()
            if msg.get("type") == "stop":
                break
            if msg.get("type") == "get_frame":
                idx = int(msg.get("index", 0))
                frame = store.get_frame(idx)
                await websocket.send_json({"type": "frame", "index": idx, "frame": frame})
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        await websocket.close(code=1011, reason=str(exc))
