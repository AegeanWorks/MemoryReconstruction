/**
 * Full-screen menus. Each builder returns an element; `Screens` shows one at
 * a time on top of the HUD.
 */
import { CORE_MEMORIES, FLOOR_PLANS, MEMORY_FRAGMENTS, biomeInfo } from '../sim/content';
import type { RunState, UpgradeChoice } from '../sim/run';
import { upgradeDef } from '../sim/upgrades';
import type { World } from '../sim/world';
import type { Meta, Settings } from '../save/SaveStore';
import { button, h } from './dom';
import { drawMap } from './Minimap';

export class Screens {
  private current: HTMLElement | undefined;
  private keyHandler: ((e: KeyboardEvent) => void) | undefined;

  constructor(private readonly host: HTMLElement) {}

  get open(): boolean {
    return this.current !== undefined;
  }

  show(el: HTMLElement, onKey?: (e: KeyboardEvent) => void): void {
    this.close();
    this.current = el;
    this.host.append(el);
    if (onKey) {
      this.keyHandler = onKey;
      window.addEventListener('keydown', onKey);
    }
    // Focus the first control so keyboard and gamepad-as-keyboard users can act at once.
    el.querySelector<HTMLElement>('button, .card')?.focus({ preventScroll: true });
  }

  close(): void {
    this.current?.remove();
    this.current = undefined;
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
    this.keyHandler = undefined;
  }
}

function minutes(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function titleScreen(opts: {
  meta: Meta;
  canContinue: boolean;
  onNew: () => void;
  onContinue: () => void;
  onMemories: () => void;
  onSettings: () => void;
  onControls: () => void;
}): HTMLElement {
  const { meta } = opts;
  const recovered = meta.fragments.length;
  const continueBtn = button('Continue', opts.onContinue);
  if (!opts.canContinue) continueBtn.disabled = true;
  return h(
    'div',
    { class: 'screen clear' },
    h('div', { class: 'subtitle' }, 'An action roguelike'),
    h('div', { class: 'title' }, 'Memory Reconstruction'),
    h('div', { class: 'subtitle' }, 'Walk the shattered world. Remember it whole.'),
    h(
      'div',
      { class: 'menu' },
      button(opts.canContinue ? 'New Run' : 'Begin', opts.onNew, 'btn primary'),
      continueBtn,
      button(`Memories  ${recovered}/${MEMORY_FRAGMENTS.length}`, opts.onMemories),
      button('Settings', opts.onSettings),
      button('Controls', opts.onControls)
    ),
    meta.runs > 0
      ? h(
          'div',
          { class: 'meta-line' },
          'Runs ',
          h('b', {}, `${meta.runs}`),
          '  ·  Deepest ',
          h('b', {}, `${meta.bestDepth}/${FLOOR_PLANS.length}`),
          '  ·  Victories ',
          h('b', {}, `${meta.victories}`)
        )
      : null
  );
}

export function pauseScreen(opts: {
  onResume: () => void;
  onSettings: () => void;
  onControls: () => void;
  onAbandon: () => void;
}): HTMLElement {
  return h(
    'div',
    { class: 'screen' },
    h('div', { class: 'heading' }, 'Paused'),
    h(
      'div',
      { class: 'menu' },
      button('Resume', opts.onResume, 'btn primary'),
      button('Settings', opts.onSettings),
      button('Controls', opts.onControls),
      button('Abandon Run', opts.onAbandon)
    )
  );
}

const SOURCE_TITLES: Record<UpgradeChoice['source'], string> = {
  level: 'Choose an Echo',
  chest: 'The Chest Remembers',
  shrine: 'The Well Answers',
};

export function choiceScreen(
  choice: UpgradeChoice,
  taken: Record<string, number>,
  onPick: (id: string) => void
): { el: HTMLElement; onKey: (e: KeyboardEvent) => void } {
  const cards = choice.options.map((id, i) => {
    const def = upgradeDef(id);
    const count = taken[id] ?? 0;
    const card = h(
      'button',
      { class: `card ${def.rarity}`, type: 'button' },
      h('div', { class: 'num' }, `${i + 1}`),
      h('div', { class: 'rarity' }, def.rarity),
      h('div', { class: 'name' }, def.name),
      h('div', { class: 'desc' }, def.description),
      h(
        'div',
        { class: 'stacks' },
        def.maxStacks > 1 ? `${count} / ${def.maxStacks}` : count > 0 ? 'Owned' : 'Unique'
      )
    );
    card.addEventListener('click', () => onPick(id));
    return card;
  });
  const el = h(
    'div',
    { class: 'screen' },
    h('div', { class: 'heading' }, SOURCE_TITLES[choice.source]),
    h('div', { class: 'cards' }, ...cards),
    h('div', { class: 'meta-line' }, 'Click a card, or press 1 / 2 / 3')
  );
  const onKey = (e: KeyboardEvent): void => {
    const index = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
    if (index >= 0 && choice.options[index]) onPick(choice.options[index]);
    if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
      const focused = cards.indexOf(document.activeElement as HTMLButtonElement);
      const next = (focused + (e.code === 'ArrowRight' ? 1 : cards.length - 1)) % cards.length;
      cards[next]?.focus();
    }
  };
  if (choice.options.length === 0) el.append(button('Continue', () => onPick('')));
  return { el, onKey };
}

