/**
 * Full-screen menus. Each builder returns an element; `Screens` shows one at
 * a time on top of the HUD.
 */
import { CORE_MEMORIES, FLOOR_PLANS, MEMORY_FRAGMENTS, biomeInfo } from '../sim/content';
import { FEATS, featProgress, type FeatDef } from '../sim/feats';
import {
  INVENTORY_SLOTS,
  activeSets,
  applyEquipment,
  equipmentDef,
  equipmentScore,
  relicSellShards,
  setForRelic,
  wornSetCount,
  type EquipmentItem,
  type EquipmentRarity,
  type EquipmentSlot,
  type EquipmentSlots,
} from '../sim/equipment';
import {
  NPCS,
  QUESTS,
  nextQuestForNpc,
  questBoardEntries,
  questBonus,
  questChapterLabel,
  questProgress,
  questRawProgress,
  relicRequestStatus,
  requestForNpc,
  type DailyBounty,
  type QuestDef,
  type QuestSnapshot,
} from '../sim/quests';
import {
  ASPECTS,
  CAIRN_COST,
  CAIRN_MAX,
  CAIRN_SHARDS,
  REFORGE_RANKS,
  RESTORATIONS,
  TOTAL_RESTORATION_LEVELS,
  cairnCost,
  cairnOfferings,
  checkpointDepths,
  nextRestorationCost,
  reforgeCost,
  relicRank,
  relicSellEchoes,
  restorationLevel,
  restoredLevels,
  sectionNumber,
  type AspectId,
  type SanctuaryProgress,
} from '../sim/hub';
import { bankSummary, resonanceMultiplier, type RunState, type UpgradeChoice } from '../sim/run';
import { choiceArmed, deliberateClick } from './choiceGuard';
import { SANCTUARY_BUILDINGS, SANCTUARY_STATIONS } from '../sim/sanctuary';
import { computeStats, upgradeDef, type PlayerStats } from '../sim/upgrades';
import { WEAPONS, weaponDef } from '../sim/weapons';
import type { ShopItem, ShopItemId, World } from '../sim/world';
import { dailyModifier, type Meta, type Settings } from '../save/SaveStore';
import { assetUrl, button, h, relicIconUrl } from './dom';
import { drawMap } from './Minimap';
import { inventoryGrid, markSelected } from './InventoryGrid';
import { reliquaryCaption } from './reliquary';

/** How long a destructive button stays armed before it resets. */
const CONFIRM_WINDOW_MS = 2600;

/**
 * A destructive action that arms on the first press and fires on the second, so one stray click
 * cannot sell a relic or end a run. It disarms itself after a short window, and if the screen is
 * closed before then the timer simply finds a detached element.
 */
export function confirmButton(
  label: string,
  confirmLabel: string,
  onConfirm: () => void,
  cls = 'btn'
): HTMLElement {
  let armed = false;
  const el = button(
    label,
    () => {
      if (!armed) {
        armed = true;
        el.textContent = confirmLabel;
        el.classList.add('danger');
        window.setTimeout(() => {
          if (!el.isConnected) return;
          armed = false;
          el.textContent = label;
          el.classList.remove('danger');
        }, CONFIRM_WINDOW_MS);
        return;
      }
      onConfirm();
    },
    cls
  );
  return el;
}

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
    this.announce(el);
    this.host.append(el);
    if (onKey) {
      this.keyHandler = onKey;
      window.addEventListener('keydown', onKey);
    }
    // Focus the first control so keyboard and gamepad-as-keyboard users can act at once. Inputs count:
    // Settings opens on the volume sliders, and Tab then runs through them in DOM order instead of
    // starting at the difficulty buttons and leaving the sliders behind.
    el.querySelector<HTMLElement>('button, .card, input')?.focus({ preventScroll: true });
  }

  /** Every screen replaces the canvas, so expose it as one named modal dialog. */
  private announce(el: HTMLElement): void {
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    const label =
      [el.querySelector('.heading'), el.querySelector('.title')]
        .map((node) => node?.textContent?.trim())
        .find((text): text is string => !!text) ?? 'Memory Reconstruction';
    el.setAttribute('aria-label', label);
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
  onSaves: () => void;
  /** The save slot in play, shown on the Saves button. */
  slot: number;
  onSettings: () => void;
  onControls: () => void;
  onPrologue: () => void;
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
      { class: 'title-menu' },
      h(
        'div',
        { class: 'menu' },
        button('Enter the Sanctuary', opts.onNew, 'btn primary'),
        continueBtn,
        button(`Memories  ${recovered}/${MEMORY_FRAGMENTS.length}`, opts.onMemories),
        button('Prologue', opts.onPrologue),
        button(`Saves · Slot ${opts.slot}`, opts.onSaves),
        button('Settings', opts.onSettings),
        button('Controls', opts.onControls)
      )
    ),
    !opts.canContinue
      ? h('div', { class: 'meta-line' }, 'No expedition in progress. Enter the Sanctuary to begin.')
      : null,
    meta.runs > 0
      ? h(
          'div',
          { class: 'meta-line' },
          'Runs ',
          h('b', {}, `${meta.runs}`),
          '  ·  Deepest section ',
          h('b', {}, `${Math.min(meta.bestDepth, FLOOR_PLANS.length)}/${FLOOR_PLANS.length}`),
          '  ·  Victories ',
          h('b', {}, `${meta.victories}`)
        )
      : null
  );
}

function hubProgress(meta: Meta): SanctuaryProgress {
  return { echoes: meta.echoes, restorations: meta.restorations, checkpoint: meta.checkpoint };
}

/**
 * The opening story, told by the Keeper before the first descent. Walkers
 * learn why the world broke, what they carry back, and how to survive the
 * first rooms — then begin with the controls fresh in mind.
 */
export function prologueScreen(onBegin: () => void, onBack: () => void): HTMLElement {
  const beats: Array<[string, string]> = [
    [
      'The Breaking',
      'The world did not end in fire. It ended in forgetting. One by one the names went out of the index — ' +
        'a street, a harbour, a mountain order — until whole sections of the world simply stopped being remembered, and stopped being.',
    ],
    [
      'The Keeper',
      '“I keep what the world drops,” the Keeper says, pressing a lantern into your hands. “Walk down. Find what was lost. ' +
        'Bring me names, and I will write them back into the index. Bring me echoes, and the Sanctuary grows.”',
    ],
    [
      'The Walker',
      'You are a memory walker: the only kind of soul that can enter a forgotten section and come back. Strike with your blade, ' +
        'spend mana on bolts, dash through what would kill you, and drink from the flask when the red closes in.',
    ],
    [
      'The Road',
      'Rooms wake when you step deep inside — doors seal, waves come, crystals shatter for shards. Clear every hostile room, ' +
        'open the chest, and take the gate down. Die, and the run ends — but the Sanctuary, and everything you rebuilt, remains.',
    ],
  ];
  return h(
    'div',
    { class: 'screen' },
    h('div', { class: 'heading' }, 'Prologue'),
    h(
      'div',
      { class: 'subtitle' },
      'What the Keeper tells every walker, before the first descent.'
    ),
    h(
      'div',
      { class: 'panel' },
      ...beats.map(([title, text]) =>
        h('div', { class: 'memory' }, h('h5', {}, title), h('p', {}, text))
      ),
      h(
        'div',
        { class: 'gear-note' },
        'Move WASD · Strike LMB · Bolt RMB · Dash Space · Flask Q · Interact E · Relics I · Map Tab · Pause Esc'
      )
    ),
    h(
      'div',
      { class: 'menu' },
      button('Begin the descent', onBegin, 'btn primary'),
      button('Back', onBack)
    )
  );
}

/** The rest place between expeditions: rebuild it with echoes, then set out. */
export function hubScreen(opts: {
  meta: Meta;
  canContinue: boolean;
  saved?: { depth: number; health: number; maxHealth: number };
  restCost: number;
  onRest: () => void;
  onExpedition: () => void;
  onContinue: () => void;
  onRebuild: (id: string) => void;
  onMemories: () => void;
  onSettings: () => void;
  onControls: () => void;
  onBack?: () => void;
}): HTMLElement {
  const { meta } = opts;
  const progress = hubProgress(meta);
  const restored = restoredLevels(progress);
  const rows = RESTORATIONS.map((def) => {
    const level = restorationLevel(progress, def.id);
    const cost = nextRestorationCost(progress, def.id);
    const canBuy = cost !== undefined && meta.echoes >= cost;
    const rebuild = button(
      cost === undefined ? 'Fully restored' : `Restore · ${cost} echoes`,
      () => opts.onRebuild(def.id),
      'btn rebuild'
    );
    rebuild.disabled = !canBuy;
    return h(
      'div',
      { class: `restoration${level > 0 ? ' lit' : ''}` },
      h(
        'div',
        { class: 'rest-head' },
        h('span', { class: 'rest-name' }, def.name),
        h('span', { class: 'rest-level' }, `${level}/${def.maxLevel}`)
      ),
      h('p', { class: 'rest-desc' }, def.description),
      h('p', { class: 'rest-lore' }, def.lore),
      rebuild
    );
  });
  const continueBtn = button('Continue Expedition', opts.onContinue);
  continueBtn.disabled = !opts.canContinue;
  const saved = opts.saved;
  const restBtn =
    saved && opts.canContinue
      ? button(`Rest · ${opts.restCost} echoes`, opts.onRest, 'btn rest')
      : null;
  if (restBtn)
    restBtn.disabled =
      !saved || opts.meta.echoes < opts.restCost || saved.health >= saved.maxHealth;
  return h(
    'div',
    { class: 'screen clear hub' },
    h('div', { class: 'subtitle' }, 'Between Expeditions'),
    h('div', { class: 'title small' }, 'The Sanctuary'),
    h('div', { class: 'subtitle' }, 'Rest here. What you carry back rebuilds this place.'),
    h(
      'div',
      { class: 'hub-ledger' },
      h('span', {}, 'Echoes ', h('b', {}, `${meta.echoes}`)),
      h('span', {}, 'Restored ', h('b', {}, `${restored}/${TOTAL_RESTORATION_LEVELS}`)),
      h('span', {}, 'Memories ', h('b', {}, `${meta.fragments.length}/${MEMORY_FRAGMENTS.length}`)),
      h('span', {}, 'Checkpoint ', h('b', {}, `Section ${sectionNumber(meta.checkpoint)}`))
    ),
    h(
      'div',
      { class: 'rest-progress' },
      h('div', {
        class: 'rest-progress-fill',
        style: `width:${(restored / TOTAL_RESTORATION_LEVELS) * 100}%`,
      })
    ),
    h('div', { class: 'hub-grid' }, ...rows),
    saved && opts.canContinue
      ? h(
          'div',
          { class: 'hub-saved' },
          `Expedition waiting · Section ${saved.depth + 1} · ${Math.round(saved.health)}/${Math.round(saved.maxHealth)} HP`
        )
      : null,
    h(
      'div',
      { class: 'menu' },
      button('Set Out', opts.onExpedition, 'btn primary'),
      continueBtn,
      restBtn,
      button(`Memories  ${meta.fragments.length}/${MEMORY_FRAGMENTS.length}`, opts.onMemories),
      button('Settings', opts.onSettings),
      button('Controls', opts.onControls),
      opts.onBack ? button('Back to the Sanctuary', opts.onBack) : null
    )
  );
}

