import { afterEach, describe, expect, it, vi } from 'vitest';
import { Sound } from '../src/audio/Sound';
import type { SimEvent } from '../src/sim/events';

class FakeParam {
  value = 0;
  setValueAtTime(): this {
    return this;
  }
  linearRampToValueAtTime(): this {
    return this;
  }
  exponentialRampToValueAtTime(): this {
    return this;
  }
  setTargetAtTime(): this {
    return this;
  }
  cancelScheduledValues(): this {
    return this;
  }
}

class FakeNode {
  gain = new FakeParam();
  frequency = new FakeParam();
  detune = new FakeParam();
  Q = new FakeParam();
  type = 'sine';
  buffer: unknown = null;
  loop = false;
  connect(target: unknown): unknown {
    return target;
  }
  disconnect(): void {
    // no-op
  }
  start(): void {
    // no-op
  }
  stop(): void {
    // no-op
  }
}

class FakeAudioContext {
  currentTime = 1;
  sampleRate = 48_000;
  state = 'running';
  destination = new FakeNode();
  createGain = (): FakeNode => new FakeNode();
  createOscillator = (): FakeNode => new FakeNode();
  createBiquadFilter = (): FakeNode => new FakeNode();
  createBufferSource = (): FakeNode => new FakeNode();
  createBuffer = (_channels: number, length: number): { getChannelData: () => Float32Array } => ({
    getChannelData: () => new Float32Array(length),
  });
  resume = (): Promise<void> => Promise.resolve();
  suspend = (): Promise<void> => Promise.resolve();
}

/** Typed so a new SimEvent variant fails to compile until this map gains a sample. */
type Samples = { [K in SimEvent['type']]: Extract<SimEvent, { type: K }> };

const SAMPLES: Samples = {
  swing: { type: 'swing', x: 0, y: 0, angle: 0, combo: 0, weapon: 'sword' },
  weaponSwitch: { type: 'weaponSwitch', weapon: 'spear' },
  enemySlash: { type: 'enemySlash', x: 0, y: 0, angle: 0, combo: 1, weapon: 'greatsword' },
  bombThrown: { type: 'bombThrown', x: 0, y: 0, owner: 'enemy' },
  weaponArt: { type: 'weaponArt', weapon: 'sword', x: 0, y: 0, radius: 40 },
  dash: { type: 'dash', x: 0, y: 0 },
  bolt: { type: 'bolt', x: 0, y: 0, angle: 0 },
  hit: { type: 'hit', x: 0, y: 0, amount: 5, crit: true, target: 'enemy' },
  shockwave: { type: 'shockwave', x: 0, y: 0, radius: 60 },
  enemySpawned: { type: 'enemySpawned', id: 1, x: 0, y: 0 },
  enemyWindup: { type: 'enemyWindup', id: 1, attack: 'strike' },
  enemyAttack: { type: 'enemyAttack', id: 1, attack: 'shot', x: 0, y: 0 },
  enemyDied: { type: 'enemyDied', id: 1, x: 0, y: 0, boss: true, defId: 'guardian' },
  playerHurt: { type: 'playerHurt', amount: 8 },
  playerDied: { type: 'playerDied' },
  soulAnchor: { type: 'soulAnchor', x: 0, y: 0 },
  potion: { type: 'potion', healed: 20 },
  manaPotion: { type: 'manaPotion', restored: 30 },
  shop: { type: 'shop', targetId: 1 },
  pickup: { type: 'pickup', kind: 'shard', x: 0, y: 0, amount: 4 },
  levelUp: { type: 'levelUp', level: 3 },
  resonance: { type: 'resonance', count: 3, multiplier: 1.2 },
  resonanceBreak: { type: 'resonanceBreak', count: 4 },
  graze: { type: 'graze', x: 0, y: 0 },
  clutchGraze: { type: 'clutchGraze', x: 0, y: 0 },
  lootSurge: { type: 'lootSurge', x: 0, y: 0, kind: 'jackpot', amount: 12 },
  objectiveComplete: { type: 'objectiveComplete', shards: 10 },
  flawlessRoom: { type: 'flawlessRoom', roomId: 2, shards: 5 },
  equipment: {
    type: 'equipment',
    name: 'Rusted Edge',
    rarity: 'common',
    slot: 'weapon',
    auto: false,
  },
  hazardBurst: { type: 'hazardBurst', kind: 'crystal', x: 0, y: 0, radius: 30 },
  hazardHit: { type: 'hazardHit', kind: 'spike', x: 0, y: 0 },
  sanctuary: { type: 'sanctuary', kind: 'npc', id: 'archivist' },
  buildingExit: { type: 'buildingExit', id: 'reliquary' },
  blast: { type: 'blast', x: 0, y: 0, radius: 40 },
  bombExploded: { type: 'bombExploded', x: 0, y: 0, radius: 50 },
  beam: { type: 'beam', x: 0, y: 0, angle: 0, length: 100, width: 8 },
  blink: { type: 'blink', x: 0, y: 0, toX: 10, toY: 10 },
  hook: { type: 'hook', x: 0, y: 0, toX: 10, toY: 10 },
  roomLocked: { type: 'roomLocked', roomId: 1, x: 0, y: 0 },
  roomCleared: { type: 'roomCleared', roomId: 1 },
  secretOpened: { type: 'secretOpened', roomId: 1 },
  actionDenied: { type: 'actionDenied', action: 'bolt' },
  bossIntro: { type: 'bossIntro', name: 'The Keeper', x: 0, y: 0 },
  bossPhase: { type: 'bossPhase', phase: 2, x: 0, y: 0 },
  fragmentFound: { type: 'fragmentFound', fragmentId: 'frag-01' },
  interact: { type: 'interact', kind: 'chest', x: 0, y: 0 },
  notice: { type: 'notice', text: 'The door is sealed.' },
  floorExit: { type: 'floorExit' },
  victory: { type: 'victory' },
  shake: { type: 'shake', strength: 6 },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Sound.handle covers every event', () => {
  it('plays each event type without throwing', () => {
    vi.stubGlobal('window', { AudioContext: FakeAudioContext });
    const sound = new Sound();
    sound.unlock();
    for (const [type, event] of Object.entries(SAMPLES)) {
      expect(() => sound.handle([event as SimEvent]), `event ${type}`).not.toThrow();
    }
  });

  it('handles a whole frame of mixed events, as the game loop does', () => {
    vi.stubGlobal('window', { AudioContext: FakeAudioContext });
    const sound = new Sound();
    sound.unlock();
    sound.handle(Object.values(SAMPLES) as SimEvent[]);
    expect(sound).toBeTruthy();
  });

  it('is safe before the first gesture creates the context', () => {
    vi.stubGlobal('window', { AudioContext: FakeAudioContext });
    const sound = new Sound();
    expect(() => sound.handle(Object.values(SAMPLES) as SimEvent[])).not.toThrow();
    expect(() => sound.setVolumes(0.5, 0.4, 0.3)).not.toThrow();
    expect(() => sound.setSuspended(true)).not.toThrow();
    expect(() => sound.setSuspended(false)).not.toThrow();
  });

  it('survives a browser with no Web Audio at all', () => {
    vi.stubGlobal('window', {});
    const sound = new Sound();
    expect(() => sound.unlock()).not.toThrow();
    expect(() => sound.handle(Object.values(SAMPLES) as SimEvent[])).not.toThrow();
  });
});
