import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CORE_MEMORIES, FLOOR_PLANS, MEMORY_FRAGMENTS } from '../src/sim/content';
import { REFORGE_MAX, REFORGE_STEP } from '../src/sim/equipment';
import { CAIRN_MAX, CAIRN_SHARDS, checkpointDepths } from '../src/sim/hub';
import { SANCTUARY_STATIONS } from '../src/sim/sanctuary';
import { UPGRADES } from '../src/sim/upgrades';

const root = join(__dirname, '..');
const readme = readFileSync(join(root, 'README.md'), 'utf8');
const main = readFileSync(join(root, 'src/main.ts'), 'utf8');
const agentGuide = readFileSync(join(root, 'docs/AI_AGENT_GUIDE.md'), 'utf8');

const json = (path: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(root, path), 'utf8').replace(/^\uFEFF/, '')) as Record<string, unknown>;

const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen',
  'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** Spell 0-999 the way the README does ("twenty-three", "one hundred and two"). */
function words(n: number): string {
  expect(n, 'only 0-999 are spelled in the README').toBeGreaterThanOrEqual(0);
  expect(n).toBeLessThan(1000);
  if (n < 100) return underHundred(n);
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  return rest === 0
    ? `${ONES[hundreds]} hundred`
    : `${ONES[hundreds]} hundred and ${underHundred(rest)}`;
}

function underHundred(n: number): string {
  if (n < 20) return ONES[n];
  const tens = TENS[Math.floor(n / 10)];
  return n % 10 === 0 ? tens : `${tens}-${ONES[n % 10]}`;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function oxford(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

const biomes = (json('src/data/biomes.json').biomes as unknown[]).length;
const enemies = (json('src/data/enemies.json').enemies as unknown[]).length;
const bosses = new Set(FLOOR_PLANS.map((plan) => plan.boss).filter(Boolean)).size;
const trials = FLOOR_PLANS.filter((plan) => plan.trialName?.startsWith('Echo Trial')).length;
const checkpoints = checkpointDepths().map((depth) => depth + 1);

describe('README counts match the data', () => {
  it('spells the numbers the way the README does', () => {
    expect(capitalise(words(23))).toBe('Twenty-three');
    expect(capitalise(words(16))).toBe('Sixteen');
    expect(words(91)).toBe('ninety-one');
    expect(words(8)).toBe('eight');
    expect(words(35)).toBe('thirty-five');
  });

  it('states the section and trial counts from the floor plans', () => {
    expect(readme).toContain(`**${capitalise(words(FLOOR_PLANS.length))} sections`);
    expect(readme).toContain(`${words(trials)} echo trials and checkpoints`);
    expect(readme).toContain(`${words(trials)} boss-only **Echo Trial** episodes`);
  });

  it('lists exactly the checkpoints the code unlocks', () => {
    expect(checkpoints).toHaveLength(9);
    expect(readme).toContain(
      `Sections ${oxford(checkpoints.map((n) => String(n)))} unlock as start points`
    );
  });

  it('states the biome, enemy, boss and guardian counts from the JSON and plans', () => {
    expect(readme).toContain(
      `${capitalise(words(biomes))} biomes, ${words(enemies)} enemies, ${words(bosses)} bosses, ` +
        `including ${words(trials)} unique Trial guardians`
    );
  });

  it('states the upgrade, fragment and core-memory counts', () => {
    expect(readme).toContain(`**${UPGRADES.length} upgrades**`);
    expect(readme).toContain(
      `${capitalise(words(MEMORY_FRAGMENTS.length))} memory fragments and ` +
        `${words(CORE_MEMORIES.length)} core memories`
    );
  });

  it('states the sanctuary place cap and the Cairn and Reforge numbers', () => {
    expect(readme).toContain(`capped at exactly ${words(SANCTUARY_STATIONS.length)} places`);
    expect(readme).toContain(
      `banks up to ${words(CAIRN_MAX)} echo offerings, each carrying ${CAIRN_SHARDS} starting shards`
    );
    expect(readme).toContain(
      `up to ${words(REFORGE_MAX)} ranks for +${Math.round(REFORGE_STEP * 100)}% per rank`
    );
  });
});

describe('documented debug handle exists', () => {
  it('main.ts publishes window.__MR__ and the agent guide still points at it', () => {
    expect(main).toContain('window.__MR__ = app');
    expect(agentGuide).toContain('window.__MR__');
    expect(readme).toContain('window.__MR__');
  });
});
