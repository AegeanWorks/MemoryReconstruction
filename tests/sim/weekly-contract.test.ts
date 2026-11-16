import { describe, expect, it } from 'vitest';
import { defaultMeta, weeklyKey } from '../../src/save/SaveStore';
import { claimWeeklyBounty, weeklyBounty } from '../../src/sim/quests';

const monday = new Date(2026, 10, 16, 12);
const wednesday = new Date(2026, 10, 18, 12);
const nextMonday = new Date(2026, 10, 23, 12);

describe('weekly contracts', () => {
  it('keys a whole ISO week the same and the next week differently', () => {
    expect(weeklyKey(monday)).toMatch(/^\d{4}-W\d{2}$/);
    expect(weeklyKey(monday)).toBe(weeklyKey(wednesday));
    expect(weeklyKey(monday)).not.toBe(weeklyKey(nextMonday));
  });

  it('is deterministic for a key and offers forty kills for eight hundred echoes', () => {
    const a = weeklyBounty('2026-W47');
    const b = weeklyBounty('2026-W47');
    expect(a).toEqual(b);
    expect(a.target).toBe(40);
    expect(a.reward).toBe(800);
    expect(a.defId.length).toBeGreaterThan(0);
  });

  it('rotates its mark across weeks', () => {
    const picks = new Set(
      ['2026-W45', '2026-W46', '2026-W47', '2026-W48', '2026-W49', '2026-W50'].map(
        (key) => weeklyBounty(key).defId
      )
    );
    expect(picks.size).toBeGreaterThan(1);
  });

  it('resets progress when the week turns', () => {
    expect(defaultMeta().weeklyBounty).toEqual({ key: '', kills: 0, claimed: false });
    const progress = { key: '2026-W46', kills: 39, claimed: false };
    expect(weeklyBounty('2026-W47').target).toBe(40);
    expect(
      claimWeeklyBounty({ echoes: 0, weeklyBounty: progress }, '2026-W47')
    ).toBeUndefined();
  });

  it('pays once when the target is reached', () => {
    const meta = {
      echoes: 10,
      weeklyBounty: { key: '2026-W47', kills: 40, claimed: false },
    };
    const settled = claimWeeklyBounty(meta, '2026-W47')!;
    expect(settled.reward).toBe(800);
    expect(settled.echoes).toBe(810);
    expect(settled.weeklyBounty.claimed).toBe(true);
    expect(claimWeeklyBounty(settled, '2026-W47')).toBeUndefined();
  });
});