/** The hub: a clean front door to the residents, stations and the gate. */
export function sanctuaryScreen(opts: {
  meta: Meta;
  canContinue: boolean;
  saved?: { depth: number; health: number; maxHealth: number };
  restCost: number;
  onEnter: (buildingId: string) => void;
  onRestoration: () => void;
  onTraining: () => void;
  onMeditation: () => void;
  onQuests: () => void;
  onReliquary: () => void;
  onCairn: () => void;
  onAspect: () => void;
  onReforge: () => void;
  onExpedition: () => void;
  onContinue: () => void;
  onRest: () => void;
  onMemories: () => void;
  onSettings: () => void;
  onControls: () => void;
  onTitle: () => void;
  onReplay: (seed: number) => void;
}): HTMLElement {
  const { meta } = opts;
  const progress = hubProgress(meta);
  const restored = restoredLevels(progress);

  const snapshot: QuestSnapshot = {
    fragments: meta.fragments.length,
    kills: meta.kills,
    restored: restoredLevels(hubProgress(meta)),
    depth: meta.bestDepth,
    bosses: meta.bossKills,
    elites: meta.eliteKills,
    relics: new Set(meta.vault).size,
    trust: Object.values(meta.trust).reduce(
      (sum, hearts) => sum + Math.max(0, Math.min(3, hearts)),
      0
    ),
  };
  const cards = SANCTUARY_BUILDINGS.map((building) => {
    const npc = NPCS[building.id];
    const quest = nextQuestForNpc(building.id, meta.quests.claimed);
    const accepted = !!quest && meta.quests.accepted.includes(quest.id);
    const claimed = !!quest && meta.quests.claimed.includes(quest.id);
    const progress = quest ? questProgress(quest, snapshot) : 0;
    const badge = !quest
      ? null
      : claimed
        ? h('span', { class: 'quest-badge done' }, 'Completed')
        : accepted && progress >= quest.target
          ? h('span', { class: 'quest-badge ready' }, 'Ready to claim')
          : accepted
            ? h('span', { class: 'quest-badge active' }, `${progress}/${quest.target}`)
            : h('span', { class: 'quest-badge new' }, 'New task');
    const request = requestForNpc(building.id);
    const requestState = relicRequestStatus(meta, building.id);
    const requestBadge =
      !request || requestState === 'none'
        ? null
        : requestState === 'done'
          ? h('span', { class: 'quest-badge done' }, 'Relic given')
          : requestState === 'ready'
            ? h('span', { class: 'quest-badge ready' }, `Give ${equipmentDef(request.defId).name}`)
            : h(
                'span',
                { class: 'quest-badge relic' },
                `Wants ${equipmentDef(request.defId).name}`
              );
    return h(
      'div',
      { class: 'building-card', 'data-building': building.id },
      h(
        'div',
        { class: 'building-art' },
        h('img', {
          src: assetUrl(`sprites/props/${building.facade}.png`),
          alt: '',
          loading: 'lazy',
          draggable: 'false',
        }),
        h('img', {
          class: 'building-badge',
          src: assetUrl(`sprites/props/${building.cardProp}.png`),
          alt: '',
          loading: 'lazy',
          draggable: 'false',
        }),
        npc
          ? h('img', {
              class: 'building-portrait',
              src: assetUrl(`sprites/props/npc_${building.id}.png`),
              alt: npc.name,
              loading: 'lazy',
              draggable: 'false',
            })
          : null
      ),
      h(
        'div',
        { class: 'building-copy' },
        h('div', { class: 'building-name' }, building.name),
        h('div', { class: 'building-role' }, building.role),
        h('div', { class: 'building-blurb' }, building.blurb),
        h('div', { class: 'building-badges' }, badge, requestBadge)
      ),
      button('Enter', () => opts.onEnter(building.id), 'btn small primary building-enter')
    );
  });

  const stationActions: Record<string, () => void> = {
    restoration: opts.onRestoration,
    training: opts.onTraining,
    meditation: opts.onMeditation,
    noticeboard: opts.onQuests,
    reliquary: opts.onReliquary,
    cairn: opts.onCairn,
    aspect: opts.onAspect,
    reforge: opts.onReforge,
  };

  const stations = SANCTUARY_STATIONS.map((station) => {
    const el = button(station.name, () => stationActions[station.id]?.(), 'btn station-button');
    el.dataset.station = station.id;
    el.append(h('span', { class: 'station-hint' }, station.hint));
    return el;
  });

  const continueBtn = button('Continue Expedition', opts.onContinue, 'btn');
  continueBtn.disabled = !opts.canContinue;
  const restBtn = button(
    opts.saved ? `Rest · ${opts.restCost} echoes` : 'Rest',
    opts.onRest,
    'btn'
  );
  restBtn.disabled =
    !opts.saved ||
    !opts.canContinue ||
    opts.meta.echoes < opts.restCost ||
    opts.saved.health >= opts.saved.maxHealth;

  return h(
    'div',
    { class: 'screen sanctuary-hub' },
    h(
      'div',
      { class: 'hub-head' },
      h('div', { class: 'subtitle' }, 'Between Expeditions'),
      h('div', { class: 'title small' }, 'The Sanctuary'),
      h(
        'div',
        { class: 'hub-ledger' },
        h('span', {}, 'Echoes ', h('b', {}, `${meta.echoes}`)),
        h('span', {}, 'Restored ', h('b', {}, `${restored}/${TOTAL_RESTORATION_LEVELS}`)),
        h(
          'span',
          {},
          'Memories ',
          h('b', {}, `${meta.fragments.length}/${MEMORY_FRAGMENTS.length}`)
        ),
        h('span', {}, 'Checkpoint ', h('b', {}, `Section ${sectionNumber(meta.checkpoint)}`)),
        h('span', {}, 'Best ', h('b', {}, `${meta.bestScore}`)),
        h('span', {}, 'Best flow ', h('b', {}, `x${meta.bestResonance}`)),
        h(
          'span',
          {},
          'Daily streak ',
          h(
            'b',
            {},
            `${meta.daily.streak}${meta.daily.bestStreak > meta.daily.streak ? ` (best ${meta.daily.bestStreak})` : ''}`
          )
        )
      ),
      h(
        'div',
        { class: 'rest-progress' },
        h('div', {
          class: 'rest-progress-fill',
          style: `width:${(restored / TOTAL_RESTORATION_LEVELS) * 100}%`,
        })
      )
    ),
    h('div', { class: 'section-label' }, 'Residents'),
    h('div', { class: 'building-grid' }, ...cards),
    h('div', { class: 'section-label' }, `Feats · ${meta.feats.length}/${FEATS.length}`),
    h(
      'div',
      { class: 'panel feats-panel' },
      ...FEATS.map((feat) => {
        if (meta.feats.includes(feat.id))
          return h('span', { class: 'feat unlocked', title: feat.text }, feat.name);
        const progress = featProgress(feat.id, {
          kills: meta.kills,
          bestDepth: meta.bestDepth,
          bestResonance: meta.bestResonance,
          victories: meta.victories,
        });
        return h(
          'span',
          { class: 'feat locked', title: feat.text },
          progress ? `${feat.name} · ${progress.current}/${progress.target}` : '···'
        );
      })
    ),
    meta.lastRun
      ? h(
          'div',
          { class: 'meta-line' },
          `Last expedition · Section ${meta.lastRun.depth + 1} · score ${meta.lastRun.score} · ${
            meta.lastRun.won ? 'the world remembers' : 'forgotten — the deep keeps the rest'
          }`
        )
      : null,
    meta.runHistory.length > 1
      ? h(
          'div',
          { class: 'panel feats-panel' },
          h('div', { class: 'gear-name' }, 'Past expeditions'),
          ...[...meta.runHistory]
            .slice(-8)
            .reverse()
            .map((entry) =>
              h(
                'span',
                { class: 'history-entry' },
                h(
                  'span',
                  { class: entry.won ? 'feat unlocked' : 'feat locked', title: entry.date },
                  `S${entry.depth + 1} · ${entry.score} ${entry.won ? '✓' : ''}`
                ),
                entry.seed !== undefined
                  ? (() => {
                      const replay = button(
                        'Replay',
                        () => opts.onReplay(entry.seed!),
                        'btn small'
                      );
                      replay.title = 'Run it back on the same seed';
                      return replay;
                    })()
                  : null
              )
            )
        )
      : null,
    h(
      'div',
      { class: 'hub-lower' },
      h(
        'div',
        { class: 'hub-places' },
        h('div', { class: 'section-label' }, 'Places'),
        h('div', { class: 'station-row' }, ...stations)
      ),
      h(
        'div',
        { class: 'hub-expedition' },
        h('div', { class: 'section-label' }, 'Expedition'),
        h(
          'div',
          { class: 'hub-actions' },
          opts.saved && opts.canContinue
            ? h(
                'div',
                { class: 'hub-saved' },
                `Expedition waiting · Section ${opts.saved.depth + 1} · ${Math.round(
                  opts.saved.health
                )}/${Math.round(opts.saved.maxHealth)} HP`
              )
            : h('div', { class: 'hub-saved quiet' }, 'No expedition in progress.'),
          button('Set Out', opts.onExpedition, 'btn primary'),
          continueBtn,
          restBtn
        )
      )
    ),
    h(
      'div',
      { class: 'hub-footer' },
      button('Memories', opts.onMemories, 'btn small'),
      button('Settings', opts.onSettings, 'btn small'),
      button('Controls', opts.onControls, 'btn small'),
      button('Title Screen', opts.onTitle, 'btn small')
    )
  );
}

/** Choose which vault relic is guaranteed to start every expedition. */
export function reliquaryScreen(opts: {
  meta: Meta;
  onAttune: (defId: string) => void;
  onBack: () => void;
}): HTMLElement {
  const attuned = opts.meta.attunedRelic;
  const rows = opts.meta.vault
    .map((defId) => {
      try {
        return { defId, def: equipmentDef(defId) };
      } catch {
        return null;
      }
    })
    .filter((row): row is { defId: string; def: ReturnType<typeof equipmentDef> } => row !== null)
    .map(({ defId, def }) => {
      const isAttuned = attuned === defId;
      return h(
        'div',
        { class: `gear-row ${def.rarity}${isAttuned ? ' attuned' : ' not-attuned'}` },
        h('span', { class: 'gear-slot' }, relicIcon(defId), def.slot),
        h(
          'div',
          { class: 'gear-copy' },
          h('div', { class: 'gear-name' }, def.name, rarityTag(def.rarity)),
          h('div', { class: 'gear-desc' }, def.description)
        ),
        h(
          'div',
          { class: 'gear-actions' },
          isAttuned
            ? h('span', { class: 'attuned-chip' }, 'Attuned')
            : button('Attune', () => opts.onAttune(defId), 'btn small')
        )
      );
    });

  return h(
    'div',
    { class: 'screen place-screen' },
    h('div', { class: 'heading' }, 'The Reliquary'),
    h(
      'div',
      { class: 'subtitle' },
      'One relic can be attuned to answer your call the moment an expedition begins.'
    ),
    h(
      'div',
      { class: 'place-body' },
      h(
        'div',
        { class: 'place-art' },
        h('img', { src: assetUrl('sprites/props/furn_weapon_rack.png'), alt: '' }),
        h('div', { class: 'place-art-caption' }, reliquaryCaption(attuned))
      ),
      h(
        'div',
        { class: 'place-content' },
        rows.length > 0
          ? h(
              'div',
              { class: 'panel relic-list' },
              ...rows,
              h(
                'div',
                { class: 'place-note' },
                attuned
                  ? 'The attuned relic is equipped first; every other vault relic still travels with you.'
                  : 'No relic is attuned. The first vault relic is equipped by default.'
              )
            )
          : h(
              'div',
              { class: 'panel place-empty' },
              h('div', { class: 'gear-name' }, 'The shelves are empty.'),
              h(
                'div',
                { class: 'gear-desc' },
                'Residents reward relics for their tasks. Once one is in the vault it can be attuned here.'
              )
            ),
        h('div', { class: 'menu' }, button('Back', opts.onBack))
      )
    )
  );
}

/** Bank echoes as starting shards for the next expedition. */
export function cairnScreen(opts: {
  meta: Meta;
  onOffer: () => void;
  onBack: () => void;
}): HTMLElement {
  const banked = cairnOfferings(opts.meta);
  const cost = cairnCost(opts.meta);
  const offer =
    cost === undefined
      ? h('div', { class: 'cairn-full-chip' }, '3/3 · The cairn is full')
      : button(`Leave an offering · ${CAIRN_COST} echoes`, opts.onOffer, 'btn primary');
  if (offer instanceof HTMLButtonElement) {
    offer.disabled = opts.meta.echoes < CAIRN_COST;
    offer.dataset.action = 'cairn:offer';
  }
  const pips = Array.from({ length: CAIRN_MAX }, (_, i) =>
    h('span', { class: `cairn-pip${i < banked ? ' filled' : ''}` })
  );
  return h(
    'div',
    { class: 'screen place-screen' },
    h('div', { class: 'heading' }, 'The Cairn'),
    h(
      'div',
      { class: 'subtitle' },
      'A stack of warm stones. Echoes pressed here come back as shards in your hand.'
    ),
    h(
      'div',
      { class: 'place-body' },
      h(
        'div',
        { class: 'place-art cairn-art' },
        h('img', { src: assetUrl('sprites/props/cairn_stack.png'), alt: '' }),
        h('div', { class: 'place-art-caption' }, 'Offerings rest here until the road calls.')
      ),
      h(
        'div',
        { class: 'place-content' },
        h(
          'div',
          { class: 'panel place-panel' },
          h('div', { class: 'cairn-pips' }, ...pips),
          h(
            'div',
            { class: 'cairn-total' },
            `${banked * CAIRN_SHARDS} starting shards`,
            h('span', { class: 'cairn-sub' }, ` · ${banked}/${CAIRN_MAX} offerings banked`)
          ),
          offer,
          h(
            'div',
            { class: 'place-note' },
            `Each offering costs ${CAIRN_COST} echoes and carries ${CAIRN_SHARDS} shards into the next expedition only. Offerings are spent when you set out.`
          )
        ),
        h('div', { class: 'menu' }, button('Back', opts.onBack))
      )
    )
  );
}

