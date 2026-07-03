# F1 Web Dashboard — Live API POC

Live race dashboard: **FastF1 → FastAPI (in-memory) → frame-by-frame REST**. No JSON files, no chunk cache on disk.

## Architecture

```
FastF1 API
    ↓  (once per session load, ~2–5 min)
FastAPI SessionStore (RAM)
    ↓  frame-by-frame
GET /api/frames/{index}
GET /api/frames/range?start=0&count=2
    ↓
React frontend (small in-browser frame cache, prefetch ahead)
```

- **No** `data/frames.json` or chunk files
- **No** `computed_data/*.pkl` (forces fresh FastF1 processing)
- FastF1 HTTP cache (`.fastf1-cache/`) still used for API speed

## Run

```bash
# Terminal 1 — from test_project/
pip install -r requirements.txt
pip install -r ../requirements.txt   # parent FastF1 deps
uvicorn backend.main:app --reload --port 8765

# Terminal 2
cd frontend && npm install && npm run dev
```

Open **http://localhost:5173** → enter year/round → **Load from FastF1**.

Auto-load: `http://localhost:5173?year=2025&round=6&auto=1`

## API

| Endpoint | Description |
|----------|-------------|
| `POST /api/session/load?year=2025&round=6` | Fetch FastF1 → memory (background) |
| `GET /api/session/load/status` | Progress polling |
| `GET /api/session` | Event metadata, driver colors |
| `GET /api/track` | Track geometry |
| `GET /api/frames/manifest` | `{ total_frames, fps }` |
| `GET /api/frames/{index}` | Single frame (slim JSON) |
| `GET /api/frames/range?start=100&count=5` | Batch frames for prefetch |
| `WS /ws/playback` | Request frames by index over WebSocket |

## Notes

- First load per session still takes several minutes (FastF1 telemetry processing is unavoidable).
- Only **one session** is held in memory at a time.
- Legacy scripts (`export_session.py`, `split_frames.py`) remain for offline debugging only.

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| Space | Play / Pause |
| ← / → | Step |
| ↑ | Cycle speed |
