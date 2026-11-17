"""Synthesize the game's soundtrack locally, with no provider keys.

    python scripts/synthesize_music.py            # render every missing track
    python scripts/synthesize_music.py --force    # re-render everything
    python scripts/synthesize_music.py --verify   # check what is on disk

The track list comes from `src/data/music.json`, the same file the game imports,
so ids and modes cannot drift. Each track is a short, seamlessly looped WAV:
ambient is slow drones with sparse bells, battle is a bass ostinato with
percussion, and every biome uses its own root note, tempo and figure.

Standard library only (wave, math, array, random), so this works on any machine
with Python 3.10+ and adds no dependency. `scripts/generate_music.py` still drives
the Muse project for studio-quality renders; both write into `assets/music/`, and
the game prefers OGG, then MP3, then WAV.
"""
from __future__ import annotations

import argparse
import json
import math
import random
import struct
import sys
import wave
from array import array
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "src" / "data" / "music.json"
OUT = ROOT / "assets" / "music"
RATE = 22050

# Root note per biome, matching BIOME_ROOTS in the game's audio layer.
ROOTS = {
    "ruins": 110.0,
    "forest": 123.47,
    "caves": 98.0,
    "crystal": 130.81,
    "ash": 92.5,
    "foundry": 103.83,
    "abyss": 82.41,
    "void": 87.31,
    "frost": 155.56,
    "mire": 73.42,
    "bloom": 138.59,
    "hive": 110.0,
    "catacomb": 87.31,
    "tide": 98.0,
    "storm": 164.81,
    "sanctuary": 146.83,
    "boss": 87.31,
}

# Minor pentatonic, in semitones from the root.
SCALE = [0, 3, 5, 7, 10, 12, 15]

# Battle character per biome: bpm, bass steps (scale index, -1 rest), and the
# beat positions that take a percussion hit inside a four-beat bar.
BATTLE = {
    "ruins": (104, [0, 0, 2, 0, 3, 2, 0, -1], [0, 2]),
    "forest": (118, [0, 2, 0, 4, 0, 2, 3, 2], [0, 1.5, 2, 3.5]),
    "caves": (96, [0, -1, 0, 2, -1, 3, 0, -1], [0, 2.5]),
    "crystal": (124, [0, 3, 2, 3, 0, 3, 4, 3], [0, 1, 2, 3]),
    "ash": (112, [0, 0, 3, 0, 0, 4, 3, 0], [0, 1.5, 2.5]),
    "abyss": (84, [0, -1, 2, -1, 0, -1, 3, -1], [0, 2]),
    "void": (100, [0, 4, -1, 2, -1, 4, 0, -1], [0, 1.5, 3]),
    "frost": (108, [0, 2, 3, 2, 0, 4, 3, 2], [0, 2]),
    "bloom": (126, [0, 2, 4, 2, 3, 2, 0, 2], [0, 1, 2, 3]),
    "foundry": (120, [0, 0, 0, 3, 0, 0, 4, 3], [0, 1, 2, 3]),
    "mire": (92, [0, 2, -1, 2, 0, 3, -1, 2], [0, 1.75, 3]),
    "hive": (132, [0, 1, 0, 3, 0, 1, 3, 4], [0, 0.75, 1.5, 2.25, 3]),
    "catacomb": (88, [0, -1, 3, -1, 2, -1, 0, -1], [0, 2]),
    "tide": (110, [0, 2, 0, -1, 3, 2, 0, -1], [0, 1.5, 2.5]),
    "storm": (128, [0, 3, 4, 3, 0, 3, 2, 4], [0, 1, 2, 3]),
    "sanctuary": (96, [0, 2, 0, 3, 0, 2, 4, 3], [0, 1, 2, 3]),
    # The shared guardian theme is the heaviest fight in the game.
    "boss": (112, [0, 0, 3, 3, 0, 2, 4, 3], [0, 1, 2, 2.5, 3]),
}

# One full loop, in seconds. Short loops keep the repository small; the game
# crossfades between tracks, so a clean loop is what matters.
LOOP_SECONDS = {"ambient": 8.0, "battle": 8.0}


def beat_seconds(bpm: int) -> float:
    return 60.0 / bpm


def midi_to_hz(semitone: float, root: float) -> float:
    return root * (2 ** (semitone / 12.0))


