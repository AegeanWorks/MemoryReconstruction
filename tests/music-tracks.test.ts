import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import musicJson from '../src/data/music.json';
import { MUSIC_TRACKS, musicBiomes, musicUrls, trackFor } from '../src/audio/music';

const tracks = (musicJson as { tracks: Array<Record<string, unknown>> }).tracks;
const read = (path: string): string => readFileSync(join(__dirname, path), 'utf8');

const ids = MUSIC_TRACKS.map((track) => track.id);

describe('the soundtrack model', () => {
  it('gives every biome an ambient and a battle track', () => {
    const biomes = musicBiomes();
    expect(biomes.length).toBe(16);
    for (const biome of biomes) {
      expect(ids, `${biome} ambient`).toContain(`${biome}-ambient`);
      expect(ids, `${biome} battle`).toContain(`${biome}-battle`);
    }
  });

  it('ships one shared guardian theme', () => {
    const boss = MUSIC_TRACKS.filter((track) => track.biome === 'boss');
    expect(boss).toHaveLength(1);
    expect(boss[0].mode).toBe('battle');
    expect(trackFor('ruins', 'ambient', true)).toBe(boss[0]);
  });

  it('keys every track uniquely and describes it for the generator', () => {
    expect(new Set(ids).size).toBe(ids.length);
    for (const track of MUSIC_TRACKS) {
      expect(track.prompt.length, track.id).toBeGreaterThan(20);
      expect(track.theme.length, track.id).toBeGreaterThan(10);
      expect(track.title.length, track.id).toBeGreaterThan(3);
      expect(track.duration, track.id).toBeGreaterThanOrEqual(30);
      expect(['ambient', 'battle'], track.id).toContain(track.mode);
    }
  });

  it('resolves a biome and mode to its own track', () => {
    expect(trackFor('ash', 'battle')?.id).toBe('ash-battle');
    expect(trackFor('sanctuary', 'ambient')?.id).toBe('sanctuary-ambient');
    expect(trackFor('storm', 'battle')?.mode).toBe('battle');
  });

  it('offers ogg first, then mp3, then wav', () => {
    expect(musicUrls('ruins-ambient')).toEqual([
      './assets/music/ruins-ambient.ogg',
      './assets/music/ruins-ambient.mp3',
      './assets/music/ruins-ambient.wav',
    ]);
  });

  it('covers both Vault biomes as well', () => {
    expect(ids).toContain('hive-ambient');
    expect(ids).toContain('storm-ambient');
  });

  it('keeps the data file the game imports identical to the parsed list', () => {
    expect(tracks.length).toBe(MUSIC_TRACKS.length);
    for (const [index, raw] of tracks.entries()) {
      expect(raw.id).toBe(MUSIC_TRACKS[index].id);
    }
  });
});

describe('the generator and the game share one manifest', () => {
  it('reads the same JSON the game imports', () => {
    const script = read('../scripts/generate_music.py');
    expect(script).toContain('src" / "data" / "music.json');
    expect(script).toContain('REPLICATE_API_TOKEN');
    expect(script).toContain('GEMINI_API_KEY');
  });

  it('refuses to fake audio without provider keys', () => {
    const script = read('../scripts/generate_music.py');
    expect(script).toContain('must not ship as music');
    expect(script).toContain('--dry-run');
  });

  it('writes into assets/music, which the loader reads from', () => {
    const script = read('../scripts/generate_music.py');
    expect(script).toContain('"assets" / "music"');
    const sound = read('../src/audio/Sound.ts');
    expect(sound).toContain('musicUrls');
    expect(sound).toContain('decodeAudioData');
  });
});

describe('battle and ambient switching', () => {
  it('asks for the battle track when a room seals, ambient when it clears', () => {
    const app = read('../src/app/App.ts');
    expect(app).toContain("case 'roomLocked':");
    expect(app).toContain("this.sound.playMusic(world.plan.biome, 'battle')");
    expect(app).toContain("this.sound.playMusic(world.plan.biome, 'ambient')");
    expect(app).toContain("this.sound.playMusic(world.plan.biome, 'battle', true)");
  });

  it('keeps the menu and Sanctuary on their procedural ambience', () => {
    const app = read('../src/app/App.ts');
    expect(app).not.toContain("this.sound.playMusic('sanctuary'");
    expect(app).toContain("this.sound.playAmbience('sanctuary')");
    expect(app).toContain('this.sound.stopMusic()');
  });

  it('falls back to the procedural ambience when a track is missing', () => {
    const sound = read('../src/audio/Sound.ts');
    expect(sound).toContain('private readonly missingTracks');
    expect(sound).toContain('this.playAmbience(track.biome');
  });

  it('loops tracks and crossfades between them', () => {
    const sound = read('../src/audio/Sound.ts');
    expect(sound).toContain('source.loop = true');
    expect(sound).toContain('linearRampToValueAtTime(1, ctx.currentTime + 1.6)');
  });
});