/** Choose the long-term element that colours every expedition. */
/** A "Choose" button for one aspect, keyed so a re-render can keep focus on it. */
function aspectChooseButton(id: AspectId, onChoose: (id: AspectId) => void): HTMLButtonElement {
  const btn = button('Choose', () => onChoose(id), 'btn small');
  btn.dataset.action = `aspect:${id}`;
  return btn;
}

export function aspectScreen(opts: {
  current: string;
  onChoose: (id: AspectId) => void;
  onBack: () => void;
}): HTMLElement {
  const cards = ASPECTS.map((aspect) => {
    const selected = opts.current === aspect.id;
    return h(
      'div',
      { class: `aspect-card${selected ? ' selected' : ''}`, 'data-aspect': aspect.id },
      h('div', { class: `aspect-sigil aspect-${aspect.id}` }),
      h(
        'div',
        { class: 'aspect-copy' },
        h('div', { class: 'aspect-name' }, aspect.name),
        h('div', { class: 'aspect-desc' }, aspect.description)
      ),
      selected
        ? h('span', { class: 'attuned-chip' }, 'Active')
        : aspectChooseButton(aspect.id, opts.onChoose)
    );
  });
  return h(
    'div',
    { class: 'screen place-screen aspect-screen' },
    h('div', { class: 'heading' }, 'The Aspect Shrine'),
    h(
      'div',
      { class: 'subtitle' },
      'Mark the walker with one element. The mark is permanent until changed here.'
    ),
    h('div', { class: 'aspect-grid' }, ...cards),
    h('div', { class: 'menu' }, button('Back', opts.onBack))
  );
}

/** Compact, human-readable relic mods, scaled by the Reforge rank. */
const MOD_LABELS: Record<string, string> = {
  maxHealth: 'health',
  maxMana: 'mana',
  manaRegen: 'mana regen',
  moveSpeed: 'move speed',
  meleeDamage: 'melee damage',
  attackSpeed: 'attack speed',
  critChance: 'crit chance',
  critMultiplier: 'crit damage',
  dashCharges: 'dash charge',
  dashRecharge: 'dash recharge',
  boltDamage: 'bolt damage',
  boltCost: 'bolt cost',
  boltCount: 'bolt',
  boltPierce: 'bolt pierce',
  lifesteal: 'lifesteal',
  damageReduction: 'damage reduction',
  pickupRadius: 'pickup radius',
  maxPotions: 'potion capacity',
  manaOnKill: 'mana on kill',
};

const MOD_PERCENT = new Set([
  'attackSpeed',
  'critChance',
  'critMultiplier',
  'lifesteal',
  'damageReduction',
  'moveSpeed',
  'dashRecharge',
  'manaRegen',
]);

function modSummary(mods: Record<string, unknown>, scale = 1): string {
  const parts: string[] = [];
  for (const [key, raw] of Object.entries(mods)) {
    if (typeof raw !== 'number') continue;
    const label = MOD_LABELS[key];
    if (!label) continue;
    const value = raw * scale;
    const rounded = Math.abs(value) >= 1 ? Math.round(value) : Math.round(value * 10) / 10;
    const text = MOD_PERCENT.has(key)
      ? `${value > 0 ? '+' : ''}${Math.round(value * 100)}%`
      : `${value > 0 ? '+' : ''}${rounded}`;
    parts.push(`${text} ${label}`);
  }
  return parts.join(' · ');
}
/** Reinforce vault relics permanently with echoes. */
export function reforgeScreen(opts: {
  meta: Meta;
  onReforge: (defId: string) => void;
  onBack: () => void;
}): HTMLElement {
  const rows = opts.meta.vault
    .map((defId) => {
      try {
        return { defId, def: equipmentDef(defId) };
      } catch {
        return null;
      }
    })
    .filter((row): row is { defId: string; def: ReturnType<typeof equipmentDef> } => row !== null)
    .map(({ defId, def }) => {
      const rank = relicRank(opts.meta, defId);
      const cost = reforgeCost(opts.meta, defId);
      const pips = h(
        'div',
        { class: 'reforge-pips' },
        ...Array.from({ length: REFORGE_RANKS }, (_, i) =>
          h('span', { class: `reforge-pip${i < rank ? ' filled' : ''}` })
        )
      );
      const action =
        cost === undefined
          ? h('span', { class: 'attuned-chip' }, 'Masterwork')
          : button(`Reforge · ${cost} echoes`, () => opts.onReforge(defId), 'btn small');
      if (cost !== undefined && opts.meta.echoes < cost)
        (action as HTMLButtonElement).disabled = true;
      if (action instanceof HTMLButtonElement) action.dataset.action = `reforge:${defId}`;
      return h(
        'div',
        { class: `gear-row ${def.rarity}${rank > 0 ? ' attuned' : ''}` },
        h('span', { class: 'gear-slot' }, relicIcon(defId), def.slot),
        h(
          'div',
          { class: 'gear-copy' },
          h(
            'div',
            { class: 'gear-name' },
            `${def.name}${rank > 0 ? ` +${rank}` : ''}`,
            rarityTag(def.rarity)
          ),
          h('div', { class: 'gear-desc' }, modSummary(def.mods, 1 + 0.12 * rank)),
          pips
        ),
        h('div', { class: 'gear-actions' }, action)
      );
    });

  return h(
    'div',
    { class: 'screen place-screen' },
    h('div', { class: 'heading' }, 'The Reforge'),
    h(
      'div',
      { class: 'subtitle' },
      'Each rank strengthens every number on a relic. The work is permanent and follows it into every expedition.'
    ),
    rows.length > 0
      ? h(
          'div',
          { class: 'panel relic-list' },
          ...rows,
          h(
            'div',
            { class: 'place-note' },
            'Ranks add +12% to the relic’s numeric mods, up to three ranks.'
          )
        )
      : h(
          'div',
          { class: 'panel place-empty' },
          h('div', { class: 'gear-name' }, 'Nothing to reforge yet.'),
          h(
            'div',
            { class: 'gear-desc' },
            'Relics earned from residents wait in the Reliquary. Bring one here to strengthen it.'
          )
        ),
    h('div', { class: 'menu' }, button('Back', opts.onBack))
  );
}

/** Where a vault relic ends up when the next expedition builds its kit. */
type CarryState = 'worn' | 'bag' | 'home';
const CARRY_LABELS: Readonly<Record<CarryState, string>> = {
  worn: 'Worn',
  bag: 'In bag',
  home: 'Stays home',
};

/** Mirrors createExpedition: worn slots first, then bag space, then the rest. */
function vaultCarryPlan(meta: Meta): Map<string, CarryState> {
  const vault = meta.vault ?? [];
  const attuned = meta.attunedRelic;
  const ordered =
    attuned && vault.includes(attuned) ? [attuned, ...vault.filter((id) => id !== attuned)] : vault;
  const worn = new Set<EquipmentSlot>();
  const plan = new Map<string, CarryState>();
  let bagged = 0;
  for (const defId of ordered) {
    try {
      const def = equipmentDef(defId);
      if (!worn.has(def.slot)) {
        worn.add(def.slot);
        plan.set(defId, 'worn');
      } else if (bagged < INVENTORY_SLOTS) {
        bagged++;
        plan.set(defId, 'bag');
      } else {
        plan.set(defId, 'home');
      }
    } catch {
      plan.set(defId, 'home');
    }
  }
  return plan;
}

/** Pick a checkpoint to start a new expedition from, and sell off spare relics. */
export function expeditionScreen(opts: {
  meta: Meta;
  saved?: { depth: number; health: number; maxHealth: number };
  restCost: number;
  dailyKey: string;
  onContinue?: () => void;
  onRest?: () => void;
  onStart: (depth: number) => void;
  onDaily: () => void;
  onDifficulty: () => void;
  onSellRelic: (defId: string) => void;
  onBack: () => void;
}): HTMLElement {
  const rows = checkpointDepths().map((depth) => {
    const unlocked = depth <= opts.meta.checkpoint;
    const name = `Section ${depth + 1} \u00b7 ${FLOOR_PLANS[depth].trialName ?? biomeInfo(FLOOR_PLANS[depth].biome).name}`;
    const start = button(
      unlocked ? `Begin at Section ${depth + 1}` : `Reach Section ${depth + 1} to unlock`,
      () => opts.onStart(depth),
      'btn checkpoint-start'
    );
    start.disabled = !unlocked;
    return h(
      'div',
      { class: `checkpoint${unlocked ? '' : ' locked'}` },
      h('div', { class: 'cp-head' }, h('span', { class: 'cp-name', title: name }, name)),
      h(
        'div',
        { class: 'cp-note' },
        h('span', { class: 'cp-tag' }, depth === 0 ? 'Beginning' : 'Checkpoint'),
        depth === 0
          ? 'Start from the first memory.'
          : `Skip ahead: +${depth * 2} vestige upgrades and level ${1 + depth * 2}.`
      ),
      start
    );
  });
  const saved = opts.saved;
  const resting = !!saved && opts.meta.echoes >= opts.restCost;
  const carry = vaultCarryPlan(opts.meta);
  const relicRows = opts.meta.vault
    .map((defId) => {
      try {
        return { defId, def: equipmentDef(defId) };
      } catch {
        return null;
      }
    })
    .filter((row): row is { defId: string; def: ReturnType<typeof equipmentDef> } => row !== null)
    .map(({ defId, def }) => {
      const state = carry.get(defId) ?? 'home';
      const price = relicSellEchoes(opts.meta, defId);
      const sell = confirmButton(
        `Sell · ${price ?? 0} echoes`,
        'Confirm sale',
        () => {
          if (price === undefined) return;
          opts.onSellRelic(defId);
        },
        'btn small'
      );
      sell.dataset.action = `market:${defId}`;
      return h(
        'div',
        { class: `gear-row ${def.rarity}${state === 'home' ? ' not-attuned' : ''}` },
        h('span', { class: 'gear-slot' }, relicIcon(defId), def.slot),
        h(
          'div',
          { class: 'gear-copy' },
          h('div', { class: 'gear-name' }, def.name, rarityTag(def.rarity)),
          h('div', { class: 'gear-desc' }, def.description)
        ),
        h(
          'div',
          { class: 'gear-actions' },
          h('span', { class: `carry-chip ${state}` }, CARRY_LABELS[state]),
          price !== undefined ? sell : null
        )
      );
    });
  const dailyBest = opts.meta.daily.best[opts.dailyKey];
  const mod = dailyModifier(opts.dailyKey);
  return h(
    'div',
    { class: 'screen hub set-out' },
    h('div', { class: 'heading' }, 'Set Out'),
    h(
      'div',
      { class: 'subtitle' },
      'Every checkpoint reached is kept. Choose where this expedition begins.'
    ),
    saved
      ? h(
          'div',
          { class: 'panel pending-run' },
          h(
            'div',
            { class: 'cp-name' },
            `Expedition waiting · Section ${saved.depth + 1} · ${Math.round(saved.health)}/${Math.round(saved.maxHealth)} HP`
          ),
          h(
            'div',
            { class: 'gear-actions' },
            opts.onContinue ? button('Continue', opts.onContinue, 'btn small primary') : null,
            opts.onRest
              ? Object.assign(button(`Rest · ${opts.restCost} echoes`, opts.onRest, 'btn small'), {
                  disabled: !resting || saved.health >= saved.maxHealth,
                })
              : null
          )
        )
      : null,
    h('div', { class: 'panel checkpoint-list' }, ...rows),
    h(
      'div',
      { class: 'panel daily-panel' },
      h(
        'div',
        { class: 'daily-copy' },
        h(
          'div',
          { class: 'gear-name' },
          `Difficulty · ${opts.meta.settings.difficulty[0].toUpperCase()}${opts.meta.settings.difficulty.slice(1)}`
        ),
        h(
          'div',
          { class: 'gear-desc' },
          opts.meta.settings.difficulty === 'story'
            ? 'Softer enemies, harder walker. For the tale.'
            : opts.meta.settings.difficulty === 'nightmare'
              ? '+35% incoming, tougher hides, more elites.'
              : 'The deep as remembered.'
        )
      ),
      button('Change', opts.onDifficulty, 'btn small')
    ),
    h(
      'div',
      { class: 'panel daily-panel' },
      h(
        'div',
        { class: 'daily-copy' },
        h('div', { class: 'gear-name' }, `Daily Descent · ${opts.dailyKey}`),
        h(
          'div',
          { class: 'gear-desc' },
          `One shared seed for everyone, today only. Streak ${opts.meta.daily.streak}${
            dailyBest !== undefined ? ` best ${dailyBest}` : ''
          }. Twist: ${mod.name} — ${mod.text}`
        )
      ),
      button('Begin the daily', opts.onDaily, 'btn small primary')
    ),
    relicRows.length > 0
      ? h(
          'div',
          { class: 'panel vault-sell' },
          h('div', { class: 'gear-title' }, `Vault relics · ${relicRows.length}`),
          ...relicRows,
          h(
            'div',
            { class: 'place-note' },
            `Worn relics travel first, then up to ${INVENTORY_SLOTS} bag slots. The rest stay home — sell spares for echoes.`
          )
        )
      : null,
    h(
      'div',
      { class: 'meta-line' },
      `Echoes in hand · ${opts.meta.echoes}. Half of the shards you carry home are banked as echoes when an expedition ends.`
    ),
    h('div', { class: 'menu' }, button('Back', opts.onBack))
  );
}

