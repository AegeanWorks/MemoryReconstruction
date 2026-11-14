import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, '../src/ui/ui.css'), 'utf8');

function ruleBody(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, `missing ${selector}`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf('{', start);
  return css.slice(open + 1, css.indexOf('}', open));
}

/** The body of the media block whose opening brace follows `marker`. */
function blockAfter(marker: string): string {
  const at = css.indexOf(marker);
  expect(at, `missing ${marker}`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error(`unclosed block after ${marker}`);
}

describe('short-screen Set Out screen', () => {
  // Several max-height blocks exist; the expedition fix is the one after this comment.
  const short = blockAfter('/* Short expedition');

  it('stops the flex column from shrinking panels into strips', () => {
    expect(short).toMatch(/\.screen\.hub\.set-out > \* \{[^}]*flex-shrink: 0/s);
    expect(short).toMatch(/\.screen\.hub\.set-out \.panel \{[^}]*max-height: none/s);
    expect(short).toMatch(/\.screen\.hub\.set-out \.panel \{[^}]*overflow: visible/s);
  });

  it('keeps each checkpoint name and its Start button on one compact row', () => {
    expect(short).toMatch(
      /\.screen\.hub\.set-out \.checkpoint \{[^}]*grid-template-columns: minmax\(0, 1fr\) auto/s
    );
    expect(short).toMatch(/\.screen\.hub\.set-out \.cp-note \{[^}]*display: none/s);
    expect(short).toMatch(/\.screen\.hub\.set-out \.checkpoint-start \{[^}]*width: auto/s);
    expect(short).toMatch(/\.screen\.hub\.set-out \.checkpoint-start \{[^}]*margin-top: 0/s);
  });
});

describe('checkpoint name truncation', () => {
  it('makes the name a block so text-overflow can ellipsize it', () => {
    const name = ruleBody('.cp-name');
    expect(name).toContain('display: block');
    expect(name).toContain('text-overflow: ellipsis');
    expect(name).toContain('white-space: nowrap');
  });
});

describe('wide, short Set Out screen', () => {
  const wide = blockAfter('/* Wide, short Set Out');

  it('lays the screen out as two columns with the list and footer across both', () => {
    expect(wide).toMatch(/\.screen\.hub\.set-out \{[^}]*display: grid/s);
    expect(wide).toMatch(/\.screen\.hub\.set-out \{[^}]*grid-template-columns: 1fr 1fr/s);
    expect(wide).toMatch(
      /\.screen\.hub\.set-out > \.checkpoint-list[^{]*\{[^}]*grid-column: 1 \/ -1/s
    );
    expect(wide).toMatch(/\.screen\.hub\.set-out > \.daily-panel \{[^}]*width: 100%/s);
  });

  it('pairs the checkpoint rows instead of stacking all nine', () => {
    expect(wide).toMatch(/\.screen\.hub\.set-out \.checkpoint-list \{[^}]*grid-template-columns: 1fr 1fr/s);
    expect(wide).toMatch(/\.screen\.hub\.set-out \.checkpoint \{[^}]*grid-template-columns: minmax\(0, 1fr\)/s);
  });

  it('moves the Start button into the single column so the name gets the full width', () => {
    expect(wide).toMatch(/\.screen\.hub\.set-out \.checkpoint-start \{[^}]*grid-column: 1;/s);
  });

  it('stretches the shared row so the two daily panels match height', () => {
    expect(wide).toMatch(/\.screen\.hub\.set-out \{[^}]*align-items: stretch/s);
  });

  it('keeps the daily button on one line in the halved panel', () => {
    expect(wide).toMatch(
      /\.screen\.hub\.set-out > \.daily-panel \.btn \{[^}]*flex-shrink: 0[^}]*white-space: nowrap/s
    );
  });
});

describe('Set Out scoping', () => {
  it('tags the Set Out screen so the hub-wide screens keep their centred layout', () => {
    const screens = readFileSync(join(__dirname, '../src/ui/Screens.ts'), 'utf8');
    expect(screens).toContain("{ class: 'screen hub set-out' }");
    const short = blockAfter('/* Short expedition');
    for (const line of short.split('\n')) {
      if (!line.includes('.screen.hub')) continue;
      expect(line).toContain('.screen.hub.set-out');
    }
    const wide = blockAfter('/* Wide, short Set Out');
    for (const line of wide.split('\n')) {
      if (!line.includes('.screen.hub')) continue;
      expect(line).toContain('.screen.hub.set-out');
    }
  });
});

describe('Set Out child order', () => {
  it('puts the saved run and checkpoint list before the difficulty and daily panels', () => {
    const screens = readFileSync(join(__dirname, '../src/ui/Screens.ts'), 'utf8');
    const fn = screens.slice(screens.indexOf('export function expeditionScreen'));
    const body = fn.slice(0, fn.indexOf('\nfunction supplyRow'));
    const list = body.indexOf("class: 'panel checkpoint-list'");
    const pending = body.indexOf("class: 'panel pending-run'");
    const daily = body.indexOf("class: 'panel daily-panel'");
    expect(pending).toBeGreaterThanOrEqual(0);
    expect(list).toBeGreaterThanOrEqual(0);
    expect(daily).toBeGreaterThanOrEqual(0);
    expect(pending).toBeLessThan(list);
    expect(list).toBeLessThan(daily);
  });
});
