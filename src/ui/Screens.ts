/**
 * Full-screen menus. Each builder returns an element; `Screens` shows one at
 * a time on top of the HUD.
 */
import { CORE_MEMORIES, FLOOR_PLANS, MEMORY_FRAGMENTS, biomeInfo } from '../sim/content';
import { FEATS, featProgress, type FeatDef } from '../sim/feats';
import {
  EQUIPMENT_SLOTS,
  INVENTORY_SLOTS,
  applyEquipment,
  equipmentDef,
  equipmentScore,
  relicSellShards,
  type EquipmentItem,
  type EquipmentSlot,
} from '../sim/equipment';
import {
  NPCS,
  QUESTS,
  questProgress,
  questsForNpc,
  type DailyBounty,
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
import { resonanceMultiplier, type RunState, type UpgradeChoice } from '../sim/run';
import { SANCTUARY_BUILDINGS, SANCTUARY_STATIONS } from '../sim/sanctuary';
import { computeStats, upgradeDef, type PlayerStats } from '../sim/upgrades';
import { WEAPONS, weaponDef } from '../sim/weapons';
import type { World } from '../sim/world';
import { dailyModifier, type Meta, type Settings } from '../save/SaveStore';
import { assetUrl, button, h } from './dom';
import { drawMap } from './Minimap';
import { reliquaryCaption } from './reliquary';

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
  };
  const cards = SANCTUARY_BUILDINGS.map((building) => {
    const npc = NPCS[building.id];
    const quest = questsForNpc(building.id);
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
        badge
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
        h('span', { class: 'gear-slot' }, def.slot),
        h(
          'div',
          { class: 'gear-copy' },
          h('div', { class: 'gear-name' }, def.name),
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
  if (offer instanceof HTMLButtonElement) offer.disabled = opts.meta.echoes < CAIRN_COST;
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
        : button('Choose', () => opts.onChoose(aspect.id), 'btn small')
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
      return h(
        'div',
        { class: `gear-row ${def.rarity}${rank > 0 ? ' attuned' : ''}` },
        h('span', { class: 'gear-slot' }, def.slot),
        h(
          'div',
          { class: 'gear-copy' },
          h('div', { class: 'gear-name' }, `${def.name}${rank > 0 ? ` +${rank}` : ''}`),
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
      let sellArmed = false;
      const sell = button(
        `Sell · ${price ?? 0} echoes`,
        () => {
          if (price === undefined) return;
          if (!sellArmed) {
            sellArmed = true;
            sell.textContent = 'Confirm sale';
            sell.classList.add('danger');
            window.setTimeout(() => {
              if (!sell.isConnected) return;
              sellArmed = false;
              sell.textContent = `Sell · ${price} echoes`;
              sell.classList.remove('danger');
            }, 2600);
            return;
          }
          opts.onSellRelic(defId);
        },
        'btn small'
      );
      return h(
        'div',
        { class: `gear-row ${def.rarity}${state === 'home' ? ' not-attuned' : ''}` },
        h('span', { class: 'gear-slot' }, def.slot),
        h(
          'div',
          { class: 'gear-copy' },
          h('div', { class: 'gear-name' }, def.name),
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
    { class: 'screen hub' },
    h('div', { class: 'heading' }, 'Set Out'),
    h(
      'div',
      { class: 'subtitle' },
      'Every checkpoint reached is kept. Choose where this expedition begins.'
    ),
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

/** Talking to a Sanctuary NPC, with accept/claim. */
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
  onAccept: () => void;
  onClaim: () => void;
  onTribute: () => void;
  onClose: () => void;
}): HTMLElement {
  const npc = NPCS[opts.npcId] ?? { name: 'A quiet resident', role: '', greeting: '...' };
  const quest = questsForNpc(opts.npcId);
  const ready = quest ? opts.progress >= quest.target : false;
  const portraitUrl = assetUrl(`sprites/props/npc_${opts.npcId}.png`);
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
            `${Math.min(opts.progress, quest.target)} / ${quest.target} · reward ${quest.rewardEchoes} echoes${quest.rewardItem ? ' + a relic' : ''}${
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
    h('div', { class: 'menu' }, button('Step away', opts.onClose, 'btn primary'))
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
/** Bag slot filter; module scope so it survives the re-render after every change. */
let bagFilter: 'all' | EquipmentSlot = 'all';

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

export function inventoryScreen(
  world: World,
  onClose: () => void,
  onChanged: (message?: string) => void,
  status = 'Click a carried relic to equip it, ↑↓ to browse, or sell what you will not wear.'
): HTMLElement {
  const p = world.player;
  const s = p.stats;
  const statChip = (label: string, value: string): HTMLElement =>
    h('span', { class: 'gear-stat' }, h('b', {}, value), ` ${label}`);
  const slotRows = EQUIPMENT_SLOTS.map((slot) => {
    const item = p.equipment[slot];
    const def = item ? equipmentDef(item.defId) : undefined;
    return h(
      'div',
      { class: `gear-row${def ? ` ${def.rarity}` : ''}` },
      h('span', { class: 'gear-slot' }, slot),
      h(
        'div',
        { class: 'gear-copy' },
        h('div', { class: 'gear-name' }, item ? itemName(item) : 'Empty'),
        h('div', { class: 'gear-desc' }, def?.description ?? 'No relic worn')
      ),
      def
        ? button(
            'Unequip',
            () => {
              const returned = world.unequip(slot);
              onChanged(
                returned
                  ? `${def.name} returned to the bag.`
                  : 'The bag is full. Sell or equip a carried relic first.'
              );
            },
            'btn small'
          )
        : null
    );
  });
  // Best first within each slot: the top row is usually the right choice.
  const slotOrder = (item: EquipmentItem): number =>
    EQUIPMENT_SLOTS.indexOf(equipmentDef(item.defId).slot);
  const sortedBag = [...p.inventory].sort(
    (a, b) => slotOrder(a) - slotOrder(b) || equipmentScore(b) - equipmentScore(a)
  );
  const visibleBag =
    bagFilter === 'all'
      ? sortedBag
      : sortedBag.filter((i) => equipmentDef(i.defId).slot === bagFilter);
  // Stats with the candidate swapped in, so each row can show worn → new deltas.
  const baseStats = computeStats(p.upgrades);
  const bagRows = visibleBag.map((item) => {
    const def = equipmentDef(item.defId);
    const worn = p.equipment[def.slot];
    const wornDef = worn ? equipmentDef(worn.defId) : undefined;
    const hypo = applyEquipment(baseStats, { ...p.equipment, [def.slot]: item });
    const deltas = worn
      ? (Object.keys(def.mods) as Array<keyof PlayerStats>)
          .map((key) => deltaChip(key, s[key] as number, hypo[key] as number))
          .filter((chip): chip is HTMLElement => chip !== null)
      : [];
    const equip = (): void => {
      world.equipItem(item.uid);
      onChanged(
        wornDef
          ? `Equipped ${def.name}; ${wornDef.name} returned to the bag.`
          : `Equipped ${def.name}.`
      );
    };
    const price = relicSellShards(def);
    let sellArmed = false;
    const sell = button(
      `Sell · ${price}`,
      () => {
        if (!sellArmed) {
          sellArmed = true;
          sell.textContent = 'Confirm sale';
          sell.classList.add('danger');
          window.setTimeout(() => {
            if (!sell.isConnected) return;
            sellArmed = false;
            sell.textContent = `Sell · ${price}`;
            sell.classList.remove('danger');
          }, 2600);
          return;
        }
        const gained = world.sellItem(item.uid);
        onChanged(
          gained === undefined
            ? 'That relic is no longer carried.'
            : `Sold ${def.name} for ${gained} shards.`
        );
      },
      'btn small'
    );
    sell.title = `Sell for ${price} shards`;
    let discardArmed = false;
    const discard = button(
      'Discard',
      () => {
        if (!discardArmed) {
          discardArmed = true;
          discard.textContent = 'Confirm';
          discard.classList.add('danger');
          window.setTimeout(() => {
            if (!discard.isConnected) return;
            discardArmed = false;
            discard.textContent = 'Discard';
            discard.classList.remove('danger');
          }, 2600);
          return;
        }
        const ok = world.discardItem(item.uid);
        onChanged(ok ? `Discarded ${def.name}.` : 'That relic is no longer carried.');
      },
      'btn small'
    );
    discard.title = 'Destroy this relic for nothing (frees a bag slot)';
    // Score hint: Upgrade only when the candidate beats what is worn.
    const better = !worn || equipmentScore(item) > equipmentScore(worn);
    const row = h(
      'div',
      {
        class: `gear-row clickable ${def.rarity}`,
        role: 'button',
        tabindex: '0',
        title: `Equip ${def.name}`,
      },
      h('span', { class: 'gear-slot' }, def.slot),
      h(
        'div',
        { class: 'gear-copy' },
        h('div', { class: 'gear-name' }, itemName(item)),
        h(
          'div',
          { class: 'gear-desc' },
          def.description,
          wornDef ? h('span', { class: 'gear-swap' }, ` · swaps with ${itemName(worn!)}`) : null
        ),
        deltas.length > 0 ? h('div', { class: 'gear-deltas' }, ...deltas) : null
      ),
      h(
        'div',
        { class: 'gear-actions' },
        button(worn ? (better ? 'Upgrade' : 'Swap') : 'Equip', equip, 'btn small primary'),
        sell,
        discard
      )
    );
    row.addEventListener('click', (event) => {
      if ((event.target as HTMLElement).closest('button')) return;
      equip();
    });
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        equip();
      }
    });
    return row;
  });
  const emptyRows =
    bagFilter === 'all'
      ? Array.from({ length: Math.max(0, INVENTORY_SLOTS - p.inventory.length) }, (_, index) =>
          h(
            'div',
            { class: 'gear-row empty' },
            h('span', { class: 'gear-slot' }, `${p.inventory.length + index + 1}`),
            h(
              'div',
              { class: 'gear-copy' },
              h('div', { class: 'gear-name' }, 'Empty slot'),
              h('div', { class: 'gear-desc' }, 'Relics picked up fill the next open slot.')
            )
          )
        )
      : [];
  const bagFull = p.inventory.length >= INVENTORY_SLOTS;
  const commons = p.inventory.filter((i) => equipmentDef(i.defId).rarity === 'common');
  let junkArmed = false;
  const junkButton =
    commons.length > 0
      ? (() => {
          const btn = button(
            `Sell ${commons.length} common${commons.length === 1 ? '' : 's'}`,
            () => {
              if (!junkArmed) {
                junkArmed = true;
                btn.textContent = 'Confirm sale';
                btn.classList.add('danger');
                window.setTimeout(() => {
                  if (!btn.isConnected) return;
                  junkArmed = false;
                  btn.textContent = `Sell ${p.inventory.filter((i) => equipmentDef(i.defId).rarity === 'common').length} commons`;
                  btn.classList.remove('danger');
                }, 2600);
                return;
              }
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
  const filterOptions: Array<'all' | EquipmentSlot> = ['all', ...EQUIPMENT_SLOTS];
  const filterRow = h(
    'div',
    { class: 'gear-filters' },
    ...filterOptions.map((f) => {
      const count =
        f === 'all'
          ? p.inventory.length
          : p.inventory.filter((i) => equipmentDef(i.defId).slot === f).length;
      const chip = button(`${f === 'all' ? 'All' : f} · ${count}`, () => {
        bagFilter = f;
        onChanged();
      });
      chip.className = `btn small filter-chip${bagFilter === f ? ' active' : ''}`;
      return chip;
    })
  );
  // Grouped by slot when unfiltered, so the best weapon/armor/trinket each
  // sit at the top of their own section.
  const bagSection: HTMLElement[] = [];
  if (bagFilter === 'all') {
    for (const slot of EQUIPMENT_SLOTS) {
      const group = bagRows.filter((_, i) => equipmentDef(visibleBag[i].defId).slot === slot);
      if (group.length === 0) continue;
      bagSection.push(h('div', { class: 'gear-group' }, `${slot} · best first`));
      bagSection.push(...group);
    }
  } else {
    bagSection.push(...bagRows);
  }
  if (visibleBag.length === 0) {
    bagSection.push(
      h(
        'div',
        { class: 'gear-note' },
        bagFilter === 'all'
          ? 'The bag is empty. Relics picked up fill the open slots.'
          : `No carried ${bagFilter} relics.`
      )
    );
  }
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
    h('div', { class: 'gear-title' }, 'Worn'),
    ...slotRows,
    h('div', { class: 'gear-title' }, `Carried · ${p.inventory.length}/${INVENTORY_SLOTS}`),
    filterRow,
    junkButton,
    ...bagSection,
    ...emptyRows,
    bagFull && bagRows.length > 0
      ? h('div', { class: 'gear-note' }, 'The bag is full — relics found now are sold for shards.')
      : null,
    h('div', { class: 'gear-title' }, 'Supplies'),
    h(
      'div',
      { class: 'supplies-grid' },
      supplyRow('Memory Flasks', `${p.potions}/${s.maxPotions}`, 'Q — drink'),
      supplyRow('Bombs', `${p.bombs}`, 'G — throw'),
      supplyRow('Traps', `${p.traps}`, 'T — place')
    )
  );
  // Arrow keys walk the bag rows; Enter/Space on a row still equips.
  panel.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const rows = [...panel.querySelectorAll('.gear-row.clickable')] as HTMLElement[];
    if (rows.length === 0) return;
    const current = rows.indexOf(document.activeElement as HTMLElement);
    event.preventDefault();
    const next =
      event.key === 'ArrowDown'
        ? (rows[current + 1] ?? rows[0])
        : (rows[current - 1] ?? rows[rows.length - 1]);
    next?.focus();
  });
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
      active ? 'Meditating' : 'Meditate · 20 echoes',
      () => onBuy(option.id),
      'btn small'
    );
    buy.disabled = active || meta.echoes < 20;
    return h(
      'div',
      { class: `restoration${active ? ' lit' : ''}` },
      h('div', { class: 'rest-head' }, h('span', { class: 'rest-name' }, option.name)),
      h('p', { class: 'rest-desc' }, option.text),
      buy
    );
  });
  return h(
    'div',
    { class: 'screen hub' },
    h('div', { class: 'heading' }, 'The Meditation Stone'),
    h('div', { class: 'subtitle' }, 'One boon carries into your next expedition.'),
    h('div', { class: 'hub-grid' }, ...rows),
    h('div', { class: 'menu' }, button('Back', onBack, 'btn primary'))
  );
}

/** The quest section: every task, its giver, and where it stands. */
export function questLogScreen(
  meta: Meta,
  snapshot: QuestSnapshot,
  daily: { contract: DailyBounty; progress: { kills: number; claimed: boolean } },
  opts: { onClaimDaily: () => void },
  onBack: () => void
): HTMLElement {
  const rows = QUESTS.map((quest) => {
    const accepted = meta.quests.accepted.includes(quest.id);
    const claimed = meta.quests.claimed.includes(quest.id);
    const progress = questProgress(quest, snapshot);
    const ready = accepted && !claimed && progress >= quest.target;
    const status = claimed
      ? 'Completed'
      : ready
        ? 'Ready to claim'
        : accepted
          ? 'In progress'
          : 'Available';
    const tone = claimed || ready ? ' lit' : '';
    return h(
      'div',
      { class: `restoration${tone}` },
      h(
        'div',
        { class: 'rest-head' },
        h('span', { class: 'rest-name' }, quest.name),
        h('span', { class: 'rest-level' }, status)
      ),
      h('p', { class: 'rest-desc' }, quest.text),
      h(
        'p',
        { class: 'rest-lore' },
        `${NPCS[quest.npcId]?.name ?? quest.npcId} · ${progress}/${quest.target} · ${quest.rewardEchoes} echoes${quest.rewardItem ? ' + relic' : ''}`
      )
    );
  });
  const ready = !daily.progress.claimed && daily.progress.kills >= daily.contract.target;
  const dailyCard = h(
    'div',
    { class: `restoration${ready || daily.progress.claimed ? ' lit' : ''}` },
    h(
      'div',
      { class: 'rest-head' },
      h('span', { class: 'rest-name' }, `Daily mark · ${daily.contract.name}`),
      h(
        'span',
        { class: 'rest-level' },
        daily.progress.claimed ? 'Claimed' : ready ? 'Ready to claim' : 'Hunting'
      )
    ),
    h(
      'p',
      { class: 'rest-desc' },
      `Put down ${daily.contract.target} ${daily.contract.name.toLowerCase()} before the day turns. Same mark for everyone.`
    ),
    h(
      'p',
      { class: 'rest-lore' },
      `${Math.min(daily.progress.kills, daily.contract.target)}/${daily.contract.target} · reward ${daily.contract.reward} echoes`
    ),
    ready
      ? h(
          'div',
          { class: 'gear-actions' },
          button('Claim the mark', opts.onClaimDaily, 'btn small primary')
        )
      : null
  );
  return h(
    'div',
    { class: 'screen clear hub' },
    h('div', { class: 'heading' }, 'Quests'),
    h('div', { class: 'subtitle' }, 'Talk to a resident in the Sanctuary to accept or claim.'),
    h('div', { class: 'hub-grid' }, dailyCard, ...rows),
    h('div', { class: 'menu' }, button('Back', onBack, 'btn primary'))
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
      button('Abandon Run', opts.onAbandon)
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
  // One deliberate click takes the card. The screen arms after a short grace
  // moment so the swing click that was still mid-air when the levelup fired
  // cannot spend the level, and non-primary buttons (right/bolt) are ignored.
  let armed = false;
  window.setTimeout(() => {
    armed = true;
  }, 320);
  const pick = (id: string): void => {
    if (!armed) return;
    onPick(id);
  };
  cards.forEach((card, index) =>
    card.addEventListener('click', (event) => {
      if (event.button !== 0) return;
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
  return h('dl', { class: 'stats' }, ...rows.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]));
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
          }. The Sanctuary keeps what you carried.`
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
                onChange({ ...current });
              },
              current.difficulty === d ? 'btn small primary' : 'btn small'
            );
            b.title = difficultyHints[d];
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
    ['E / F', 'Interact: chests, wells, levers, fountains, NPCs, the gate (Y)'],
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
        'Red shapes warn of an attack, and floor traps warn before they spring — dash through the edge for a Graze, or pull the lever to disarm a room. Barrels and bombs explode when struck, crates and urns spill shards, and a shattered memory crystal sears nearby echoes. A blast lights nearby breakables, so clusters cook off in a chain. Your own trap does not care whose feet find it. Three stances trade reach, width and speed; bosses leave relics. Hollow selves and rime duellists fight like you: three-swing combos, closing dashes and thin bolts. The Mirror of Self waits at the end of the road, wearing your stance. In the Sanctuary, structures rebuild with echoes, NPCs give tasks, the Training Yard sets your stance, the Meditation Stone grants a boon, and the Notice Board lists quests. Upgrade cards: 1 / 2 / 3 selects, the same number or Enter confirms, R rerolls.',
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
      'White: you  ·  Violet: explored / archive  ·  Gold: chest / merchant  ·  Cyan: well / fountain  ·  Amber: disarm lever  ·  Red: guardian  ·  Orange: arena  ·  Crimson hatch: reinforcement gate'
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