function supplyRow(name: string, count: string, hint: string): HTMLElement {
  return h(
    'div',
    { class: 'gear-row' },
    h('span', { class: 'gear-slot' }, 'item'),
    h(
      'div',
      { class: 'gear-copy' },
      h('div', { class: 'gear-name' }, `${name} · ${count}`),
      h('div', { class: 'gear-desc' }, hint)
    )
  );
}

/** Talking to a Sanctuary NPC, with accept/claim, a relic request and a road hint. */
export function dialogueScreen(opts: {
  npcId: string;
  progress: number;
  accepted: boolean;
  claimed: boolean;
  trust: number;
  trustBonus: number;
  tributeCost: number | undefined;
  rushMinutes: number | undefined;
  stories: readonly string[];
  /** The chapter currently on offer; undefined once every chapter is claimed. */
  quest?: QuestDef;
  /** The closing line of the most recently claimed chapter. */
  epilogue?: string;
  /** The relic this resident wants, with whether the vault holds it. */
  wantedRelic?: { name: string; echoes: number; line: string; owned: boolean; done: boolean };
  /** One practical line about the road ahead, revealed on request. */
  hint: string;
  onAccept: () => void;
  onClaim: () => void;
  onTribute: () => void;
  onGiveRelic: () => void;
  onClose: () => void;
}): HTMLElement {
  const npc = NPCS[opts.npcId] ?? { name: 'A quiet resident', role: '', greeting: '...' };
  const quest = opts.quest;
  const bonus = quest ? questBonus(quest) : undefined;
  const ready = quest ? opts.progress >= quest.target : false;
  const portraitUrl = assetUrl(`sprites/props/npc_${opts.npcId}.png`);
  const hintPanel = h('div', { class: 'panel dialogue-panel dialogue-hint hidden' }, opts.hint);
  const hintButton = button('Ask about the road', () => {
    hintPanel.classList.toggle('hidden');
  });
  return h(
    'div',
    { class: 'screen hub' },
    h(
      'div',
      { class: 'dialogue-header' },
      h(
        'div',
        { class: 'dialogue-avatar' },
        h('img', {
          src: portraitUrl,
          alt: npc.name,
          class: 'dialogue-portrait',
          draggable: 'false',
        })
      ),
      h(
        'div',
        { class: 'dialogue-titles' },
        h('div', { class: 'subtitle' }, npc.role),
        h('div', { class: 'title small' }, npc.name),
        h(
          'div',
          { class: 'trust-line' },
          `Trust ${'♥'.repeat(opts.trust)}${'♡'.repeat(3 - opts.trust)}`,
          opts.trustBonus > 0
            ? h('span', {}, ` · +${opts.trustBonus} echo friends' share on claims`)
            : null
        ),
        h(
          'div',
          { class: 'dialogue-actions' },
          opts.tributeCost !== undefined
            ? (() => {
                const tribute = button(
                  `Offer tribute · ${opts.tributeCost} echoes`,
                  opts.onTribute,
                  'btn small'
                );
                tribute.title = 'A gift of echoes deepens trust. Full trust earns a parting gift.';
                return tribute;
              })()
            : null
        )
      )
    ),
    h('div', { class: 'panel dialogue-panel' }, h('p', { class: 'dialogue-line' }, npc.greeting)),
    quest
      ? h(
          'div',
          { class: 'panel dialogue-panel' },
          h('div', { class: 'gear-name' }, quest.name),
          h('p', { class: 'dialogue-line' }, quest.text),
          h(
            'div',
            { class: 'cp-note' },
            `${Math.min(opts.progress, quest.target)} / ${quest.target} · reward ${quest.rewardEchoes} echoes${quest.rewardItem ? ' + a relic' : ''}${bonus ? ` · bonus +${bonus.echoes} at ${bonus.target}` : ''}${
              opts.accepted &&
              !opts.claimed &&
              opts.rushMinutes !== undefined &&
              opts.rushMinutes > 0
                ? ` · rush: claim within ${opts.rushMinutes}m for +50%`
                : ''
            }`
          ),
          h(
            'div',
            { class: 'gear-actions' },
            !opts.accepted ? button('Accept the task', opts.onAccept, 'btn small primary') : null,
            opts.accepted && !opts.claimed
              ? Object.assign(button('Claim the reward', opts.onClaim, 'btn small primary'), {
                  disabled: !ready,
                })
              : null,
            opts.claimed ? h('span', { class: 'echo-chip' }, 'Completed') : null
          )
        )
      : null,
    opts.stories.length > 0
      ? h(
          'div',
          { class: 'panel dialogue-panel' },
          h('div', { class: 'gear-name' }, 'Stories & remarks'),
          ...opts.stories.map((line) => h('p', { class: 'dialogue-line' }, `“${line}”`))
        )
      : null,
    opts.epilogue
      ? h(
          'div',
          { class: 'panel dialogue-panel epilogue' },
          h('div', { class: 'gear-name' }, 'After the task'),
          h('p', { class: 'dialogue-line' }, `“${opts.epilogue}”`)
        )
      : null,
    opts.wantedRelic
      ? h(
          'div',
          { class: 'panel dialogue-panel relic-request' },
          h('div', { class: 'gear-name' }, `Wanted: ${opts.wantedRelic.name}`),
          h('p', { class: 'dialogue-line' }, `“${opts.wantedRelic.line}”`),
          h(
            'div',
            { class: 'cp-note' },
            opts.wantedRelic.done
              ? 'Delivered. The Sanctuary remembers.'
              : `Reward ${opts.wantedRelic.echoes} echoes · one heart of trust${
                  opts.wantedRelic.owned ? '' : ' · not in the vault yet'
                }`
          ),
          opts.wantedRelic.done || !opts.wantedRelic.owned
            ? null
            : button(`Give ${opts.wantedRelic.name}`, opts.onGiveRelic, 'btn small primary')
        )
      : null,
    hintPanel,
    h('div', { class: 'menu' }, hintButton, button('Step away', opts.onClose, 'btn primary'))
  );
}

/** Esc menu inside the walkable Sanctuary. */
export function sanctuaryMenuScreen(opts: {
  buildingName: string;
  onResume: () => void;
  onLeave: () => void;
  onSettings: () => void;
  onControls: () => void;
  onTitle: () => void;
}): HTMLElement {
  return h(
    'div',
    { class: 'screen' },
    h('div', { class: 'heading' }, opts.buildingName),
    h('div', { class: 'subtitle' }, 'A quiet room in the Sanctuary.'),
    h(
      'div',
      { class: 'menu' },
      button('Stay', opts.onResume, 'btn primary'),
      button('Back to the Sanctuary', opts.onLeave),
      button('Settings', opts.onSettings),
      button('Controls', opts.onControls),
      button('Title', opts.onTitle)
    )
  );
}

/** Relics carried and worn, with click-to-equip rows, live stats and safe selling. */
/** The picked relic box (`worn:<slot>`, `bag:<uid>` or `empty:<i>`); module scope so it survives each re-render. */
let selectedRelic: string | null = null;
/** Longer than the gap between the two clicks of a typical double click. */
const DETAIL_SCROLL_DELAY_MS = 400;

/** Short labels for stats an item can modify, used in comparison chips. */
const STAT_LABEL: Partial<Record<keyof PlayerStats, string>> = {
  maxHealth: 'HP',
  maxMana: 'Mana',
  manaRegen: 'Regen',
  moveSpeed: 'Move',
  meleeDamage: 'Melee',
  attackSpeed: 'AtkSpd',
  critChance: 'Crit',
  critMultiplier: 'CritDmg',
  dashCharges: 'Dash',
  dashRecharge: 'DashRec',
  boltDamage: 'Bolt',
  boltCost: 'BoltCost',
  boltCount: 'Bolts',
  boltPierce: 'Pierce',
  lifesteal: 'Lifesteal',
  damageReduction: 'Armor',
  pickupRadius: 'Pickup',
  maxPotions: 'Flasks',
  manaOnKill: 'ManaKill',
};
/**
 * How a stat delta reads: flat points, percentage points (fraction stats
 * like 0.03 = 3%), or relative percent for the multiplicative speed stats.
 */
const DELTA_FORMAT: Partial<Record<keyof PlayerStats, 'flat' | 'pp' | 'rel'>> = {
  damageReduction: 'pp',
  critChance: 'pp',
  lifesteal: 'pp',
  moveSpeed: 'flat',
  attackSpeed: 'rel',
};

