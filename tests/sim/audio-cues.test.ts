import { describe, expect, it } from 'vitest';
import type { AttackKind } from '../../src/sim/entities';
import { ENEMY_ATTACK_AUDIO } from '../../src/audio/Sound';

const ALL_KINDS: AttackKind[] = [
  'strike',
  'lunge',
  'slam',
  'shot',
  'spread',
  'ring',
  'charge',
  'volley',
  'summon',
  'beam',
  'mortar',
  'mines',
  'spiral',
  'blink',
  'bomb',
  'swarm',
  'hook',
  'quake',
  'fan',
  'sweep',
  'wall',
  'pillars',
  'combo',
  'dashStrike',
  'bolt',
];

describe('enemy attack audio cues (every telegraph pays a sound)', () => {
  it('every AttackKind has a data-driven audio preset', () => {
    for (const kind of ALL_KINDS) {
      expect(ENEMY_ATTACK_AUDIO[kind], `missing audio preset for ${kind}`).toBeDefined();
    }
  });

  it('projectile launches share the shot throttle so volleys cannot clip', () => {
    for (const kind of ['shot', 'spread', 'ring', 'volley', 'fan', 'wall', 'spiral', 'bolt'] as const) {
      const preset = ENEMY_ATTACK_AUDIO[kind];
      expect(preset.op).toBe('tone');
      if (preset.op === 'tone') expect(preset.key).toBe('shot');
    }
  });

  it('dedicated-event attacks stay quiet on enemyAttack to avoid double playback', () => {
    // beam/blink/bomb/hook already emit beam/blink/bombThrown/hook events with
    // their own sounds on the same tick; enemyAttack must not stack a second cue.
    for (const kind of ['beam', 'blink', 'bomb', 'hook'] as const) {
      expect(ENEMY_ATTACK_AUDIO[kind].op).toBe('none');
    }
  });

  it('heavy ground attacks keep distinct throttled keys', () => {
    const keys = new Set<string>();
    for (const kind of ['slam', 'quake', 'pillars', 'mortar', 'mines'] as const) {
      const preset = ENEMY_ATTACK_AUDIO[kind];
      expect(preset.op).not.toBe('none');
      const key =
        preset.op === 'thump' || preset.op === 'tone'
          ? preset.key
          : preset.op;
      expect(keys.has(key)).toBe(false);
      keys.add(key);
    }
  });
});
