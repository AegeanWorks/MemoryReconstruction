import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, '../src/ui/ui.css'), 'utf8');

/** Bodies of every reduced-motion media block, joined. */
function reducedBlocks(): { all: string; lists: string[] } {
  const marker = '@media (prefers-reduced-motion: reduce)';
  const blocks: string[] = [];
  let from = 0;
  for (;;) {
    const start = css.indexOf(marker, from);
    if (start < 0) break;
    const open = css.indexOf('{', start);
    let depth = 0;
    let end = -1;
    for (let i = open; i < css.length; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    expect(end, `unclosed reduced-motion block at ${start}`).toBeGreaterThan(0);
    blocks.push(css.slice(open + 1, end));
    from = end;
  }
  expect(blocks.length, 'missing reduced-motion block').toBeGreaterThan(0);
  // Selector lists that are turned off, so a test can prove a selector is not among them.
  const lists = blocks.flatMap((body) =>
    [...body.matchAll(/([^{}@]+)\{\s*animation:\s*none;/g)].map((m) => m[1].trim())
  );
  return { all: blocks.join('\n'), lists };
}

const { all, lists } = reducedBlocks();

function disabled(selector: string): boolean {
  return lists.some((list) => list.split(',').map((s) => s.trim()).includes(selector));
}

describe('reduced-motion CSS', () => {
  it('stops the endless decorative loops', () => {
    for (const selector of [
      '.title-menu .btn.primary',
      '.card.epic .card-emblem',
      '.boss-bar.enraged .bar-fill',
      '.chip.stalked',
      '.quest-badge.ready',
      '.title',
    ]) {
      expect(disabled(selector), `${selector} still animates`).toBe(true);
    }
  });

  it('drops entrance travel and hover lift', () => {
    for (const selector of ['.card', '.stats-panel .stats > *', '.heading.dead', '.gear-row.attuned']) {
      expect(disabled(selector), `${selector} still animates`).toBe(true);
    }
    expect(all).toMatch(/\.card:hover[^{]*\{[^}]*transform: none/s);
  });

  it('keeps toasts, the lore card and the banner animating so they still vanish on time', () => {
    for (const selector of ['.toast', '.lore', '.banner']) {
      expect(disabled(selector), `${selector} was switched off entirely`).toBe(false);
    }
  });

  it('removes the vertical travel from toast and lore while keeping lore centred', () => {
    expect(all).toMatch(/@keyframes toast \{[^}]*transform: none/s);
    expect(all).not.toMatch(/@keyframes toast \{[^}]*translateY/s);
    expect(all).toMatch(/@keyframes lore \{[^}]*translate\(-50%, 0\)/s);
    expect(all).not.toMatch(/@keyframes lore \{[^}]*translate\(-50%, 10px\)/s);
  });

  it('fades the banner without the letter-spacing sweep', () => {
    expect(all).toMatch(/@keyframes banner \{[^}]*opacity: 0/s);
    expect(all).not.toMatch(/@keyframes banner \{[^}]*letter-spacing/s);
  });
});
