/**
 * In-game heads-up display. Built once; each frame writes only the values
 * that changed, so the DOM stays cheap to update.
 */
import { biomeInfo, MEMORY_FRAGMENTS } from '../sim/content';
import type { SimEvent } from '../sim/events';
import { xpForLevel } from '../sim/run';
import type { World } from '../sim/world';
import { assetUrl, h } from './dom';
import { drawMap } from './Minimap';

interface Bar {
  root: HTMLElement;
  fill: HTMLElement;
  lag?: HTMLElement;
  text?: HTMLElement;
}

function bar(kind: string, withText: boolean, withLag = false): Bar {
  const fill = h('div', { class: 'bar-fill' });
  const lag = withLag ? h('div', { class: 'bar-lag' }) : undefined;
  const text = withText ? h('div', { class: 'bar-text' }) : undefined;
  const root = h('div', { class: `bar ${kind}` }, lag, fill, text);
  return { root, fill, lag, text };
}

export class Hud {
  readonly root = h('div', { class: 'hud hidden' });
  private readonly level = h('span');
  private readonly levelNote = h('small');
  private readonly hp = bar('hp', true, true);
  private readonly mana = bar('mana', true);
  private readonly xp = bar('thin xp', false);
  private readonly pips = h('div', { class: 'pips' });
  private readonly potions = h('span');
  private readonly floorName = h('div', { class: 'hud-floor' });
  private readonly bossName = h('div', { class: 'boss-name' });
  private readonly boss = bar('boss', false, true);
  private readonly bossBar = h('div', { class: 'boss-bar hidden' }, this.bossName, this.boss.root);
  private readonly minimap = h('canvas', { class: 'minimap', width: '190', height: '140' });
  private readonly shards = h('span');
  private readonly prompt = h('div', { class: 'prompt hidden' });
  private readonly toasts = h('div', { class: 'toasts' });
  private readonly hint = h(
    'div',
    { class: 'hint' },
    h(
      'div',
      {},
      h('span', { class: 'key' }, 'WASD'),
      ' move  ',
      h('span', { class: 'key' }, 'LMB'),
      ' strike  ',
      h('span', { class: 'key' }, 'RMB'),
      ' bolt'
    ),
    h(
      'div',
      {},
      h('span', { class: 'key' }, 'Space'),
      ' dash  ',
      h('span', { class: 'key' }, 'Q'),
      ' potion  ',
      h('span', { class: 'key' }, 'E'),
      ' interact  ',
      h('span', { class: 'key' }, 'Tab'),
      ' map'
    )
  );
  private readonly written = new Map<HTMLElement | CSSStyleDeclaration, string>();
  private time = 0;
  private mapTimer = 0;

  constructor() {
    const shardIcon = h('img', { src: assetUrl('sprites/ui/fragment_shard.png'), alt: '' });
    const potionIcon = h('img', { src: assetUrl('sprites/ui/health.png'), alt: '' });
    const vitals = h(
      'div',
      { class: 'hud-vitals' },
      h('div', { class: 'hud-level' }, this.level, this.levelNote),
      this.hp.root,
      this.mana.root,
      this.xp.root,
      h(
        'div',
        { class: 'hud-row' },
        h('span', { class: 'chip' }, 'Dash', this.pips),
        h('span', { class: 'chip' }, potionIcon, this.potions, h('span', { class: 'key' }, 'Q'))
      )
    );
    const map = h(
      'div',
      { class: 'hud-map' },
      this.minimap,
      h('div', { class: 'hud-shards chip' }, shardIcon, this.shards)
    );
    this.root.append(
      vitals,
      this.floorName,
      this.bossBar,
      map,
      this.prompt,
      this.toasts,
      this.hint
    );
  }

  setVisible(visible: boolean): void {
    this.root.classList.toggle('hidden', !visible);
  }

  /** Hides the controls hint after the first floor. */
  setHintVisible(visible: boolean): void {
    this.hint.classList.toggle('hidden', !visible);
  }

  private setText(el: HTMLElement, value: string): void {
    if (this.written.get(el) === value) return;
    this.written.set(el, value);
    el.textContent = value;
  }

  private setWidth(el: HTMLElement, fraction: number): void {
    const value = `${Math.max(0, Math.min(1, fraction)) * 100}%`;
    if (this.written.get(el.style) === value) return;
    this.written.set(el.style, value);
    el.style.width = value;
  }

