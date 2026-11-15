import { describe, expect, it } from 'vitest';
import { playSlotAction } from '../src/ui/SavesScreen';

describe('the save-slot play action', () => {
  it('does not call an empty active slot “Playing”', () => {
    expect(playSlotAction({ active: true, empty: true })).toEqual({
      label: 'Active slot',
      disabled: true,
    });
    expect(playSlotAction({ active: true, empty: false })).toEqual({
      label: 'Playing',
      disabled: true,
    });
  });

  it('offers Start here or Play for every other slot', () => {
    expect(playSlotAction({ active: false, empty: true })).toEqual({
      label: 'Start here',
      disabled: false,
    });
    expect(playSlotAction({ active: false, empty: false })).toEqual({
      label: 'Play',
      disabled: false,
    });
  });
});
