import { describe, expect, it } from 'vitest';
import { reliquaryCaption } from '../src/ui/reliquary';

describe('reliquary caption', () => {
  it('does not claim an attuned relic when none is attuned', () => {
    expect(reliquaryCaption(null)).toBe('No relic waits on the shrine yet.');
  });

  it('names the attuned state when a relic is attuned', () => {
    expect(reliquaryCaption('echo_dagger')).toBe('The attuned relic waits on the shrine.');
  });
});
