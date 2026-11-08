import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CORE_MEMORIES, MEMORY_FRAGMENTS, completedCoreFor } from '../src/sim/content';

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

  it('reports the core completed by its last fragment and preserves its reward', () => {
    const core = CORE_MEMORIES.find((candidate) => candidate.id === 'core_memory_007')!;
    const last = core.fragments[core.fragments.length - 1];
    const owned = new Set(core.fragments.slice(0, -1));
    expect(completedCoreFor(last, owned)).toBeUndefined();
    owned.add(last);
    expect(completedCoreFor(last, owned)?.id).toBe('core_memory_007');
    expect(core.reward).toBe('unlock_forge');
  });

  it('keeps the assets lore mirror in sync with the runtime copy', () => {
    const read = (path: string): unknown => JSON.parse(readFileSync(join(__dirname, path), 'utf8'));
    expect(read('../assets/data/lore.json')).toEqual(read('../src/data/lore.json'));
  });
});
