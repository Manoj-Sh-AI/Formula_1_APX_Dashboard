"""
Convert monolithic frames.json into slim chunked files for web playback.

Run once if you have a large frames.json from an earlier export:
    python split_frames.py
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent / "data"
FRAMES_DIR = DATA_DIR / "frames"
CHUNK_SIZE = 1500


from frame_codec import slim_frame
def write_chunks(frames: list[dict]) -> dict:
    if FRAMES_DIR.exists():
        shutil.rmtree(FRAMES_DIR)
    FRAMES_DIR.mkdir(parents=True)

    num_chunks = (len(frames) + CHUNK_SIZE - 1) // CHUNK_SIZE
    for i in range(num_chunks):
        start = i * CHUNK_SIZE
        chunk = [slim_frame(f) for f in frames[start : start + CHUNK_SIZE]]
        path = FRAMES_DIR / f"chunk_{i:04d}.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump(chunk, f, separators=(",", ":"))
        size_kb = path.stat().st_size / 1024
        print(f"  chunk_{i:04d}.json  ({len(chunk)} frames, {size_kb:.0f} KB)")

    manifest = {
        "total_frames": len(frames),
        "chunk_size": CHUNK_SIZE,
        "num_chunks": num_chunks,
        "fps": 25,
        "format": "slim",
    }
    with open(DATA_DIR / "frames_manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    return manifest


def main() -> None:
    src = DATA_DIR / "frames.json"
    if not src.exists():
        print("No frames.json found. Run export_session.py first.")
        return

    size_mb = src.stat().st_size / (1024 * 1024)
    print(f"Reading frames.json ({size_mb:.1f} MB)...")
    with open(src, encoding="utf-8") as f:
        frames = json.load(f)

    print(f"Writing {len(frames)} frames as slim chunks...")
    manifest = write_chunks(frames)
    print(f"Done -> {FRAMES_DIR} ({manifest['num_chunks']} chunks)")
    print("You can delete frames.json to save disk space.")


if __name__ == "__main__":
    main()