/** A green/red chip for one stat's worn → candidate delta, or null when tied. */
function deltaChip(key: string, before: number, after: number): HTMLElement | null {
  const format = DELTA_FORMAT[key as keyof PlayerStats] ?? 'flat';
  const d = after - before;
  if (format === 'rel') {
    const pct = before !== 0 ? (d / Math.abs(before)) * 100 : 0;
    if (Math.abs(pct) < 0.05) return null;
    const text = `${STAT_LABEL[key as keyof PlayerStats] ?? key} ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
    return h('span', { class: pct >= 0 ? 'delta-up' : 'delta-down' }, text);
  }
  const mag = format === 'pp' ? d * 100 : d;
  if (Math.abs(mag) < (format === 'pp' ? 0.05 : 0.005)) return null;
  const flat =
    Number.isInteger(before) && Number.isInteger(after) ? `${Math.round(mag)}` : mag.toFixed(1);
  const text = `${STAT_LABEL[key as keyof PlayerStats] ?? key} ${mag >= 0 ? '+' : ''}${format === 'pp' ? `${mag.toFixed(1)}pp` : flat}`;
  return h('span', { class: mag >= 0 ? 'delta-up' : 'delta-down' }, text);
}

function itemName(item: EquipmentItem): string {
  return `${equipmentDef(item.defId).name}${item.rank ? ` +${item.rank}` : ''}`;
}

/** A relic's small icon for list rows; decorative, the row already names the relic. */
function relicIcon(defId: string): HTMLElement {
  return h('img', { class: 'gear-icon', src: relicIconUrl(defId), alt: '', draggable: 'false' });
}

/** Rarity as text as well as colour: the row's coloured edge alone excludes colour-blind readers. */
function rarityTag(rarity: EquipmentRarity): HTMLElement {
  // The separator is in the DOM, not only in CSS, so the accessible name reads
  // "Rusted Edge · common" instead of "Rusted Edgecommon".
  return h('span', { class: 'rarity-tag' }, `\u00a0\u00b7 ${rarity}`);
}

export function inventoryScreen(
  world: World,
  onClose: () => void,
  onChanged: (message?: string) => void,
  status = 'Pick a relic to see it. Drag it onto its slot or your wanderer to wear it; arrow keys move, Enter picks.'
): HTMLElement {
  const p = world.player;
  const s = p.stats;
  const bank = bankSummary(world.run);
  const wornSets = activeSets(p.equipment);
  const statChip = (label: string, value: string): HTMLElement =>
    h('span', { class: 'gear-stat' }, h('b', {}, value), ` ${label}`);
  // One path for the grid, its double click and the detail pane, so the messages cannot drift apart.
  const equipFromBag = (uid: number): void => {
    const item = p.inventory.find((i) => i.uid === uid);
    if (!item) {
      onChanged('That relic is no longer carried.');
      return;
    }
    const def = equipmentDef(item.defId);
    const worn = p.equipment[def.slot];
    world.equipItem(uid);
    selectedRelic = `worn:${def.slot}`;
    onChanged(
      worn
        ? `Equipped ${def.name}; ${equipmentDef(worn.defId).name} returned to the bag.`
        : `Equipped ${def.name}.`
    );
  };
  const unequipSlot = (slot: EquipmentSlot): void => {
    const worn = p.equipment[slot];
    if (!worn) return;
    const name = equipmentDef(worn.defId).name;
    const returned = world.unequip(slot);
    if (returned) selectedRelic = `bag:${worn.uid}`;
    onChanged(
      returned
        ? `${name} returned to the bag.`
        : 'The bag is full. Sell or equip a carried relic first.'
    );
  };
  const sellRelic = (uid: number): void => {
    const item = p.inventory.find((i) => i.uid === uid);
    const gained = world.sellItem(uid);
    selectedRelic = null;
    onChanged(
      gained === undefined || !item
        ? 'That relic is no longer carried.'
        : `Sold ${equipmentDef(item.defId).name} for ${gained} shards.`
    );
  };
  const discardRelic = (uid: number): void => {
    const item = p.inventory.find((i) => i.uid === uid);
    const ok = world.discardItem(uid);
    selectedRelic = null;
    onChanged(
      ok && item
        ? `Discarded ${equipmentDef(item.defId).name}.`
        : 'That relic is no longer carried.'
    );
  };
  const detailActions = {
    equip: equipFromBag,
    unequip: unequipSlot,
    sell: sellRelic,
    discard: discardRelic,
  };
  let detail = relicDetail(p, selectedRelic, detailActions);
  // A pick updates the grid and the pane in place; rebuilding would break a double click on the box.
  const select = (key: string): void => {
    selectedRelic = key;
    markSelected(grid, key);
    const next = relicDetail(p, key, detailActions);
    detail.replaceWith(next);
    detail = next;
    // The pane sits under the grid; on a short screen it starts below the panel's fold. Scrolling at
    // once moved the box under the pointer between the two clicks of a double click, so it waits out
    // the double-click gap and gives up if that pane was replaced in the meantime.
    window.setTimeout(() => {
      if (detail === next && next.isConnected) next.scrollIntoView({ block: 'nearest' });
    }, DETAIL_SCROLL_DELAY_MS);
  };
  const grid = inventoryGrid(
    p,
    { equip: equipFromBag, unequip: unequipSlot, reject: (m) => onChanged(m), select },
    selectedRelic
  );
  const bagFull = p.inventory.length >= INVENTORY_SLOTS;
  const commons = p.inventory.filter((i) => equipmentDef(i.defId).rarity === 'common');
  const junkButton =
    commons.length > 0
      ? (() => {
          const btn = confirmButton(
            `Sell ${commons.length} common${commons.length === 1 ? '' : 's'}`,
            'Confirm sale',
            () => {
              let gained = 0;
              let sold = 0;
              for (const item of [...p.inventory]) {
                if (equipmentDef(item.defId).rarity !== 'common') continue;
                const price = world.sellItem(item.uid);
                if (price !== undefined) {
                  gained += price;
                  sold++;
                }
              }
              selectedRelic = null;
              onChanged(
                sold > 0
                  ? `Sold ${sold} common relics for ${gained} shards.`
                  : 'Nothing left to sell.'
              );
            }
          );
          btn.title = 'Sell every common relic in the bag at once';
          return h('div', { class: 'gear-filters' }, btn);
        })()
      : null;
  const panel = h(
    'div',
    { class: 'panel gear-panel' },
    h(
      'div',
      { class: 'gear-stats' },
      statChip('Melee', `${s.meleeDamage}`),
      statChip('Bolt', `${s.boltDamage}`),
      statChip('Armor', `${Math.round(s.damageReduction * 100)}%`),
      statChip('Crit', `${Math.round(s.critChance * 100)}%`),
      statChip('Lifesteal', `${Math.round(s.lifesteal * 100)}%`),
      statChip('Move', `${Math.round(s.moveSpeed)}`),
      statChip('AtkSpd', `${s.attackSpeed.toFixed(2)}x`),
      statChip('Mana', `${s.maxMana}`)
    ),
    grid,
    detail,
    h('div', { class: 'gear-title' }, `Carried · ${p.inventory.length}/${INVENTORY_SLOTS}`),
    h(
      'div',
      { class: 'gear-note bank-note' },
      `Checkpoint bank · ${bank.kept} relic${bank.kept === 1 ? '' : 's'} kept · ${
        bank.atRisk > 0
          ? `${bank.atRisk} new relic${bank.atRisk === 1 ? '' : 's'} at risk until the next checkpoint`
          : 'everything carried is safe'
      }.`
    ),
    wornSets.length > 0
      ? h(
          'div',
          { class: 'set-chips' },
          ...wornSets.map(({ set, count }) =>
            h(
              'span',
              {
                class: 'set-chip',
                title: `2 pieces: ${modSummary(set.two)} · 3 pieces: ${modSummary(set.three)}`,
              },
              `${set.name} ${count}/${set.pieces.length}`
            )
          )
        )
      : null,
    junkButton,
    bagFull
      ? h('div', { class: 'gear-note' }, 'The bag is full — relics found now are sold for shards.')
      : null,
    h('div', { class: 'gear-title' }, 'Active Weapon & Stance'),
    h(
      'div',
      { class: 'gear-row weapon-stance-row' },
      h('img', {
        class: 'gear-weapon-icon',
        src: assetUrl(`sprites/ui/weapon_${p.weapon}.png`),
        alt: weaponDef(p.weapon).name,
      }),
      h(
        'div',
        { class: 'gear-copy' },
        h(
          'div',
          { class: 'gear-name' },
          `${weaponDef(p.weapon).name} `,
          h(
            'span',
            { class: 'gear-slot' },
            `[${p.weapon === 'sword' ? '1' : p.weapon === 'spear' ? '2' : '3'}]`
          )
        ),
        h('div', { class: 'gear-desc' }, weaponDef(p.weapon).blurb)
      ),
      h(
        'div',
        { class: 'gear-weapon-stats' },
        h(
          'span',
          { class: 'gear-stat' },
          h('b', {}, `${weaponDef(p.weapon).steps.length}-hit`),
          ' combo'
        )
      )
    ),
    h('div', { class: 'gear-title' }, 'Supplies'),
    h(
      'div',
      { class: 'supplies-grid' },
      supplyRow('Memory Flasks', `${p.potions}/${s.maxPotions}`, 'Q — drink'),
      supplyRow('Mana Flasks', `${p.manaPotions}`, 'R — drink'),
      supplyRow('Bombs', `${p.bombs}`, 'G — throw'),
      supplyRow('Traps', `${p.traps}`, 'T — place')
    )
  );
  return h(
    'div',
    { class: 'screen' },
    h('div', { class: 'heading' }, 'Relics'),
    h('div', { class: 'subtitle' }, 'Worn relics shape this expedition. They are lost on death.'),
    panel,
    h('div', { class: 'gear-status' }, status),
    h('div', { class: 'menu' }, button('Close', onClose, 'btn primary'))
  );
}

interface DetailActions {
  equip: (uid: number) => void;
  unequip: (slot: EquipmentSlot) => void;
  sell: (uid: number) => void;
  discard: (uid: number) => void;
}

/**
 * What the picked box holds, with its actions. A carried relic shows its stat changes against what
 * is worn in its slot and offers Equip (Upgrade or Swap), Sell and Discard; a worn one offers
 * Unequip. Every action button carries a key so the re-render can keep focus on it.
 */
function relicDetail(p: World['player'], key: string | null, act: DetailActions): HTMLElement {
  const empty = (title: string, text: string): HTMLElement =>
    h(
      'div',
      { class: 'relic-detail empty' },
      h('div', { class: 'gear-name' }, title),
      h('div', { class: 'gear-desc' }, text)
    );
  const [kind, id] = (key ?? '').split(':');
  if (kind === 'worn') {
    const slot = id as EquipmentSlot;
    const item = p.equipment[slot];
    if (!item) {
      return empty(
        `Nothing worn as ${slot}`,
        `Drag a ${slot} relic here or onto your wanderer, or pick one in the bag.`
      );
    }
    const unequip = button('Unequip', () => act.unequip(slot), 'btn small');
    unequip.dataset.action = `unequip:${slot}`;
    return detailCard(item, `Worn · ${slot}`, [], p.equipment, unequip);
  }
  const item = kind === 'bag' ? p.inventory.find((i) => `${i.uid}` === id) : undefined;
  if (!item) {
    return empty(
      'No relic picked',
      'Pick a relic in the bag or on your wanderer to compare it, wear it, sell it or discard it.'
    );
  }
  const def = equipmentDef(item.defId);
  const worn = p.equipment[def.slot];
  const hypo = applyEquipment(computeStats(p.upgrades), { ...p.equipment, [def.slot]: item });
  const deltas = worn
    ? (Object.keys(def.mods) as Array<keyof PlayerStats>)
        .map((stat) => deltaChip(stat, p.stats[stat] as number, hypo[stat] as number))
        .filter((chip): chip is HTMLElement => chip !== null)
    : [];
  const better = !worn || equipmentScore(item) > equipmentScore(worn);
  const equipBtn = button(
    worn ? (better ? 'Upgrade' : 'Swap') : 'Equip',
    () => act.equip(item.uid),
    'btn small primary'
  );
  equipBtn.dataset.action = `equip:${item.uid}`;
  const price = relicSellShards(def);
  const sell = confirmButton(
    `Sell · ${price}`,
    'Confirm sale',
    () => act.sell(item.uid),
    'btn small'
  );
  sell.title = `Sell for ${price} shards`;
  sell.dataset.action = `sell:${item.uid}`;
  const discard = confirmButton('Discard', 'Confirm', () => act.discard(item.uid), 'btn small');
  discard.title = 'Destroy this relic for nothing (frees a bag slot)';
  discard.dataset.action = `discard:${item.uid}`;
  const note = worn
    ? `Carried · swaps with ${itemName(worn)}`
    : `Carried · fills the empty ${def.slot} slot`;
  return detailCard(item, note, deltas, p.equipment, equipBtn, sell, discard);
}

function detailCard(
  item: EquipmentItem,
  note: string,
  deltas: HTMLElement[],
  equipped: EquipmentSlots,
  ...actions: HTMLElement[]
): HTMLElement {
  const def = equipmentDef(item.defId);
  const set = setForRelic(def.id);
  const setCount = set ? wornSetCount(set, equipped) : 0;
  const setLine = set
    ? h(
        'div',
        { class: 'gear-set' },
        `${set.name} · ${setCount}/${set.pieces.length} worn`,
        h('div', { class: 'gear-set-bonus' }, `2 pieces: ${modSummary(set.two)}`),
        h('div', { class: 'gear-set-bonus' }, `3 pieces: ${modSummary(set.three)}`)
      )
    : null;
  return h(
    'div',
    { class: `relic-detail ${def.rarity}`, 'aria-live': 'polite' },
    h('img', {
      class: 'relic-detail-icon',
      src: relicIconUrl(item.defId),
      alt: '',
      draggable: 'false',
    }),
    h(
      'div',
      { class: 'gear-copy' },
      h('div', { class: 'gear-name' }, itemName(item), rarityTag(def.rarity)),
      h('div', { class: 'gear-slot' }, note),
      h('div', { class: 'gear-desc' }, def.description),
      setLine,
      deltas.length > 0 ? h('div', { class: 'gear-deltas' }, ...deltas) : null
    ),
    h('div', { class: 'gear-actions' }, ...actions)
  );
}

export function trainingScreen(
  meta: Meta,
  onPick: (id: 'sword' | 'spear' | 'greatsword') => void,
  onBack: () => void
): HTMLElement {
  const cards = WEAPONS.map((weapon) => {
    const active = meta.startingWeapon === weapon.id;
    const pick = button(
      active ? 'Equipped' : 'Train with this',
      () => onPick(weapon.id),
      'btn small'
    );
    pick.disabled = active;
    pick.dataset.action = `train:${weapon.id}`;
    const artName =
      weapon.id === 'spear'
        ? 'Piercing Spiral'
        : weapon.id === 'greatsword'
          ? 'Ground Fissure'
          : 'Whirlwind Crescent';
    return h(
      'div',
      { class: `restoration weapon-card${active ? ' lit' : ''}` },
      h(
        'div',
        { class: 'weapon-card-header' },
        h('img', {
          class: 'weapon-preview-icon',
          src: assetUrl(`sprites/ui/weapon_${weapon.id}.png`),
          alt: weapon.name,
        }),
        h(
          'div',
          { class: 'weapon-card-title' },
          h('div', { class: 'rest-name' }, weapon.name),
          h('span', { class: 'rest-level' }, active ? 'current' : 'stance')
        )
      ),
      h('p', { class: 'rest-desc' }, weapon.blurb),
      h(
        'div',
        { class: 'weapon-card-pills' },
        h('span', { class: 'weapon-pill' }, h('b', {}, `${weapon.steps.length}-hit`), ' combo'),
        h('span', { class: 'weapon-pill' }, h('b', {}, `${weapon.style}`), ' swing'),
        h('span', { class: 'weapon-pill' }, h('b', {}, `Art:`), ` ${artName}`)
      ),
      pick
    );
  });
  return h(
    'div',
    { class: 'screen hub' },
    h('div', { class: 'heading' }, 'The Training Yard'),
    h(
      'div',
      { class: 'subtitle' },
      'Choose the stance every expedition begins with. Switch mid-run with 1 / 2 / 3.'
    ),
    h('div', { class: 'hub-grid' }, ...cards),
    h('div', { class: 'menu' }, button('Back', onBack, 'btn primary'))
  );
}

/** Echoes one meditation costs; the purchase in App checks the same number. */
export const MEDITATION_COST = 20;

export function meditationScreen(
  meta: Meta,
  onBuy: (boon: 'vitality' | 'edge' | 'flow') => void,
  onBack: () => void
): HTMLElement {
  const options: Array<{ id: 'vitality' | 'edge' | 'flow'; name: string; text: string }> = [
    { id: 'vitality', name: 'Steady Breath', text: '+20 max health next expedition' },
    { id: 'edge', name: 'Sharper Intent', text: '+18% melee damage next expedition' },
    {
      id: 'flow',
      name: 'Open Channel',
      text: '+15 max mana and faster regeneration next expedition',
    },
  ];
  const rows = options.map((option) => {
    const active = meta.boon === option.id;
    const buy = button(
      active ? 'Meditating' : `Meditate · ${MEDITATION_COST} echoes`,
      () => onBuy(option.id),
      'btn small'
    );
    buy.disabled = active || meta.echoes < MEDITATION_COST;
    buy.dataset.action = `boon:${option.id}`;
    return h(
      'div',
      { class: `restoration${active ? ' lit' : ''}` },
      h('div', { class: 'rest-head' }, h('span', { class: 'rest-name' }, option.name)),
      h('p', { class: 'rest-desc' }, option.text),
      buy
    );
  });
  const chosen = options.find((option) => option.id === meta.boon);
  const note =
    meta.echoes < MEDITATION_COST
      ? `You need ${MEDITATION_COST - meta.echoes} more echoes to meditate.`
      : 'Meditating again replaces the boon you carry.';
  return h(
    'div',
    { class: 'screen place-screen' },
    h('div', { class: 'heading' }, 'The Meditation Stone'),
    h('div', { class: 'subtitle' }, 'One boon carries into your next expedition.'),
    h(
      'div',
      { class: 'place-body' },
      h(
        'div',
        { class: 'place-art' },
        h('img', { src: assetUrl('sprites/props/station_meditation.png'), alt: '' }),
        h(
          'div',
          { class: 'place-art-caption' },
          chosen ? `${chosen.name} rests in you.` : 'The stone waits in silence.'
        )
      ),
      h(
        'div',
        { class: 'place-content' },
        h(
          'div',
          { class: 'panel place-panel' },
          h('div', { class: 'cairn-total' }, `${meta.echoes} echoes`),
          h('div', { class: 'meditation-list' }, ...rows),
          h('div', { class: 'place-note' }, note)
        ),
        h('div', { class: 'menu' }, button('Back', onBack))
      )
    )
  );
}

/** The quest section: every task, its giver, and where it stands. */
/** The Sanctuary Notice Board: one posted note per resident's next chapter. */
export function noticeBoardScreen(
  meta: Meta,
  snapshot: QuestSnapshot,
  opts: {
    trackedQuest: string | null;
    onAccept: (id: string) => void;
    onTrack: (id: string | null) => void;
    onVisit: (npcId: string) => void;
    onOpenLog: () => void;
    onBack: () => void;
  }
): HTMLElement {
  const entries = questBoardEntries(meta, snapshot);
  const available = entries.filter((entry) => !entry.accepted);
  const active = entries.filter((entry) => entry.accepted);

  const note = (entry: (typeof entries)[number]): HTMLElement => {
    const { quest } = entry;
    const name = NPCS[quest.npcId]?.name ?? quest.npcId;
    const bonus = questBonus(quest);
    const pct = Math.min(100, Math.round((entry.progress / quest.target) * 100));
    const tracked = opts.trackedQuest === quest.id;
    return h(
      'article',
      { class: `notice-note${entry.accepted ? ' active' : ''}${tracked ? ' tracked' : ''}` },
      h('div', { class: 'notice-pin' }),
      h(
        'div',
        { class: 'notice-head' },
        h('img', {
          src: assetUrl(`sprites/props/npc_${quest.npcId}.png`),
          alt: name,
          draggable: 'false',
        }),
        h(
          'div',
          { class: 'notice-copy' },
          h('div', { class: 'quest-name' }, quest.name),
          h('div', { class: 'notice-giver' }, `${name} · ${questChapterLabel(quest)}`)
        ),
        entry.ready ? h('span', { class: 'quest-state ready' }, 'Ready to claim') : null
      ),
      h('p', { class: 'quest-text' }, quest.text),
      h(
        'div',
        { class: 'notice-reward' },
        `${quest.rewardEchoes} echoes${quest.rewardItem ? ' + a relic' : ''}${
          bonus ? ` · bonus +${bonus.echoes} at ${bonus.target}` : ''
        }`
      ),
      entry.accepted
        ? h(
            'div',
            { class: 'quest-progress' },
            h('span', { class: 'quest-bar' }, h('span', { style: `width:${pct}%` })),
            h(
              'span',
              { class: 'quest-numbers' },
              `${Math.min(entry.progress, quest.target)}/${quest.target}`
            )
          )
        : null,
      h(
        'div',
        { class: 'notice-actions' },
        entry.accepted
          ? null
          : button('Accept', () => opts.onAccept(quest.id), 'btn small primary'),
        button(
          tracked ? 'Untrack' : 'Track',
          () => opts.onTrack(tracked ? null : quest.id),
          'btn small'
        ),
        button(
          entry.ready ? 'Claim with the giver' : `Visit ${name}`,
          () => opts.onVisit(quest.npcId),
          'btn small'
        )
      )
    );
  };

  return h(
    'div',
    { class: 'screen hub notice-board' },
    h('div', { class: 'subtitle' }, 'The Notice Board'),
    h('div', { class: 'title small' }, 'Work for the willing'),
    h(
      'div',
      { class: 'meta-line' },
      `${available.length} open notice${available.length === 1 ? '' : 's'} · ${active.length} in progress · ${meta.quests.claimed.length} chapters kept`
    ),
    active.length > 0
      ? h(
          'section',
          { class: 'notice-section' },
          h(
            'div',
            { class: 'quest-section-head' },
            h('span', {}, 'In progress'),
            h('span', { class: 'quest-count' }, `${active.length}`)
          ),
          ...active.map(note)
        )
      : null,
    h(
      'section',
      { class: 'notice-section' },
      h(
        'div',
        { class: 'quest-section-head' },
        h('span', {}, 'Posted notices'),
        h('span', { class: 'quest-count' }, `${available.length}`)
      ),
      ...(available.length > 0
        ? available.map(note)
        : [
            h(
              'div',
              { class: 'quest-empty' },
              'Every notice has been taken down. Talk to a resident.'
            ),
          ])
    ),
    h(
      'div',
      { class: 'menu' },
      button('Open the quest log', opts.onOpenLog, 'btn'),
      button('Back', opts.onBack, 'btn primary')
    )
  );
}

export function questLogScreen(
  meta: Meta,
  snapshot: QuestSnapshot,
  daily: { contract: DailyBounty; progress: { kills: number; claimed: boolean } },
  opts: {
    onClaimDaily: () => void;
    weekly: {
      contract: DailyBounty;
      progress: { kills: number; claimed: boolean };
      onClaim: () => void;
    };
    trackedQuest: string | null;
    onTrack: (id: string | null) => void;
  },
  onBack: () => void
): HTMLElement {
  interface View {
    quest: (typeof QUESTS)[number];
    accepted: boolean;
    claimed: boolean;
    ready: boolean;
    progress: number;
  }
  const views: View[] = QUESTS.map((quest) => {
    const accepted = meta.quests.accepted.includes(quest.id);
    const claimed = meta.quests.claimed.includes(quest.id);
    const progress = questProgress(quest, snapshot);
    return {
      quest,
      accepted,
      claimed,
      ready: accepted && !claimed && progress >= quest.target,
      progress,
    };
  });
  const active = views.filter((view) => view.accepted && !view.claimed && !view.ready);
  const ready = views.filter((view) => view.ready);
  const done = views.filter((view) => view.claimed);
  const available = views.filter((view) => !view.accepted && !view.claimed);

  const card = (view: View): HTMLElement => {
    const { quest } = view;
    const name = NPCS[quest.npcId]?.name ?? quest.npcId;
    const state = view.claimed
      ? { label: 'Completed', tone: 'done' }
      : view.ready
        ? { label: 'Ready to claim', tone: 'ready' }
        : view.accepted
          ? { label: 'In progress', tone: 'active' }
          : { label: 'Available', tone: 'new' };
    const pct = Math.min(
      100,
      Math.round((Math.min(view.progress, quest.target) / quest.target) * 100)
    );
    const bonus = questBonus(quest);
    const raw = questRawProgress(quest, snapshot);
    const bonusPct = bonus
      ? Math.min(100, Math.round((Math.min(raw, bonus.target) / bonus.target) * 100))
      : 0;
    return h(
      'article',
      {
        class: `quest-card${view.claimed ? ' done' : view.ready ? ' lit' : ''}${opts.trackedQuest === quest.id ? ' tracked' : ''}`,
      },
      h(
        'div',
        { class: 'quest-avatar' },
        h('img', {
          src: assetUrl(`sprites/props/npc_${quest.npcId}.png`),
          alt: name,
          draggable: 'false',
        })
      ),
      h(
        'div',
        { class: 'quest-body' },
        h(
          'div',
          { class: 'quest-top' },
          h('span', { class: 'quest-name' }, quest.name),
          h('span', { class: `quest-state ${state.tone}` }, state.label)
        ),
        h('p', { class: 'quest-text' }, quest.text),
        h(
          'div',
          { class: 'quest-giver' },
          `${name} · ${questChapterLabel(quest)} · reward ${quest.rewardEchoes} echoes${quest.rewardItem ? ' + a relic' : ''}`
        ),
        h(
          'div',
          { class: 'quest-progress' },
          h('span', { class: 'quest-bar' }, h('span', { style: `width:${pct}%` })),
          h(
            'span',
            { class: 'quest-numbers' },
            `${Math.min(view.progress, quest.target)}/${quest.target}`
          )
        ),
        bonus
          ? h(
              'div',
              { class: 'quest-bonus' },
              h('span', { class: 'quest-bonus-label' }, `Bonus +${bonus.echoes} echoes`),
              h('span', { class: 'quest-bar bonus' }, h('span', { style: `width:${bonusPct}%` })),
              h(
                'span',
                { class: 'quest-numbers' },
                `${Math.min(raw, bonus.target)}/${bonus.target}`
              )
            )
          : null,
        view.claimed
          ? null
          : h(
              'div',
              { class: 'quest-actions' },
              button(
                opts.trackedQuest === quest.id ? 'Untrack' : 'Track',
                () => opts.onTrack(opts.trackedQuest === quest.id ? null : quest.id),
                'btn small'
              )
            )
      )
    );
  };

  const section = (key: string, label: string, items: View[]): HTMLElement =>
    h(
      'section',
      { class: 'quest-section', 'data-section': key },
      h(
        'div',
        { class: 'quest-section-head' },
        h('span', {}, label),
        h('span', { class: 'quest-count' }, `${items.length}`)
      ),
      ...(items.length > 0
        ? items.map((view) => card(view))
        : [h('div', { class: 'quest-empty' }, 'Nothing here yet.')])
    );

  const dailyReady = !daily.progress.claimed && daily.progress.kills >= daily.contract.target;
  const dailyPct = Math.min(
    100,
    Math.round(
      (Math.min(daily.progress.kills, daily.contract.target) / daily.contract.target) * 100
    )
  );
  const dailyCard = h(
    'article',
    { class: `quest-card daily${dailyReady || daily.progress.claimed ? ' lit' : ''}` },
    h(
      'div',
      { class: 'quest-body' },
      h(
        'div',
        { class: 'quest-top' },
        h('span', { class: 'quest-name' }, `Daily mark · ${daily.contract.name}`),
        h(
          'span',
          {
            class: `quest-state ${daily.progress.claimed ? 'done' : dailyReady ? 'ready' : 'active'}`,
          },
          daily.progress.claimed ? 'Claimed' : dailyReady ? 'Ready to claim' : 'Hunting'
        )
      ),
      h(
        'p',
        { class: 'quest-text' },
        `Put down ${daily.contract.target} ${daily.contract.name.toLowerCase()} before the day turns. Same mark for everyone.`
      ),
      h(
        'div',
        { class: 'quest-giver' },
        `Reward ${daily.contract.reward} echoes · resets with the day`
      ),
      h(
        'div',
        { class: 'quest-progress' },
        h('span', { class: 'quest-bar' }, h('span', { style: `width:${dailyPct}%` })),
        h(
          'span',
          { class: 'quest-numbers' },
          `${Math.min(daily.progress.kills, daily.contract.target)}/${daily.contract.target}`
        )
      ),
      dailyReady
        ? h(
            'div',
            { class: 'gear-actions' },
            button('Claim the mark', opts.onClaimDaily, 'btn small primary')
          )
        : null
    )
  );

  const weeklyReady =
    !opts.weekly.progress.claimed && opts.weekly.progress.kills >= opts.weekly.contract.target;
  const weeklyPct = Math.min(
    100,
    Math.round(
      (Math.min(opts.weekly.progress.kills, opts.weekly.contract.target) /
        opts.weekly.contract.target) *
        100
    )
  );
  const weeklyCard = h(
    'article',
    { class: `quest-card weekly${weeklyReady || opts.weekly.progress.claimed ? ' lit' : ''}` },
    h(
      'div',
      { class: 'quest-body' },
      h(
        'div',
        { class: 'quest-top' },
        h('span', { class: 'quest-name' }, `Weekly contract · ${opts.weekly.contract.name}`),
        h(
          'span',
          {
            class: `quest-state ${opts.weekly.progress.claimed ? 'done' : weeklyReady ? 'ready' : 'active'}`,
          },
          opts.weekly.progress.claimed ? 'Claimed' : weeklyReady ? 'Ready to claim' : 'Hunting'
        )
      ),
      h(
        'p',
        { class: 'quest-text' },
        `Hunt ${opts.weekly.contract.target} ${opts.weekly.contract.name.toLowerCase()} before the week turns. The same contract for everyone.`
      ),
      h(
        'div',
        { class: 'quest-giver' },
        `Reward ${opts.weekly.contract.reward} echoes · resets with the ISO week`
      ),
      h(
        'div',
        { class: 'quest-progress' },
        h('span', { class: 'quest-bar' }, h('span', { style: `width:${weeklyPct}%` })),
        h(
          'span',
          { class: 'quest-numbers' },
          `${Math.min(opts.weekly.progress.kills, opts.weekly.contract.target)}/${opts.weekly.contract.target}`
        )
      ),
      weeklyReady
        ? h(
            'div',
            { class: 'gear-actions' },
            button('Claim the contract', opts.weekly.onClaim, 'btn small primary')
          )
        : null
    )
  );

  const tabs: Array<{ key: string; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'ready', label: 'Ready' },
    { key: 'available', label: 'Available' },
    { key: 'done', label: 'Completed' },
  ];
  const tabButtons: HTMLButtonElement[] = [];
  const el = h(
    'div',
    { class: 'screen clear hub quest-log' },
    h('div', { class: 'heading' }, 'Quest Log'),
    h(
      'div',
      { class: 'subtitle' },
      `${active.length} active · ${ready.length} ready · ${done.length} completed · ${available.length} available`
    ),
    h(
      'div',
      { class: 'quest-tabs' },
      ...tabs.map((tab) => {
        const b = button(tab.label, () => show(tab.key), 'btn small quest-tab');
        tabButtons.push(b);
        return b;
      })
    ),
    dailyCard,
    weeklyCard,
    section('active', 'In progress', active),
    section('ready', 'Ready to claim', ready),
    section('available', 'Available from residents', available),
    section('done', 'Completed', done),
    h('div', { class: 'menu' }, button('Back', onBack, 'btn primary'))
  );
  function show(view: string): void {
    el.querySelectorAll<HTMLElement>('.quest-section').forEach((node) => {
      const sectionKey = node.getAttribute('data-section');
      node.classList.toggle('hidden', view !== 'all' && sectionKey !== view);
    });
    tabButtons.forEach((b, index) => b.classList.toggle('active', tabs[index].key === view));
  }
  show('all');
  return el;
}

/** What a shop line's button says, and whether the line can be bought right now. */
export function shopLineState(
  item: ShopItem,
  shards: number,
  healthFlasks: number,
  maxHealthFlasks: number
): { label: string; disabled: boolean } {
  const flasksFull = item.id === 'health' && healthFlasks >= maxHealthFlasks;
  return {
    label: item.sold ? 'Sold' : flasksFull ? 'Flasks full' : `${item.cost} shards`,
    disabled: item.sold || flasksFull || shards < item.cost,
  };
}

/** A maze merchant's stall: consumables and one relic, priced in shards. */
export function shopScreen(opts: {
  stock: readonly ShopItem[];
  shards: number;
  healthFlasks: number;
  maxHealthFlasks: number;
  onBuy: (id: ShopItemId) => void;
  onClose: () => void;
}): HTMLElement {
  const rows = opts.stock.map((item) => {
    const line = shopLineState(item, opts.shards, opts.healthFlasks, opts.maxHealthFlasks);
    const buy = button(line.label, () => opts.onBuy(item.id), 'btn small primary');
    buy.disabled = line.disabled;
    return h(
      'div',
      { class: `shop-row${item.sold ? ' sold' : ''}` },
      h(
        'div',
        { class: 'shop-copy' },
        h('div', { class: 'gear-name' }, item.name),
        h('div', { class: 'gear-note' }, item.detail)
      ),
      buy
    );
  });
  return h(
    'div',
    { class: 'screen hub' },
    h('div', { class: 'subtitle' }, 'A merchant at the edge of the maze'),
    h('div', { class: 'title small' }, 'Wares for shards'),
    h(
      'div',
      { class: 'meta-line' },
      `You carry ${opts.shards} shard${opts.shards === 1 ? '' : 's'}.`
    ),
    opts.stock.length > 0
      ? h('div', { class: 'shop-grid' }, ...rows)
      : h('div', { class: 'panel' }, 'The stall is bare.'),
    h('div', { class: 'menu' }, button('Leave the stall', opts.onClose, 'btn primary'))
  );
}

export function pauseScreen(opts: {
  onResume: () => void;
  onSettings: () => void;
  onControls: () => void;
  onQuests: () => void;
  onAbandon: () => void;
  world?: World;
}): HTMLElement {
  return h(
    'div',
    { class: 'screen' },
    h('div', { class: 'heading' }, 'Paused'),
    opts.world ? pauseSummary(opts.world) : null,
    h(
      'div',
      { class: 'menu' },
      button('Resume', opts.onResume, 'btn primary'),
      button('Quests', opts.onQuests),
      button('Settings', opts.onSettings),
      button('Controls', opts.onControls),
      confirmButton('Abandon Run', 'Confirm abandon', opts.onAbandon)
    )
  );
}

/** Where the player stands this run, shown while paused. */
function pauseSummary(world: World): HTMLElement {
  const run = world.run;
  const owned = Object.entries(run.player.upgrades).filter(([, n]) => n > 0);
  return h(
    'div',
    { class: 'panel pause-panel' },
    h('div', { class: 'pause-objective' }, objectiveSummary(world)),
    runStats(run),
    owned.length > 0
      ? h(
          'div',
          { class: 'echoes' },
          ...owned.map(([id, count]) => {
            // Old saves may name an upgrade that no longer exists; never let
            // the pause screen fail because of one unknown chip.
            let name = id.replace(/_/g, ' ');
            try {
              name = upgradeDef(id).name;
            } catch {
              /* keep the readable fallback */
            }
            return h('span', { class: 'echo-chip' }, `${name}${count > 1 ? ` x${count}` : ''}`);
          })
        )
      : h('div', { class: 'meta-line' }, 'No echoes gathered yet')
  );
}

/** One line of optional-objective progress for the map and pause panels. */
function objectiveSummary(world: World): string {
  const goal = world.floorObjectives();
  if (goal.claimed) return 'Floor restored · bonus claimed';
  const parts = [`Rooms ${goal.roomsCleared}/${goal.roomsTotal}`];
  if (goal.chestFound) parts.push(`Chest ${goal.chestUsed ? 'opened' : 'unopened'}`);
  if (goal.wellFound) parts.push(`Well ${goal.wellUsed ? 'used' : 'unused'}`);
  if (goal.archiveFound) parts.push(`Archive ${goal.archiveUsed ? 'read' : 'unread'}`);
  parts.push(goal.complete ? 'bonus ready' : 'full clear for a bonus');
  return parts.join('  ·  ');
}

const SOURCE_TITLES: Record<UpgradeChoice['source'], string> = {
  level: 'Choose an Echo',
  chest: 'The Chest Remembers',
  shrine: 'The Well Answers',
  wayfarer: 'The Wayfarer Remembers',
};

function upgradeEmblem(id: string): string {
  if (
    id.includes('health') ||
    id === 'vitality' ||
    id === 'armor' ||
    id === 'lifesteal' ||
    id === 'potion_capacity'
  )
    return 'sprites/ui/health.png';
  if (id.includes('mana') || id.includes('bolt') || id === 'channel' || id === 'flow')
    return 'sprites/ui/mana.png';
  if (id.includes('dash') || id === 'swift') return 'sprites/ui/stamina.png';
  if (id === 'shockwave' || id === 'surge') return 'sprites/ui/weapon_greatsword.png';
  if (id === 'bolt_pierce' || id === 'dash_strike') return 'sprites/ui/weapon_spear.png';
  if (id === 'magnet') return 'sprites/ui/fragment_shard.png';
  if (id === 'edge' || id === 'haste' || id === 'precision') return 'sprites/ui/weapon_sword.png';
  return 'sprites/ui/memory_fragment.png';
}

export function choiceScreen(
  choice: UpgradeChoice,
  taken: Record<string, number>,
  onPick: (id: string) => void,
  reroll?: { cost: number; shards: number; onReroll: () => void }
): { el: HTMLElement; onKey: (e: KeyboardEvent) => void } {
  const cards = choice.options.map((id, i) => {
    const def = upgradeDef(id);
    const count = taken[id] ?? 0;
    const emblem = upgradeEmblem(id);
    return h(
      'button',
      { class: `card ${def.rarity}`, type: 'button' },
      h('div', { class: 'num' }, `${i + 1}`),
      h('div', { class: 'rarity' }, def.rarity),
      h(
        'div',
        { class: 'card-emblem' },
        h('img', { src: assetUrl(emblem), alt: def.name, class: 'card-emblem-icon' })
      ),
      h('div', { class: 'name' }, def.name),
      h('div', { class: 'desc' }, def.description),
      h(
        'div',
        { class: 'stacks' },
        def.maxStacks > 1 ? `${count} / ${def.maxStacks}` : count > 0 ? 'Owned' : 'Unique'
      )
    );
  });
  // A level-up lands on top of a fight, so its cards must not be taken by the
  // click that was already swinging. One deliberate click takes a card: the
  // screen arms after a grace, ignores double-clicks, and a mouse click only
  // counts once the pointer has travelled toward a card (or after a long,
  // stationary pause). Keyboard digits and gamepad confirm bypass the guard.
  const openedAt = performance.now();
  let pointerTravel = 0;
  let entry: { x: number; y: number } | null = null;
  let lastPointer = 'mouse';
  const pick = (id: string): void => {
    onPick(id);
  };
  cards.forEach((card, index) =>
    card.addEventListener('click', (event) => {
      if (event.button !== 0) return;
      if (!deliberateClick(event.detail)) return;
      const now = performance.now();
      const touch = lastPointer === 'touch';
      const armed = touch ? now - openedAt >= 550 : choiceArmed(now, openedAt, pointerTravel);
      if (!armed) return;
      pick(choice.options[index]);
    })
  );
  const affordable = !!reroll && reroll.shards >= reroll.cost;
  const rerollButton =
    reroll && choice.options.length > 0
      ? button(`Reroll · ${reroll.cost} shards`, () => reroll.onReroll(), 'btn reroll')
      : null;
  if (rerollButton) rerollButton.disabled = !affordable;
  const el = h(
    'div',
    { class: 'screen' },
    h('div', { class: 'heading' }, SOURCE_TITLES[choice.source]),
    h('div', { class: 'cards' }, ...cards),
    rerollButton ? h('div', { class: 'menu reroll-menu' }, rerollButton) : null,
    h(
      'div',
      { class: 'meta-line' },
      rerollButton ? 'Click a card · 1 / 2 / 3 · R rerolls' : 'Click a card · 1 / 2 / 3'
    )
  );
  el.addEventListener('pointerdown', (event) => {
    lastPointer = event.pointerType;
  });
  el.addEventListener('pointermove', (event) => {
    if (!entry) entry = { x: event.clientX, y: event.clientY };
    pointerTravel = Math.max(
      pointerTravel,
      Math.hypot(event.clientX - entry.x, event.clientY - entry.y)
    );
  });
  // The canvas treats a right press as the bolt; inside the choice screen it
  // must never flash the browser context menu or re-trigger combat input.
  el.addEventListener('contextmenu', (event) => event.preventDefault());
  const onKey = (e: KeyboardEvent): void => {
    const index = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
    if (index >= 0 && choice.options[index]) pick(choice.options[index]);
    // Ignore auto-repeat so holding R cannot spend several rerolls at once.
    if (e.code === 'KeyR' && !e.repeat && reroll && affordable && choice.options.length > 0)
      reroll.onReroll();
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
      'Section reached',
      `${run.depth + 1} · ${(() => {
        const plan = FLOOR_PLANS[Math.min(run.depth, FLOOR_PLANS.length - 1)];
        return plan.trialName ?? biomeInfo(plan.biome).name;
      })()}`,
    ],
    ['Level', `${run.player.level}`],
    ['Enemies defeated', `${run.stats.kills}`],
    ['Rooms cleared', `${run.stats.roomsCleared}`],
    ['Best flow', `x${resonanceMultiplier(run.stats.bestResonance).toFixed(2)}`],
    ['Near misses', `${run.stats.grazes}`],
    ['Loot surges', `${run.stats.surges}`],
    ['Floors restored', `${run.stats.floorsRestored}`],
    ['Memories recovered', `${run.fragmentsFound.length}`],
    ['Time', minutes(run.stats.elapsed)],
  ];
  return h(
    'dl',
    { class: 'stats' },
    ...rows.flatMap(([k, v], i) => [
      h('dt', { style: `--i:${i}` }, k),
      h('dd', { style: `--i:${i}` }, v),
    ])
  );
}

/** One settled run's legacy: score, best and freshly earned feats. */
function legacyLines(score: number, best: number, newFeats: readonly FeatDef[]): HTMLElement[] {
  const rows: HTMLElement[] = [
    h('div', { class: 'legacy-score' }, `Score ${score}`, h('span', {}, ` · best ${best}`)),
  ];
  if (newFeats.length > 0)
    rows.push(
      h(
        'div',
        { class: 'legacy-feats' },
        h('span', { class: 'gear-name' }, 'Feats earned: '),
        ...newFeats.flatMap((feat, i) => [
          ...(i > 0 ? [h('span', {}, ' · ')] : []),
          h('span', { class: 'feat unlocked', title: feat.text }, feat.name),
        ])
      )
    );
  return rows;
}

export function deathScreen(
  run: RunState,
  opts: {
    echoes: number;
    score: number;
    best: number;
    newFeats: readonly FeatDef[];
    checkpoint: number;
    onRetry: () => void;
    onBeginning: () => void;
    onSanctuary: () => void;
  }
): HTMLElement {
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
    h(
      'div',
      { class: 'panel stats-panel' },
      runStats(run),
      ...legacyLines(opts.score, opts.best, opts.newFeats)
    ),
    run.deathRoom !== undefined || run.deathSection !== undefined
      ? h(
          'div',
          { class: 'meta-line' },
          `Fell${run.deathRoom ? ` in the ${run.deathRoom} room` : ''}${
            run.deathSection !== undefined ? ` · Section ${run.deathSection}` : ''
          }. ${
            run.bankedRelics.length > 0
              ? `The Sanctuary keeps the ${run.bankedRelics.length} relic${
                  run.bankedRelics.length === 1 ? '' : 's'
                } you banked at the last checkpoint; what you found after it is lost.`
              : 'Nothing was banked since the last checkpoint, so the relics you carried are lost.'
          }`
        )
      : null,
    h('div', { class: 'echo-earned' }, `Echoes banked · +${opts.echoes}`),
    h(
      'div',
      { class: 'menu' },
      button('Return to Sanctuary', opts.onSanctuary, 'btn primary'),
      button(`Retry from Section ${opts.checkpoint}`, opts.onRetry),
      button('Start from the Beginning', opts.onBeginning)
    )
  );
}

export function victoryScreen(
  run: RunState,
  opts: {
    echoes: number;
    score: number;
    best: number;
    victories: number;
    newFeats: readonly FeatDef[];
    onSanctuary: () => void;
  }
): HTMLElement {
  // Run epilogue (cyberpulse ADR-012): the ending reads back how many dawns
  // the walker has already brought home.
  const epilogue =
    opts.victories <= 1
      ? 'The first dawn. The First Memory writes it down twice, in case.'
      : opts.victories <= 4
        ? `Dawn number ${opts.victories}. The Sanctuary lights a lamp for each one now.`
        : `Dawn number ${opts.victories}. Walkers tell the story of the one who kept winning.`;
  return h(
    'div',
    { class: 'screen' },
    h('div', { class: 'title' }, 'The World Remembers'),
    h('div', { class: 'subtitle' }, 'The First Memory is remembered. The world begins again.'),
    h('div', { class: 'meta-line' }, epilogue),
    h(
      'div',
      { class: 'panel stats-panel' },
      runStats(run),
      ...legacyLines(opts.score, opts.best, opts.newFeats)
    ),
    h('div', { class: 'echo-earned' }, `Echoes banked · +${opts.echoes}`),
    h('div', { class: 'menu' }, button('Return to Sanctuary', opts.onSanctuary, 'btn primary'))
  );
}

export function memoriesScreen(owned: readonly string[], onBack: () => void): HTMLElement {
  const have = new Set(owned);
  const cores = CORE_MEMORIES.map((core) => {
    const found = core.fragments.filter((f) => have.has(f));
    const complete = found.length === core.fragments.length;
    const fragments = core.fragments.map((id) => {
      const fragment = MEMORY_FRAGMENTS.find((f) => f.id === id);
      return have.has(id) && fragment
        ? h('div', { class: 'frag found' }, `"${fragment.text}"`)
        : h('div', { class: 'frag sealed' }, '· · ·');
    });
    return h(
      'div',
      { class: complete ? 'memory complete' : 'memory' },
      h(
        'div',
        { class: 'memory-head' },
        h(
          'h5',
          { class: complete ? '' : 'locked' },
          complete ? core.title : `${core.title}  (${found.length}/${core.fragments.length})`
        ),
        h(
          'span',
          {
            class: 'memory-pips',
            role: 'img',
            'aria-label': `${found.length} of ${core.fragments.length} recovered`,
          },
          ...core.fragments.map((id) => h('i', { class: have.has(id) ? 'pip on' : 'pip' }))
        )
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

/** Class list for a difficulty option: only the selected one is the primary button. */
export function difficultyButtonClass(
  selected: Settings['difficulty'],
  value: Settings['difficulty']
): string {
  return selected === value ? 'btn small primary' : 'btn small';
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
  const checkbox = (
    label: string,
    hint: string,
    key: 'screenShake' | 'damageNumbers' | 'autoPause' | 'screenFlash'
  ): HTMLElement => {
    const box = h('input', { type: 'checkbox' });
    box.checked = current[key];
    box.addEventListener('change', () => {
      current[key] = box.checked;
      onChange({ ...current });
    });
    return h('label', { class: 'setting' }, label, box, h('span', { class: 'setting-hint' }, hint));
  };
  const difficulties: Array<Settings['difficulty']> = ['story', 'normal', 'nightmare'];
  const difficultyHints: Record<Settings['difficulty'], string> = {
    story: 'Softer enemies, harder walker.',
    normal: 'The deep as remembered.',
    nightmare: '+35% incoming, tougher hides, more elites.',
  };
  const difficultyButtons: Array<[Settings['difficulty'], HTMLButtonElement]> = [];
  /** The screen is built once and never re-rendered, so the highlight must move in place. */
  const syncDifficulty = (): void => {
    for (const [value, btn] of difficultyButtons) {
      const chosen = current.difficulty === value;
      btn.className = difficultyButtonClass(current.difficulty, value);
      btn.setAttribute('aria-pressed', chosen ? 'true' : 'false');
      btn.title = difficultyHints[value];
    }
  };
  return h(
    'div',
    { class: 'screen' },
    h('div', { class: 'heading' }, 'Settings'),
    h('div', { class: 'subtitle' }, 'Difficulty applies to the next expedition you set out on.'),
    h(
      'div',
      { class: 'panel' },
      slider('Master volume', 'masterVolume'),
      slider('Music', 'musicVolume'),
      slider('Effects', 'sfxVolume'),
      h(
        'div',
        { class: 'setting' },
        h('span', {}, 'Difficulty'),
        h(
          'div',
          { class: 'setting-options' },
          ...difficulties.map((d) => {
            const b = button(
              d[0].toUpperCase() + d.slice(1),
              () => {
                current.difficulty = d;
                syncDifficulty();
                onChange({ ...current });
              },
              difficultyButtonClass(current.difficulty, d)
            );
            b.setAttribute('aria-pressed', current.difficulty === d ? 'true' : 'false');
            b.title = difficultyHints[d];
            difficultyButtons.push([d, b]);
            return b;
          })
        )
      ),
      checkbox('Screen shake', 'Camera kick on hits and blasts.', 'screenShake'),
      checkbox('Damage numbers', 'Floating hit amounts in combat.', 'damageNumbers'),
      checkbox('Hurt flash', 'Red screen edge when wounded.', 'screenFlash'),
      checkbox('Auto-pause', 'Pause when the tab hides or loses focus.', 'autoPause')
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
    ['R', 'Drink a mana flask (touch: Mana)'],
    ['E / F', 'Interact: chests, wells, levers, fountains, NPCs, merchants, the gate (Y)'],
    ['1 / 2 / 3', 'Switch weapon: sword, spear, greatsword'],
    ['I', 'Relics and supplies: equip, swap, discard'],
    ['G / T', 'Throw a bomb / place a trap (hurts everyone)'],
    ['V', 'Stance weapon art (7s cooldown)'],
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
      [
        'Red shapes warn of an attack, and floor traps warn before they spring — dash through the edge for a Graze, or pull the lever to disarm a room. Barrels and bombs explode when struck, crates and urns spill shards, and a shattered memory crystal sears nearby echoes. A blast lights nearby breakables, so clusters cook off in a chain. Your own trap does not care whose feet find it. Three stances trade reach, width and speed; bosses leave relics. Hollow selves and rime duellists fight like you: three-swing combos, closing dashes and thin bolts. The Mirror of Self waits at the end of the road, wearing your stance. In the Sanctuary, structures rebuild with echoes, NPCs give tasks, the Training Yard sets your stance, the Meditation Stone grants a boon, and the Notice Board lists quests. Upgrade cards ignore the swing click and double-clicks; a deliberate click or 1 / 2 / 3 takes a card, and R rerolls.',
      ].join('')
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
      `Section ${world.run.depth + 1} · ${world.plan.trialName ?? biomeInfo(world.plan.biome).name}`
    ),
    canvas,
    h('div', { class: 'meta-line' }, objectiveSummary(world)),
    h(
      'div',
      { class: 'meta-line map-legend' },
      'White: you  ·  Violet: explored / archive  ·  Gold: chest / merchant  ·  Cyan: well / fountain  ·  Amber: disarm lever  ·  Red: guardian  ·  Orange: arena  ·  Crimson hatch: reinforcement gate  ·  Pale diamond: floor exit'
    ),
    h('div', { class: 'menu' }, button('Close', onClose))
  );
}

export function floorBanner(depth: number, name: string): HTMLElement {
  // A fast restart must not stack two cinematic banners on top of each other.
  document.querySelectorAll('.banner').forEach((old) => old.remove());
  const el = h(
    'div',
    { class: 'banner' },
    h('div', { class: 'depth' }, `SECTION ${depth + 1}`),
    h('div', { class: 'name' }, name)
  );
  window.setTimeout(() => el.remove(), 3000);
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