def render(track: dict) -> tuple[array, float]:
    """Render one track into a mono float buffer that loops seamlessly."""
    track_id = track["id"]
    mode = track["mode"]
    biome = track.get("biome", "ruins")
    root = ROOTS.get(biome, 110.0)
    seconds = LOOP_SECONDS.get(mode, 8.0)
    if track_id.startswith("boss"):
        seconds = 12.0
        mode = "battle"
    total = int(seconds * RATE)
    buf = [0.0] * total
    rng = random.Random(f"{track_id}:{mode}")

    def add(index: int, value: float) -> None:
        # Wrap into the loop so a note tail bleeds into the start: no click.
        buf[index % total] += value

    def tone(start: float, dur: float, freq: float, amp: float, kind: str, attack: float) -> None:
        begin = int(start * RATE) % total
        length = int(dur * RATE)
        attack_n = max(1, int(attack * RATE))
        for i in range(length):
            t = i / RATE
            env = (i / attack_n) if i < attack_n else math.exp(-3.2 * (i - attack_n) / max(1, length))
            phase = 2 * math.pi * freq * t
            if kind == "sine":
                sample = math.sin(phase)
            elif kind == "tri":
                sample = 2 / math.pi * math.asin(math.sin(phase))
            elif kind == "bass":
                sample = math.sin(phase) + 0.35 * math.sin(2 * phase) + 0.15 * math.sin(3 * phase)
            else:  # soft brass-ish stack for boss chords
                sample = math.sin(phase) + 0.5 * math.sin(phase * 1.5)
            add(begin + i, sample * amp * env)

    def hit(start: float, amp: float, bright: float = 0.86) -> None:
        """Percussion: high-passed noise with a fast decay.

        A plain white-noise burst is mostly low energy and gets buried under the
        bass ostinato, so the noise is high-passed with a one-pole difference
        filter. That is what makes a hit read as a drum rather than a thud.
        """
        begin = int(start * RATE) % total
        length = int(0.16 * RATE)
        previous_in = 0.0
        previous_out = 0.0
        for i in range(length):
            env = math.exp(-16.0 * i / length)
            noise = rng.uniform(-1.0, 1.0)
            # one-pole high-pass: keep the fast changes, drop the body
            filtered = bright * (previous_out + noise - previous_in)
            previous_in = noise
            previous_out = filtered
            add(begin + i, filtered * amp * env)
        # A very short click on the attack sharpens the transient further.
        click = int(0.012 * RATE)
        for i in range(click):
            add(begin + i, rng.uniform(-1.0, 1.0) * amp * 0.5 * (1 - i / click))

    if mode == "ambient":
        # Three slow, slightly detuned drones with a breathing amplitude.
        for i, mult in enumerate((0.5, 0.75, 1.0)):
            freq = root * mult * (1 + (i - 1) * 0.002)
            drift = 0.85 + 0.15 * math.sin(i * 1.7)
            for n in range(total):
                t = n / RATE
                breath = 0.75 + 0.25 * math.sin(2 * math.pi * t / seconds + i)
                buf[n] += math.sin(2 * math.pi * freq * t) * 0.12 * drift * breath
        # Sparse bells from the scale.
        bells = max(2, int(seconds / 2.2))
        for b in range(bells):
            at = b * (seconds / bells) + rng.uniform(0, 0.4)
            semitone = SCALE[rng.randrange(len(SCALE))] + (12 if rng.random() < 0.3 else 0)
            tone(at, 2.2, midi_to_hz(semitone, root) * 2, 0.075, "sine", 0.01)
    else:
        bpm, bass, hits = BATTLE.get(biome, BATTLE["ruins"])
        beat = beat_seconds(bpm)
        steps_per_bar = len(bass)
        step = beat / 2.0
        bar_steps = steps_per_bar
        bar_time = step * bar_steps
        bars = max(1, round(seconds / bar_time))
        loop = bars * bar_time
        # Drone bed, quieter than ambient so the rhythm carries.
        for n in range(total):
            t = n / RATE
            buf[n] += math.sin(2 * math.pi * (root / 2) * t) * 0.06
            buf[n] += math.sin(2 * math.pi * root * t) * 0.03
        for bar in range(bars):
            bar_start = bar * bar_time
            for index, degree in enumerate(bass):
                if degree < 0:
                    continue
                at = bar_start + index * step
                semitone = SCALE[min(degree, len(SCALE) - 1)]
                tone(at, step * 0.9, midi_to_hz(semitone, root / 2), 0.11, "bass", 0.005)
            for beat_pos in hits:
                hit(bar_start + beat_pos * beat, 0.30)
            # A quieter tick on every beat keeps a steady pulse under the figure.
            for tick in range(4):
                hit(bar_start + tick * beat, 0.09, bright=0.94)
            # A sparse lead stab on the last bar keeps long loops from droning.
            if bar % 2 == 1:
                semitone = SCALE[(bar + index) % len(SCALE)]
                tone(bar_start + bar_time * 0.5, 0.5, midi_to_hz(semitone, root) * 2, 0.05, "tri", 0.01)
        # A pitched thump on beat one of each bar gives it a heartbeat.
        for bar in range(bars):
            at = bar * bar_time
            tone(at, 0.28, root * 0.5, 0.10, "sine", 0.004)

    # Gentle low-pass to tame the top end, then normalise to a safe peak.
    smoothed = [0.0] * total
    prev = 0.0
    # Less smoothing in battle keeps the percussion crisp; calm stays very round.
    alpha = 0.55 if mode == "battle" else 0.14
    for n, sample in enumerate(buf):
        prev += alpha * (sample - prev)
        smoothed[n] = prev
    peak = max(1e-9, max(abs(v) for v in smoothed))
    gain = 0.9 / peak
    pcm = array("h")
    for sample in smoothed:
        pcm.append(int(max(-1.0, min(1.0, sample * gain)) * 32767))
    return pcm, seconds


