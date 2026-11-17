"""Render the game's soundtrack through the Muse project.

    python scripts/generate_music.py --dry-run     # write manifests and list work
    python scripts/generate_music.py               # render every missing track
    python scripts/generate_music.py --force ash-ambient

The track list lives in `src/data/music.json`, which the game imports too, so the
prompts have one home. Muse renders each track, the judge scores it against the
theme, and a render that clears the score is copied into `assets/music/`, where
`src/audio/music.ts` picks it up automatically.

Keys come only from REPLICATE_API_TOKEN and GEMINI_API_KEY. Without them the
script writes the manifests and stops with a Why/Fix instead of writing
placeholder audio, because a test tone must never ship as if it were music.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "src" / "data" / "music.json"
MANIFEST = ROOT / "src" / "data" / "music_manifest.json"
BATCH = ROOT / "src" / "data" / "music_batch.json"
OUT = ROOT / "assets" / "music"
MUSE_DIR = ROOT.parent / "muse"
ARTIFACTS = MUSE_DIR / "output" / "memory-reconstruction"


def fail(why: str, reason: str, fix: str) -> int:
    print(f"Error: {why}", file=sys.stderr)
    print(f"Why: {reason}", file=sys.stderr)
    print(f"Fix: {fix}", file=sys.stderr)
    return 1


def readTracks() -> list[dict]:
    """The same track list the game imports, so prompts live in one place."""
    payload = json.loads(SOURCE.read_text(encoding="utf-8-sig"))
    tracks = payload.get("tracks")
    return tracks if isinstance(tracks, list) else []


def writeManifests(tracks: list[dict]) -> None:
    MANIFEST.write_text(json.dumps({"tracks": tracks}, indent=1) + "\n", encoding="utf-8")
    batch = {
        "tracks": [
            {
                "name": track["id"],
                "prompt": track["prompt"],
                "theme": track["theme"],
                "duration": int(track["duration"]),
            }
            for track in tracks
        ]
    }
    BATCH.write_text(json.dumps(batch, indent=1) + "\n", encoding="utf-8")


def rendered(trackId: str) -> Path | None:
    for ext in ("ogg", "mp3", "wav"):
        path = OUT / f"{trackId}.{ext}"
        if path.exists():
            return path
    return None


def runMuse(args: list[str]) -> int:
    exe = [sys.executable, "-m", "muse", *args]
    result = subprocess.run(exe, cwd=MUSE_DIR, timeout=3600, check=False)
    return result.returncode


def main() -> int:
    parser = argparse.ArgumentParser(description="Render the soundtrack with Muse.")
    parser.add_argument("--dry-run", action="store_true", help="write manifests and list tracks only")
    parser.add_argument("--force", nargs="*", default=[], help="re-render these track ids")
    parser.add_argument("--attempts", type=int, default=2, help="takes per track (default 2)")
    parser.add_argument("--min-score", type=int, default=60, help="judge acceptance score (default 60)")
    args = parser.parse_args()

    tracks = readTracks()
    if not tracks:
        return fail(
            "no tracks were read from src/data/music.json",
            "the manifest needs one object per track",
            'keep the shape {"tracks": [{id, mode, biome, title, prompt, theme, duration}]}',
        )
    OUT.mkdir(parents=True, exist_ok=True)
    writeManifests(tracks)

    pending = [track for track in tracks if args.force or rendered(track["id"]) is None]
    print(f"[OK] {len(tracks)} tracks in the manifest, {len(pending)} to render")
    for track in pending:
        print(f"  - {track['id']} ({track['mode']}, {track['duration']}s)")

    if args.dry_run:
        print(f"[OK] wrote {MANIFEST.relative_to(ROOT)} and {BATCH.relative_to(ROOT)}")
        return 0

    missingKeys = [name for name in ("REPLICATE_API_TOKEN", "GEMINI_API_KEY") if not os.environ.get(name)]
    if missingKeys:
        return fail(
            "the music providers are not configured: " + ", ".join(missingKeys) + " unset",
            "without a provider Muse can only write a test tone, which must not ship as music",
            "set the keys and rerun, or use --dry-run to plan the work",
        )
    if not MUSE_DIR.exists():
        return fail(
            f"the Muse project is not beside this game at {MUSE_DIR}",
            "the generator drives projects/muse",
            "check the path, or render the batch by hand and copy the files into assets/music",
        )
    if not pending:
        print("[OK] every track is already rendered")
        return 0

    code = runMuse(
        [
            "batch",
            str(BATCH),
            "--attempts",
            str(args.attempts),
            "--min-score",
            str(args.min_score),
            "--out",
            str(ARTIFACTS),
        ]
    )
    if code != 0:
        return fail(
            "muse batch failed",
            "no new track was copied into the game",
            "read the Muse output above, fix the reported track, and rerun",
        )

    copied = 0
    for track in pending:
        folder = ARTIFACTS / track["id"]
        audio = next((p for p in sorted(folder.glob("*.wav"))), None) if folder.exists() else None
        if audio is None:
            print(f"[NOTE] no render for {track['id']}; the procedural fallback keeps that room")
            continue
        target = OUT / f"{track['id']}.wav"
        shutil.copyfile(audio, target)
        copied += 1
        print(f"[OK] {target.relative_to(ROOT)}")

    print(f"[OK] copied {copied} track(s); `muse export` can shrink them to OGG or MP3")
    return 0 if copied == len(pending) else 1


if __name__ == "__main__":
    sys.exit(main())
