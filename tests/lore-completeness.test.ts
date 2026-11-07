import { describe, expect, it } from 'vitest';
import { CORE_MEMORIES, MEMORY_FRAGMENTS } from '../src/sim/content';

describe('memory lore completeness', () => {
  it('groups every recovered fragment into a core memory', () => {
    const grouped = new Set(CORE_MEMORIES.flatMap((core) => core.fragments));
    const orphans = MEMORY_FRAGMENTS.filter((fragment) => !grouped.has(fragment.id)).map(
      (fragment) => fragment.id
    );
    expect(orphans).toEqual([]);
  });

  it('names the tide and storm memories', () => {
    const titles = CORE_MEMORIES.map((core) => core.title);
    expect(titles).toContain('The Sunken Tideways');
    expect(titles).toContain('The Howling Spire');
  });

  it('gives every core memory a distinct title', () => {
    const titles = CORE_MEMORIES.map((core) => core.title);
    expect(new Set(titles).size).toBe(titles.length);
  });
});