  toast(text: string, warn = false): void {
    const el = h('div', { class: warn ? 'toast warn' : 'toast' }, text);
    this.toasts.append(el);
    window.setTimeout(() => el.remove(), 2500);
    while (this.toasts.children.length > 3) this.toasts.firstElementChild?.remove();
  }

  /** Floating lore card for a recovered memory fragment. */
  showFragment(fragmentId: string): void {
    const fragment = MEMORY_FRAGMENTS.find((f) => f.id === fragmentId);
    if (!fragment) return;
    const el = h(
      'div',
      { class: 'lore' },
      h('h4', {}, 'Memory recovered'),
      h('p', {}, `"${fragment.text}"`)
    );
    this.root.append(el);
    window.setTimeout(() => el.remove(), 7000);
  }

  handle(events: readonly SimEvent[], world: World): void {
    for (const e of events) {
      if (e.type === 'roomLocked' && world.floor.rooms[e.roomId].kind !== 'boss')
        this.toast('The doors seal shut', true);
      if (e.type === 'roomCleared')
        this.toast(
          world.floor.rooms[e.roomId].kind === 'boss' ? 'The guardian falls' : 'Room cleared'
        );
      if (e.type === 'bossIntro') this.toast(e.name, true);
      if (e.type === 'bossPhase')
        this.toast(e.phase === 2 ? 'It grows desperate' : 'It grows angry', true);
      if (e.type === 'notice') this.toast(e.text, true);
      if (e.type === 'fragmentFound') this.showFragment(e.fragmentId);
      if (e.type === 'levelUp') this.toast(`Level ${e.level}`);
    }
  }

  update(world: World, dt: number): void {
    this.time += dt;
    const p = world.player;
    const s = p.stats;
    this.setText(this.level, `Level ${p.level}`);
    this.setText(this.levelNote, `${world.run.fragmentsFound.length} memories this run`);
    this.setWidth(this.hp.fill, p.health / s.maxHealth);
    if (this.hp.lag) this.setWidth(this.hp.lag, p.health / s.maxHealth);
    this.setText(this.hp.text!, `${Math.ceil(p.health)} / ${s.maxHealth}`);
    this.setWidth(this.mana.fill, p.mana / s.maxMana);
    this.setText(this.mana.text!, `${Math.floor(p.mana)} / ${s.maxMana}`);
    this.setWidth(this.xp.fill, p.xp / xpForLevel(p.level));
    this.setText(this.potions, `${p.potions}/${s.maxPotions}`);
    this.setText(this.shards, `${p.shards}`);
    this.updatePips(p.dashCharges, s.dashCharges);

    const biome = biomeInfo(world.plan.biome);
    this.setText(this.floorName, `Depth ${world.run.depth + 1} · ${biome.name}`);

    const boss = world.activeBoss();
    this.bossBar.classList.toggle('hidden', !boss || boss.state === 'spawning');
    if (boss) {
      this.setText(this.bossName, boss.def.name);
      this.setWidth(this.boss.fill, boss.health / boss.maxHealth);
      if (this.boss.lag) this.setWidth(this.boss.lag, boss.health / boss.maxHealth);
    }

    const near = world.nearbyInteractable();
    this.prompt.classList.toggle('hidden', !near);
    if (near) {
      const label =
        near.kind === 'portal'
          ? 'Step through the rift'
          : near.kind === 'chest'
            ? 'Open the memory chest'
            : `Offer ${near.cost} shards to the Memory Well (heal + upgrade)`;
      this.setText(this.prompt, `[E]  ${label}`);
    }

    this.mapTimer -= dt;
    if (this.mapTimer <= 0) {
      this.mapTimer = 0.1;
      drawMap(this.minimap, world, this.time);
    }
  }

  private updatePips(charges: number, max: number): void {
    if (this.pips.children.length !== max) {
      this.pips.replaceChildren(
        ...Array.from({ length: max }, () => h('div', { class: 'pip' }, h('span')))
      );
    }
    Array.from(this.pips.children).forEach((pip, i) => {
      const fill = Math.max(0, Math.min(1, charges - i));
      const span = pip.firstElementChild as HTMLElement;
      this.setWidth(span, 1);
      const height = `${fill * 100}%`;
      if (span.style.height !== height) span.style.height = height;
    });
  }
}
