import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const app = readFileSync(join(__dirname, '../src/app/App.ts'), 'utf8');
const screens = readFileSync(join(__dirname, '../src/ui/Screens.ts'), 'utf8');

function body(start: string, end: string, source = app): string {
  const from = source.indexOf(start);
  expect(from, `missing ${start}`).toBeGreaterThanOrEqual(0);
  const to = source.indexOf(end, from + start.length);
  expect(to, `missing ${end}`).toBeGreaterThan(from);
  return source.slice(from, to);
}

describe('long lists keep their place across a re-render', () => {
  it('captures the panel scroll and the focused action before rebuilding', () => {
    const capture = body('private captureListState(', 'private restoreListState(');
    expect(capture).toContain("'.screen [data-action]'");
    expect(capture).toContain('scrollTop');
    expect(capture).toContain('actions.indexOf(active)');
  });

  it('restores scroll and clamps the action index when the sold row is gone', () => {
    const restore = body('private restoreListState(', 'private showExpedition(');
    expect(restore).toContain('panel.scrollTop = state.scrollTop');
    expect(restore).toContain('Math.min(state.index, actions.length - 1)');
    expect(restore).toContain("focus({ preventScroll: true })");
  });

  it('wires the capture into the bag re-render', () => {
    const inventory = body('let status =', 'private showChoice(');
    expect(inventory).toContain('const state = this.captureListState();');
    expect(inventory).toContain('render(state);');
    expect(inventory).toContain('if (list) this.restoreListState(list);');
  });

  it('wires it into the relic market too', () => {
    const market = body('onSellRelic: (defId) => {', 'onBack: () => this.click(() => this.closeHubPanel()),');
    expect(market).toContain('const list = this.captureListState();');
    expect(market).toContain('this.restoreListState(list);');
  });

  // Replaced in the saves-and-inventory task (ADR-215): the bag filter chips were removed with the
  // list; the grid boxes now carry the stable key and the pressed state.
  it('gives the grid boxes a stable key and pressed state', () => {
    const grid = readFileSync(join(__dirname, '../src/ui/InventoryGrid.ts'), 'utf8');
    expect(grid).toContain('box.dataset.action = key');
    expect(grid).toContain("box.setAttribute('aria-pressed', key === selected ? 'true' : 'false')");
  });

  it('keys the place-screen actions too, so their rebuilds keep focus', () => {
    for (const key of ['train:', 'boon:', 'reforge:', 'aspect:']) {
      expect(screens, key).toContain(`dataset.action = \`${key}`);
    }
    expect(screens).toContain("offer.dataset.action = 'cairn:offer'");
  });

  it('prefers the nearest enabled action when the chosen one becomes disabled', () => {
    const restore = body('private restoreListState(', 'private showExpedition(');
    expect(restore).toContain('actions.slice(start + 1)');
    expect(restore).toContain('actions.slice(0, start + 1).reverse()');
    expect(restore).toContain('el.disabled');
  });

  it('rebuilds the four place screens through a capturing reopen', () => {
    for (const name of ['showReliquary', 'showAspects', 'showReforge', 'showCairn']) {
      const at = app.indexOf(`const reopen = (): void => {`);
      expect(at).toBeGreaterThanOrEqual(0);
      expect(app).toContain(`this.${name}();`);
    }
    expect(app.match(/const list = this\.captureListState\(\);/g)?.length ?? 0).toBeGreaterThanOrEqual(6);
  });

  it('gives every bag action a stable key', () => {
    expect(screens).toContain('equipBtn.dataset.action = `equip:${item.uid}`');
    expect(screens).toContain('sell.dataset.action = `sell:${item.uid}`');
    expect(screens).toContain('discard.dataset.action = `discard:${item.uid}`');
    expect(screens).toContain('sell.dataset.action = `market:${defId}`');
  });
});

describe('focus comes back to the same control, not merely the same place', () => {
  const src = readFileSync(join(__dirname, '../src/app/App.ts'), 'utf8');
  const restore = src.slice(src.indexOf('private restoreListState('), src.indexOf('private showExpedition('));
  it('remembers the focused control by its key and finds it again first', () => {
    const capture = src.slice(src.indexOf('private captureListState('), src.indexOf('private restoreListState('));
    expect(capture).toContain('key: active?.dataset.action');
    expect(restore).toContain('actions.find((el) => el.dataset.action === state.key)');
  });
  it('falls back to the picked box when the focused control is gone, as after Upgrade', () => {
    expect(restore).toContain('.screen [data-action][aria-pressed="true"]');
  });
  it('tries the remembered position itself before its neighbours', () => {
    expect(restore).toContain('actions[start],\n      ...actions.slice(start + 1)');
  });
});