function runStats(run: RunState): HTMLElement {
  const rows: Array<[string, string]> = [
    [
      'Depth reached',
      `${run.depth + 1} · ${biomeInfo(FLOOR_PLANS[Math.min(run.depth, FLOOR_PLANS.length - 1)].biome).name}`,
    ],
    ['Level', `${run.player.level}`],
    ['Enemies defeated', `${run.stats.kills}`],
    ['Rooms cleared', `${run.stats.roomsCleared}`],
    ['Memories recovered', `${run.fragmentsFound.length}`],
    ['Time', minutes(run.stats.elapsed)],
  ];
  return h('dl', { class: 'stats' }, ...rows.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]));
}

export function deathScreen(run: RunState, onRetry: () => void, onTitle: () => void): HTMLElement {
  return h(
    'div',
    { class: 'screen' },
    h('div', { class: 'heading dead' }, 'You Were Forgotten'),
    h(
      'div',
      { class: 'subtitle' },
      run.fragmentsFound.length > 0
        ? 'But what you recovered stays with you.'
        : 'The world fades. Try again.'
    ),
    runStats(run),
    h(
      'div',
      { class: 'menu' },
      button('Walk Again', onRetry, 'btn primary'),
      button('Title', onTitle)
    )
  );
}

export function victoryScreen(run: RunState, onTitle: () => void): HTMLElement {
  return h(
    'div',
    { class: 'screen' },
    h('div', { class: 'title' }, 'The World Remembers'),
    h('div', { class: 'subtitle' }, 'The Keeper is still. The Sanctuary is whole again.'),
    runStats(run),
    h('div', { class: 'menu' }, button('Return to Title', onTitle, 'btn primary'))
  );
}

export function memoriesScreen(owned: readonly string[], onBack: () => void): HTMLElement {
  const have = new Set(owned);
  const cores = CORE_MEMORIES.map((core) => {
    const found = core.fragments.filter((f) => have.has(f));
    const complete = found.length === core.fragments.length;
    const fragments = core.fragments.map((id) => {
      const fragment = MEMORY_FRAGMENTS.find((f) => f.id === id);
      return h('div', { class: 'frag' }, have.has(id) && fragment ? `"${fragment.text}"` : '· · ·');
    });
    return h(
      'div',
      { class: 'memory' },
      h(
        'h5',
        { class: complete ? '' : 'locked' },
        complete ? core.title : `${core.title}  (${found.length}/${core.fragments.length})`
      ),
      complete ? h('p', {}, core.text) : null,
      ...fragments
    );
  });
  return h(
    'div',
    { class: 'screen' },
    h('div', { class: 'heading' }, 'Recovered Memories'),
    h(
      'div',
      { class: 'meta-line' },
      'Fragments are kept between runs. Gather a memory’s fragments to restore it.'
    ),
    h('div', { class: 'panel' }, ...cores),
    h('div', { class: 'menu' }, button('Back', onBack))
  );
}

