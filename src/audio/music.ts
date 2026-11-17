/**
 * The soundtrack manifest: one ambient and one battle track per biome, plus a
 * shared guardian theme, each with the prompt Muse renders it from.
 *
 * The track list lives in `src/data/music.json` so the generator script and the
 * game read exactly the same data.
 *
 * The game never requires these files. When `assets/music/<id>.<ext>` exists it
 * plays as a looping track with a crossfade between rooms and fights; when it
 * does not, the procedural ambience in `Sound` carries the room instead, so a
 * checkout without generated audio still has atmosphere.
 */
import musicJson from '@data/music.json';
import type { BiomeId } from '../sim/content';

export type MusicMode = 'ambient' | 'battle';

export interface MusicTrack {
  /** File stem under `assets/music/`. */
  id: string;
  /** Which room state the track belongs to. */
  mode: MusicMode;
  /** The biome it was written for, or `boss` for the shared guardian theme. */
  biome: BiomeId | 'boss';
  title: string;
  /** Muse prompt describing the arrangement. */
  prompt: string;
  /** The theme the judge scores the render against. */
  theme: string;
  /** Render length in seconds; each track loops, so 45 s is plenty. */
  duration: number;
}

/** Every track the game looks for, in a stable order. */
export const MUSIC_TRACKS: readonly MusicTrack[] = (musicJson as { tracks: MusicTrack[] }).tracks;

/** File extensions the loader accepts, in preference order. */
export const MUSIC_EXTENSIONS = ['ogg', 'mp3', 'wav'] as const;

/**
 * Candidate URLs for a track id. `base` is the public asset root, which is
 * `./assets` in the built game; the loader passes whatever the page serves.
 */
export function musicUrls(id: string, base = './assets'): string[] {
  return MUSIC_EXTENSIONS.map((ext) => `${base}/music/${id}.${ext}`);
}

/** The track for a biome and mode, or the guardian theme when a boss is up. */
export function trackFor(biome: BiomeId, mode: MusicMode, boss = false): MusicTrack | undefined {
  if (boss) return MUSIC_TRACKS.find((track) => track.id === 'boss-ambient');
  return MUSIC_TRACKS.find((track) => track.id === `${biome}-${mode}`);
}

/** Every biome the manifest covers. */
export function musicBiomes(): string[] {
  return [
    ...new Set(MUSIC_TRACKS.filter((track) => track.biome !== 'boss').map((track) => track.biome)),
  ];
}