def write_wav(path: Path, pcm: array) -> None:
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(RATE)
        handle.writeframes(pcm.tobytes())


def readTracks() -> list[dict]:
    payload = json.loads(MANIFEST.read_text(encoding="utf-8-sig"))
    tracks = payload.get("tracks")
    return tracks if isinstance(tracks, list) else []


def verify(tracks: list[dict]) -> int:
    """Check every manifest track has a playable, non-silent file."""
    problems = 0
    for track in tracks:
        found = None
        for ext in ("ogg", "mp3", "wav"):
            candidate = OUT / f"{track['id']}.{ext}"
            if candidate.exists():
                found = candidate
                break
        if not found:
            print(f"[MISS] {track['id']}")
            problems += 1
            continue
        if found.suffix != ".wav":
            print(f"[OK]   {track['id']} ({found.name})")
            continue
        with wave.open(str(found), "rb") as handle:
            channels = handle.getnchannels()
            rate = handle.getframerate()
            frames = handle.getnframes()
            raw = handle.readframes(frames)
        peak = 0
        for (value,) in struct.iter_unpack("<h", raw):
            peak = max(peak, abs(value))
        if channels != 1 or rate != RATE or frames < rate:
            print(f"[FAIL] {track['id']}: {channels}ch {rate}Hz {frames} frames")
            problems += 1
        elif peak < 1200:
            print(f"[FAIL] {track['id']}: near-silent (peak {peak})")
            problems += 1
        else:
            print(f"[OK]   {track['id']} ({frames / rate:.1f}s, peak {peak})")
    print(f"[{'OK' if problems == 0 else 'FAIL'}] {len(tracks) - problems}/{len(tracks)} tracks playable")
    return 0 if problems == 0 else 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Synthesize the soundtrack with no provider keys.")
    parser.add_argument("--force", action="store_true", help="re-render tracks that already exist")
    parser.add_argument("--verify", action="store_true", help="check the files on disk instead of rendering")
    args = parser.parse_args()

    tracks = readTracks()
    if not tracks:
        print("Error: no tracks in src/data/music.json", file=sys.stderr)
        print("Fix: keep the {\"tracks\": [...]} shape with id and mode per track", file=sys.stderr)
        return 1

    if args.verify:
        return verify(tracks)

    OUT.mkdir(parents=True, exist_ok=True)
    rendered = 0
    for track in tracks:
        target = OUT / f"{track['id']}.wav"
        if target.exists() and not args.force:
            continue
        pcm, seconds = render(track)
        write_wav(target, pcm)
        rendered += 1
        print(f"[OK] {target.relative_to(ROOT)} ({seconds:.0f}s loop)")
    print(f"[OK] rendered {rendered} track(s), {len(tracks)} total in the manifest")
    return 0


if __name__ == "__main__":
    sys.exit(main())