export function settingsScreen(
  settings: Settings,
  onChange: (s: Settings) => void,
  onBack: () => void
): HTMLElement {
  const current = { ...settings };
  const slider = (
    label: string,
    key: 'masterVolume' | 'musicVolume' | 'sfxVolume'
  ): HTMLElement => {
    const value = h('span', {}, `${Math.round(current[key] * 100)}`);
    const input = h('input', {
      type: 'range',
      min: '0',
      max: '100',
      value: `${Math.round(current[key] * 100)}`,
    });
    input.addEventListener('input', () => {
      current[key] = Number(input.value) / 100;
      value.textContent = input.value;
      onChange({ ...current });
    });
    return h('label', { class: 'setting' }, label, input, value);
  };
  const shake = h('input', { type: 'checkbox' });
  shake.checked = current.screenShake;
  shake.addEventListener('change', () => {
    current.screenShake = shake.checked;
    onChange({ ...current });
  });
  return h(
    'div',
    { class: 'screen' },
    h('div', { class: 'heading' }, 'Settings'),
    h(
      'div',
      { class: 'panel' },
      slider('Master volume', 'masterVolume'),
      slider('Music', 'musicVolume'),
      slider('Effects', 'sfxVolume'),
      h('label', { class: 'setting' }, 'Screen shake', shake, h('span'))
    ),
    h('div', { class: 'menu' }, button('Back', onBack))
  );
}

export function controlsScreen(onBack: () => void): HTMLElement {
  const rows: Array<[string, string]> = [
    ['WASD / Arrows', 'Move (left stick)'],
    ['Mouse', 'Aim (right stick)'],
    ['Left click / J', 'Strike: hold for a three-hit combo (RT)'],
    ['Right click / K', 'Memory bolt, costs mana (LT)'],
    ['Space / Shift', 'Dash through attacks; brief invulnerability (A)'],
    ['Q', 'Drink a potion (X)'],
    ['E / F', 'Open chests, use wells (Y)'],
    ['Tab / M', 'Map (Back)'],
    ['Esc / P', 'Pause (Start)'],
  ];
  return h(
    'div',
    { class: 'screen' },
    h('div', { class: 'heading' }, 'Controls'),
    h(
      'div',
      { class: 'panel' },
      h(
        'div',
        { class: 'controls' },
        ...rows.flatMap(([k, v]) => [h('span', { class: 'key' }, k), h('span', {}, v)])
      )
    ),
    h(
      'div',
      { class: 'meta-line' },
      'Red shapes on the ground warn of an attack. Dash out of them, then strike back.'
    ),
    h('div', { class: 'menu' }, button('Back', onBack))
  );
}

export function mapScreen(world: World, onClose: () => void): HTMLElement {
  const canvas = h('canvas', { class: 'big-map', width: '640', height: '480' });
  drawMap(canvas, world, 0);
  return h(
    'div',
    { class: 'screen' },
    h(
      'div',
      { class: 'heading' },
      `Depth ${world.run.depth + 1} · ${biomeInfo(world.plan.biome).name}`
    ),
    canvas,
    h('div', { class: 'meta-line' }, 'Gold: treasure  ·  Cyan: memory well  ·  Red: guardian'),
    h('div', { class: 'menu' }, button('Close', onClose))
  );
}

export function floorBanner(depth: number, name: string): HTMLElement {
  const el = h(
    'div',
    { class: 'banner' },
    h('div', { class: 'depth' }, `DEPTH ${depth + 1}`),
    h('div', { class: 'name' }, name)
  );
  window.setTimeout(() => el.remove(), 3300);
  return el;
}

export function errorScreen(why: string, fix: string): HTMLElement {
  return h(
    'div',
    { class: 'screen' },
    h('div', { class: 'heading dead' }, 'Something went wrong'),
    h(
      'div',
      { class: 'panel error' },
      h('p', {}, h('b', {}, 'Why: '), why),
      h('p', {}, h('b', {}, 'Fix: '), fix)
    )
  );
}
