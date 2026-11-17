import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import musicJson from '../src/data/music.json';
import { MUSIC_TRACKS, MUSIC_EXTENSIONS } from '../src/audio/music';

const tracks = (musicJson as { tracks: Array<{ id: string; mode: string }> }).tracks;
const musicDir = join(__dirname, '../assets/music');
const read = (path: string): string => readFileSync(join(__dirname, path), 'utf8');

/** Parses the 44-byte canonical PCM WAV header. */
function wavInfo(name: string): { channels: number; rate: number; bits: number; seconds: number; peak: number } {
  const buffer = readFileSync(join(musicDir, name));
  expect(buffer.toString('ascii', 0, 4), name).toBe('RIFF');
  expect(buffer.toString('ascii', 8, 12), name).toBe('WAVE');
  const channels = buffer.readUInt16LE(22);
  const rate = buffer.readUInt32LE(24);
  const bits = buffer.readUInt16LE(34);
  const dataBytes = buffer.readUInt32LE(40);
  const frames = dataBytes / (channels * (bits / 8));
  let peak = 0;
  for (let i = 44; i + 1 < buffer.length; i += 2) peak = Math.max(peak, Math.abs(buffer.readInt16LE(i)));
  return { channels, rate, bits, seconds: frames / rate, peak };
}


/**
 * How "bright" a track is: the mean absolute sample-to-sample change divided by
 * the mean absolute level. Percussion bursts (broadband, high-passed noise) push
 * this up; slow sine drones keep it low. It is loudness-independent, so it
 * compares a quiet calm loop with a loud battle loop fairly.
 */
function brightness(name: string): number {
  const buffer = readFileSync(join(musicDir, name));
  let diff = 0;
  let level = 0;
  let count = 0;
  let previous = 0;
  for (let i = 44; i + 1 < buffer.length; i += 2) {
    const value = buffer.readInt16LE(i);
    diff += Math.abs(value - previous);
    level += Math.abs(value);
    previous = value;
    count += 1;
  }
  return count === 0 ? 0 : diff / Math.max(1, level);
}

const BIOMES = [
  'ruins',
  'forest',
  'caves',
  'crystal',
  'ash',
  'foundry',
  'abyss',
  'void',
  'frost',
  'bloom',
  'mire',
  'hive',
  'catacomb',
  'tide',
  'storm',
  'sanctuary',
];

describe('the synthesized soundtrack', () => {
  it('ships a playable file for every manifest track', () => {
    const files = new Set(readdirSync(musicDir));
    for (const track of tracks) {
      const present = MUSIC_EXTENSIONS.some((ext) => files.has(`${track.id}.${ext}`));
      expect(present, `${track.id} is missing from assets/music`).toBe(true);
    }
  });

  it('writes real mono 16-bit PCM that is not silent', () => {
    const files = readdirSync(musicDir).filter((name) => name.endsWith('.wav'));
    expect(files.length).toBeGreaterThanOrEqual(MUSIC_TRACKS.length);
    for (const name of files) {
      const info = wavInfo(name);
      expect(info.channels, name).toBe(1);
      expect(info.bits, name).toBe(16);
      expect(info.rate, name).toBeGreaterThanOrEqual(16000);
      expect(info.seconds, name).toBeGreaterThanOrEqual(6);
      expect(info.seconds, name).toBeLessThanOrEqual(14);
      // A track that is functionally silent would defeat the point.
      expect(info.peak, name).toBeGreaterThan(3000);
    }
  });

  it('gives calm and battle distinct files, not the same render', () => {
    const bytes = (id: string): number => readFileSync(join(musicDir, `${id}.wav`)).length;
    // Different arrangements mean different sample content; sizes may match,
    // so compare a slice of the audio data instead.
    const slice = (id: string): string =>
      readFileSync(join(musicDir, `${id}.wav`)).subarray(44, 44 + 4096).toString('hex');
    expect(slice('ruins-ambient')).not.toBe(slice('ruins-battle'));
    expect(slice('hive-ambient')).not.toBe(slice('hive-battle'));
    expect(bytes('ruins-ambient')).toBeGreaterThan(0);
  });

  it('keeps the whole soundtrack a sensible size', () => {
    let total = 0;
    for (const name of readdirSync(musicDir)) total += readFileSync(join(musicDir, name)).length;
    // Loops are short on purpose; 25 MB is the ceiling for the whole set.
    expect(total / (1024 * 1024)).toBeLessThan(25);
  });

  it('has a synthesizer script that is dependency-free', () => {
    const script = read('../scripts/synthesize_music.py');
    expect(script).toContain('import wave');
    expect(script).toContain('src" / "data" / "music.json');
    expect(script).toContain('--verify');
    // No third-party imports: this must run on a bare Python 3.10+.
    expect(script).not.toContain('import numpy');
    expect(script).not.toContain('import torch');
  });

  it('loads whichever extension exists, so WAV-only shipping works', () => {
    const sound = read('../src/audio/Sound.ts');
    expect(sound).toContain('loadFirstTrack');
    expect(sound).toContain('musicUrls(track.id)');
  });

  it('makes battle audibly sharper than calm, not just a different file', () => {
    // Percussion is broadband, so a fight must carry more high-frequency change
    // than the drones of the same biome. This catches a render that silently
    // produced another pad, or percussion drowned under the bass.
    for (const biome of BIOMES) {
      const calm = brightness(`${biome}-ambient.wav`);
      const fight = brightness(`${biome}-battle.wav`);
      expect(calm, `${biome} ambient is silent`).toBeGreaterThan(0.01);
      expect(fight / calm, `${biome} battle is not sharper than its calm track`).toBeGreaterThan(
        1.15
      );
    }
  });

  it('gives the guardian theme a fight-grade mix too', () => {
    const boss = brightness('boss-ambient.wav');
    // The guardian theme is the heaviest fight in the game.
    for (const biome of BIOMES) {
      expect(boss, `boss theme is not at least as sharp as ${biome} battle`).toBeGreaterThan(
        brightness(`${biome}-ambient.wav`)
      );
    }
  });
});
