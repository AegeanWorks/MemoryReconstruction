/**
 * Persistent state in localStorage.
 *
 * - Meta progress survives every run: memory fragments recovered, records
 *   and settings. Fragments are kept even when a run ends in death; that is
 *   the game's long-term progression.
 * - The run snapshot is written at the start of each floor, so "Continue"
 *   resumes at that floor's entrance.
 *
 * Storage can be missing (private mode) or full; every access is guarded and
 * the game keeps working without persistence.
 */
import { z } from 'zod';
import { equipmentExists } from '../sim/equipment';
import { checkpointForDepth, echoesEarned } from '../sim/hub';
import { evaluateFeats, scoreRun } from '../sim/feats';
import { MODIFIER_DEFS, carriedRelicIds, restoreRun, type RunState } from '../sim/run';

const META_KEY = 'memory-reconstruction.meta.v1'; // aikit:allow-secret
const RUN_KEY = 'memory-reconstruction.run.v1';

const DEFAULT_SETTINGS = {
  masterVolume: 0.8,
  musicVolume: 0.5,
  sfxVolume: 0.8,
  screenShake: true,
  difficulty: 'normal' as const,
  damageNumbers: true,
  autoPause: true,
  screenFlash: true,
};

/** True when the player asked their operating system to reduce motion. */
function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * First-run settings. A player who asked their OS to reduce motion starts with the camera
 * shake and hurt flash already off, and can turn either back on in Settings. A stored save
 * always wins, so nobody's existing choice changes.
 */
export function defaultSettings(): Settings {
  const calm = prefersReducedMotion();
  return { ...DEFAULT_SETTINGS, screenShake: !calm, screenFlash: !calm };
}

const SettingsSchema = z.object({
  masterVolume: z.number().min(0).max(1).default(DEFAULT_SETTINGS.masterVolume),
  musicVolume: z.number().min(0).max(1).default(DEFAULT_SETTINGS.musicVolume),
  sfxVolume: z.number().min(0).max(1).default(DEFAULT_SETTINGS.sfxVolume),
  // Lazy defaults, so a save that predates these fields still picks up the OS motion preference.
  screenShake: z.boolean().default(() => defaultSettings().screenShake),
  difficulty: z.enum(['story', 'normal', 'nightmare']).default('normal'),
  damageNumbers: z.boolean().default(true),
  autoPause: z.boolean().default(true),
  screenFlash: z.boolean().default(() => defaultSettings().screenFlash),
});

const QuestSchema = z.object({
  accepted: z.array(z.string()).default([]),
  claimed: z.array(z.string()).default([]),
  acceptedAt: z.record(z.string(), z.number().int().min(0)).default({}),
});

const BountySchema = z.object({
  key: z.string().default(''),
  kills: z.number().int().min(0).default(0),
  claimed: z.boolean().default(false),
});

const DailySchema = z.object({
  best: z.record(z.string(), z.number().int().min(0)).default({}),
  streak: z.number().int().min(0).default(0),
  bestStreak: z.number().int().min(0).default(0),
  lastKey: z.string().default(''),
});

const MetaSchema = z.object({
  version: z.literal(1),
  fragments: z.array(z.string()),
  runs: z.number().int().min(0),
  victories: z.number().int().min(0),
  bestDepth: z.number().int().min(0),
  // Added with the Sanctuary hub; defaults keep pre-hub saves loading.
  echoes: z.number().int().min(0).default(0),
  restorations: z.record(z.string(), z.number().int().min(0)).default({}),
  checkpoint: z.number().int().min(0).default(0),
  /** The quest pinned to the HUD tracker, if any. */
  trackedQuest: z.string().nullable().default(null),
  /** Lifetime kills, used by NPC quests. */
  kills: z.number().int().min(0).default(0),
  bossKills: z.number().int().min(0).default(0),
  eliteKills: z.number().int().min(0).default(0),
  startingWeapon: z.enum(['sword', 'spear', 'greatsword']).default('sword'),
  boon: z.enum(['vitality', 'edge', 'flow']).nullable().default(null),
  /** Playstyle aspect chosen at the Shrine. */
  aspect: z.enum(['none', 'ember', 'tide', 'stone']).default('none'),
  /** The prologue story has played; do not auto-show it again. */
  seenTutorial: z.boolean().default(false),
  /** Permanent starting relics earned from quests (equipment def ids). */
  vault: z.array(z.string()).default([]),
  /** Relic attuned at the Reliquary, equipped first when an expedition starts. */
  attunedRelic: z.string().nullable().default(null),
  /** Shard offerings banked at the Cairn, consumed by the next expedition. */
  offerings: z.number().int().min(0).max(3).default(0),
  /** Permanent reforge ranks per vault relic id. */
  relicRanks: z.record(z.string(), z.number().int().min(0).max(3)).default({}),
  quests: QuestSchema.default({ accepted: [], claimed: [], acceptedAt: {} }),
  /** Long-term NPC relationships, 0-3 hearts each (see trustLevel). */
  trust: z.record(z.string(), z.number().int().min(0).max(3)).default({}),
  /** NPC ids whose full-trust parting gift has already been given. */
  trustGifted: z.array(z.string()).default([]),
  /** NPC ids whose specific-relic request has been answered. */
  relicRequests: z.array(z.string()).default([]),
  /** Daily bounty progress; keyed so a new day starts clean. */
  dailyBounty: BountySchema.default({ key: '', kills: 0, claimed: false }),
  /** Settlement-evaluated mastery ladder; idempotent set union per run. */
  feats: z.array(z.string()).default([]),
  /** Best transparent run score across all settlements. */
  bestScore: z.number().int().min(0).default(0),
  /** Best flow streak ever held (career combo, cyberpulse ADR-012). */
  bestResonance: z.number().int().min(0).default(0),
  /** Last settled expedition, for the hub's unfinished-business reminder. */
  lastRun: z
    .object({
      depth: z.number().int().min(0),
      score: z.number().int().min(0),
      won: z.boolean(),
      feats: z.array(z.string()),
    })
    .nullable()
    .default(null),
  /**
   * Past expeditions, newest last, capped (cyberpunk ADR-012/030/035):
   * a hall-of-fame ledger and the groundwork for replaying past seeds.
   */
  runHistory: z
    .array(
      z.object({
        depth: z.number().int().min(0),
        score: z.number().int().min(0),
        won: z.boolean(),
        date: z.string(),
        seed: z.number().int().min(0).optional(),
      })
    )
    .default([]),
  /** Daily-descent retention: best score per day plus streak tracking. */
  daily: DailySchema.default({ best: {}, streak: 0, bestStreak: 0, lastKey: '' }),
  settings: SettingsSchema.default(() => defaultSettings()),
});

export type Settings = z.infer<typeof SettingsSchema>;
export type Meta = z.infer<typeof MetaSchema>;

export function defaultMeta(): Meta {
  return {
    version: 1,
    fragments: [],
    runs: 0,
    victories: 0,
    bestDepth: 0,
    echoes: 0,
    restorations: {},
    checkpoint: 0,
    trackedQuest: null,
    kills: 0,
    bossKills: 0,
    eliteKills: 0,
    startingWeapon: 'sword',
    boon: null,
    aspect: 'none',
    seenTutorial: false,
    feats: [],
    bestScore: 0,
    bestResonance: 0,
    lastRun: null,
    runHistory: [],
    daily: { best: {}, streak: 0, bestStreak: 0, lastKey: '' },
    trust: {},
    trustGifted: [],
    relicRequests: [],
    dailyBounty: { key: '', kills: 0, claimed: false },
    vault: [],
    attunedRelic: null,
    offerings: 0,
    relicRanks: {},
    quests: { accepted: [], claimed: [], acceptedAt: {} },
    settings: defaultSettings(),
  };
}

/** The subset of Storage the store needs; tests pass an in-memory map. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function browserStorage(): KeyValueStore | undefined {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}

/** Save slots a browser keeps; each holds its own progress and its own expedition. */
export const SLOT_COUNT = 3;
/** Marks an exported save file; import refuses anything without it. */
export const SAVE_FORMAT = 'memory-reconstruction-save';
const SAVE_FILE_VERSION = 1;
const INDEX_KEY = 'memory-reconstruction.slots.v1'; // aikit:allow-secret -- localStorage key name, not a credential
/** Settings belong to the player and the device, not to a playthrough, so every slot shares them. */
const SETTINGS_KEY = 'memory-reconstruction.settings.v1'; // aikit:allow-secret -- localStorage key name, not a credential
const slotMetaKey = (slot: number): string => `memory-reconstruction.slot${slot}.meta.v1`;
const slotRunKey = (slot: number): string => `memory-reconstruction.slot${slot}.run.v1`;

const IndexSchema = z.object({
  version: z.literal(1),
  active: z.number().int().min(1).max(SLOT_COUNT),
  savedAt: z.record(z.string(), z.string()).default({}),
});
type SlotIndex = z.infer<typeof IndexSchema>;

/** What the Saves screen shows for one slot. */
export interface SlotSummary {
  slot: number;
  empty: boolean;
  active: boolean;
  /** ISO time of the last write, or '' when unknown (a save moved in from before slots). */
  savedAt: string;
  echoes: number;
  runs: number;
  bestDepth: number;
  /** Sum of restoration levels across the Sanctuary. */
  restorations: number;
  fragments: number;
  hasRun: boolean;
}

export type ImportResult = { ok: true } | { ok: false; reason: string };

const isSlot = (slot: number): boolean => Number.isInteger(slot) && slot >= 1 && slot <= SLOT_COUNT;

export class SaveStore {
  /** Told about every save write: true when it was stored, false when storage refused it. */
  onWrite: ((ok: boolean) => void) | undefined;
  private opened: SlotIndex | undefined;

  constructor(
    private readonly storage: KeyValueStore | undefined = browserStorage(),
    private readonly now: () => Date = () => new Date()
  ) {}

  /** Opened on first use, not at construction, so whatever storage holds by then is migrated. */
  private get index(): SlotIndex {
    this.opened ??= this.openIndex();
    return this.opened;
  }

  get activeSlot(): number {
    return this.index.active;
  }

  private readRaw(key: string): string | undefined {
    try {
      return this.storage?.getItem(key) ?? undefined;
    } catch {
      return undefined;
    }
  }

  private read(key: string): unknown {
    const raw = this.readRaw(key);
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return undefined;
    }
  }

  private writeRaw(key: string, value: string): boolean {
    try {
      this.storage?.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  private remove(key: string): void {
    try {
      this.storage?.removeItem(key);
    } catch {
      // Nothing to remove when storage is unavailable.
    }
  }

  /**
   * Reads the slot index, or builds it. Before slots there was one save under the legacy keys; it is
   * copied into slot 1 byte for byte (so field-wise recovery still applies) and never deleted, which
   * keeps it as a backup. The index is written last: a crash before that just repeats the copy.
   */
  private openIndex(): SlotIndex {
    const parsed = IndexSchema.safeParse(this.read(INDEX_KEY));
    if (parsed.success) return parsed.data;
    const index: SlotIndex = { version: 1, active: 1, savedAt: {} };
    const legacyMeta = this.readRaw(META_KEY);
    if (legacyMeta !== undefined && this.readRaw(slotMetaKey(1)) === undefined) {
      this.writeRaw(slotMetaKey(1), legacyMeta);
      const legacyRun = this.readRaw(RUN_KEY);
      if (legacyRun !== undefined) this.writeRaw(slotRunKey(1), legacyRun);
      index.savedAt['1'] = '';
    }
    this.writeRaw(INDEX_KEY, JSON.stringify(index));
    return index;
  }

  private stamp(slot: number, ok: boolean): boolean {
    if (ok) {
      this.index.savedAt[String(slot)] = this.now().toISOString();
      this.writeRaw(INDEX_KEY, JSON.stringify(this.index));
    }
    this.onWrite?.(ok);
    return ok;
  }

  private sharedSettings(): Settings | undefined {
    const parsed = SettingsSchema.safeParse(this.read(SETTINGS_KEY));
    return parsed.success ? parsed.data : undefined;
  }

  private parseMeta(raw: unknown): Meta {
    const parsed = MetaSchema.safeParse(raw);
    return parsed.success ? dropPhantomRelics(parsed.data) : recoverMeta(raw);
  }

  loadMeta(slot = this.activeSlot): Meta {
    const meta = this.parseMeta(this.read(slotMetaKey(slot)));
    const settings = this.sharedSettings();
    return settings ? { ...meta, settings } : meta;
  }

  saveMeta(meta: Meta): boolean {
    const slot = this.activeSlot;
    const ok = this.writeRaw(slotMetaKey(slot), JSON.stringify(meta));
    if (ok) this.writeRaw(SETTINGS_KEY, JSON.stringify(meta.settings));
    return this.stamp(slot, ok);
  }

  loadRun(slot = this.activeSlot): RunState | undefined {
    return restoreRun(this.read(slotRunKey(slot)));
  }

  hasRun(slot = this.activeSlot): boolean {
    return this.loadRun(slot) !== undefined;
  }

  saveRun(run: RunState): boolean {
    const slot = this.activeSlot;
    return this.stamp(slot, this.writeRaw(slotRunKey(slot), JSON.stringify(run)));
  }

  clearRun(): void {
    this.remove(slotRunKey(this.activeSlot));
  }

  /** Makes `slot` the one every load and save uses; out-of-range numbers are ignored. */
  selectSlot(slot: number): void {
    if (!isSlot(slot)) return;
    this.index.active = slot;
    this.writeRaw(INDEX_KEY, JSON.stringify(this.index));
  }

  listSlots(): SlotSummary[] {
    return Array.from({ length: SLOT_COUNT }, (_, i) => {
      const slot = i + 1;
      const empty = this.readRaw(slotMetaKey(slot)) === undefined;
      const meta = empty ? defaultMeta() : this.loadMeta(slot);
      return {
        slot,
        empty,
        active: slot === this.activeSlot,
        savedAt: this.index.savedAt[String(slot)] ?? '',
        echoes: meta.echoes,
        runs: meta.runs,
        bestDepth: meta.bestDepth,
        restorations: Object.values(meta.restorations).reduce((sum, level) => sum + level, 0),
        fragments: meta.fragments.length,
        hasRun: !empty && this.hasRun(slot),
      };
    });
  }

  /** Empties a slot; the shared settings and the legacy backup stay. */
  deleteSlot(slot: number): void {
    if (!isSlot(slot)) return;
    this.remove(slotMetaKey(slot));
    this.remove(slotRunKey(slot));
    delete this.index.savedAt[String(slot)];
    this.writeRaw(INDEX_KEY, JSON.stringify(this.index));
  }

  /** The slot as a save file, or undefined for an empty slot. */
  exportSlot(slot: number): string | undefined {
    if (!isSlot(slot) || this.readRaw(slotMetaKey(slot)) === undefined) return undefined;
    const file = {
      format: SAVE_FORMAT,
      version: SAVE_FILE_VERSION,
      exportedAt: this.now().toISOString(),
      meta: this.loadMeta(slot),
      run: this.loadRun(slot) ?? null,
    };
    return JSON.stringify(file, null, 2);
  }

  /**
   * Replaces a slot with a save file. Unlike loading, import is strict: a file that is not a save,
   * is from a newer version, or has any damaged field is refused with a reason and the slot is left
   * as it was. The device's shared settings are kept.
   */
  importSlot(slot: number, text: string): ImportResult {
    if (!isSlot(slot)) return { ok: false, reason: `There is no slot ${slot}.` };
    let file: unknown;
    try {
      file = JSON.parse(text);
    } catch {
      return { ok: false, reason: 'This is not a save file: it is not readable JSON.' };
    }
    const head = file as {
      format?: unknown;
      version?: unknown;
      meta?: unknown;
      run?: unknown;
    } | null;
    if (!head || typeof head !== 'object' || head.format !== SAVE_FORMAT) {
      return { ok: false, reason: 'This file is not a Memory Reconstruction save.' };
    }
    if (typeof head.version !== 'number' || head.version > SAVE_FILE_VERSION) {
      return { ok: false, reason: 'This save comes from a newer version of the game.' };
    }
    const meta = MetaSchema.safeParse(head.meta);
    if (!meta.success) {
      const where = meta.error.issues[0]?.path.join('.') || 'meta';
      return { ok: false, reason: `This save is damaged (${where}).` };
    }
    const run = head.run === null || head.run === undefined ? undefined : restoreRun(head.run);
    if (head.run !== null && head.run !== undefined && !run) {
      return { ok: false, reason: 'This save is damaged (expedition).' };
    }
    const ok = this.writeRaw(slotMetaKey(slot), JSON.stringify(dropPhantomRelics(meta.data)));
    if (!ok) return { ok: false, reason: 'The browser refused to store the save; it may be full.' };
    if (run) this.writeRaw(slotRunKey(slot), JSON.stringify(run));
    else this.remove(slotRunKey(slot));
    this.stamp(slot, true);
    return { ok: true };
  }
}

/**
 * Field-wise recovery for a meta save with one bad field. A single corrupt
 * setting or history entry must not discard valid fragments, echoes, kills or
 * achievements; parse every top-level field independently, then salvage the
 * settings subfields. Unknown/absent fields keep their defaults.
 */
function recoverFields<T extends Record<string, unknown>>(
  raw: unknown,
  shape: Record<string, z.ZodTypeAny>,
  fallback: T
): T {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fallback;
  const obj = raw as Record<string, unknown>;
  const result: Record<string, unknown> = { ...fallback };
  for (const [key, schema] of Object.entries(shape)) {
    // An absent field keeps the fallback rather than the schema default: the fallback is
    // defaultSettings(), which already folds in the OS reduced-motion preference.
    if (obj[key] === undefined) continue;
    const parsed = schema.safeParse(obj[key]);
    if (parsed.success) result[key] = parsed.data;
  }
  return result as T;
}

function recoverMeta(raw: unknown): Meta {
  const base = defaultMeta();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const obj = raw as Record<string, unknown>;
  const out: Record<string, unknown> = { ...base };
  for (const key of Object.keys(MetaSchema.shape)) {
    if (key === 'version') continue;
    const schema = MetaSchema.shape[key as keyof typeof MetaSchema.shape];
    const parsed = schema.safeParse(obj[key]);
    if (parsed.success) out[key] = parsed.data;
  }
  out.settings = recoverFields(obj.settings, SettingsSchema.shape, base.settings);
  out.quests = recoverFields(obj.quests, QuestSchema.shape, base.quests);
  out.dailyBounty = recoverFields(obj.dailyBounty, BountySchema.shape, base.dailyBounty);
  out.daily = recoverFields(obj.daily, DailySchema.shape, base.daily);
  return dropPhantomRelics(out as Meta);
}

/**
 * Trust boundary for hand-edited saves: vault, attuned relic and reforge
 * ranks reference equipment defs, and every render/kit call site throws on
 * an unknown id — so the load boundary drops phantoms instead of crashing
 * the Reliquary, the Reforge, or expedition start.
 */
export function dropPhantomRelics(meta: Meta): Meta {
  const vault = meta.vault.filter((defId) => equipmentExists(defId));
  const attunedRelic =
    meta.attunedRelic && equipmentExists(meta.attunedRelic) && vault.includes(meta.attunedRelic)
      ? meta.attunedRelic
      : null;
  const relicRanks: Record<string, number> = {};
  for (const [defId, rank] of Object.entries(meta.relicRanks)) {
    if (equipmentExists(defId)) relicRanks[defId] = rank;
  }
  if (
    vault.length === meta.vault.length &&
    attunedRelic === meta.attunedRelic &&
    Object.keys(relicRanks).length === Object.keys(meta.relicRanks).length
  )
    return meta;
  return { ...meta, vault, attunedRelic, relicRanks };
}

/**
 * Adds a run's fragments, echoes and checkpoint into the meta progress (pure).
 * Half of the shards still in hand become echoes, so spending at a well is a
 * real trade against what the Sanctuary keeps.
 */
export function recordRun(meta: Meta, run: RunState, won: boolean): Meta {
  const fragments = Array.from(new Set([...meta.fragments, ...run.fragmentsFound]));
  // Checkpoints bank the carried relics; a victor brings home everything still
  // carried, while a death keeps only what the last checkpoint stored.
  const carried = won ? carriedRelicIds(run) : run.bankedRelics;
  const vault = Array.from(
    new Set([...meta.vault, ...carried.filter((defId) => equipmentExists(defId))])
  );
  const next: Meta = {
    ...meta,
    fragments,
    runs: meta.runs + 1,
    victories: meta.victories + (won ? 1 : 0),
    bestDepth: Math.max(meta.bestDepth, run.depth + 1),
    echoes: meta.echoes + echoesEarned(run, won),
    checkpoint: Math.max(meta.checkpoint, checkpointForDepth(run.depth)),
    kills: meta.kills + run.stats.kills,
    bossKills: meta.bossKills + run.stats.bossKills,
    eliteKills: meta.eliteKills + run.stats.eliteKills,
    vault,
  };
  // Feats evaluate after counters update, as a set union: re-settling the
  // same run can never farm unlocks (cyberpulse ADR-028).
  const fresh = evaluateFeats(
    {
      fragments: fragments.length,
      kills: next.kills,
      victories: next.victories,
      vaultSize: next.vault.length,
    },
    run,
    won
  );
  next.feats = Array.from(new Set([...next.feats, ...fresh]));
  const score = scoreRun(run, won).total;
  next.bestScore = Math.max(next.bestScore, score);
  next.bestResonance = Math.max(next.bestResonance, run.stats.bestResonance);
  next.lastRun = { depth: run.depth, score, won, feats: fresh };
  next.runHistory = [
    ...next.runHistory,
    { depth: run.depth, score, won, date: dailyKey(), seed: run.seed >>> 0 },
  ].slice(-12);
  next.daily = settleDaily(next.daily, run.dailyKey, score);
  return next;
}

/** ISO date of today in local time: the daily-descent key. */
export function dailyKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Date-derived seed (YYYYMMDD): the same descent for everyone, all day. */
export function dailySeed(key: string): number {
  return Number(key.replaceAll('-', '')) >>> 0;
}

/** True when `key` is exactly the calendar day after `prev` (UTC dates). */
export function isNextDay(prev: string, key: string): boolean {
  const day = 24 * 60 * 60 * 1000;
  return Date.parse(`${key}T00:00:00Z`) - Date.parse(`${prev}T00:00:00Z`) === day;
}

/**
 * Daily retention (cyberpulse ADR-029/032): per-day best score plus a streak
 * that survives same-day repeats (idempotent) and resets on a missed day.
 */
/** A date-selected twist for daily runs (cyberpulse ADR-038). */
export interface DailyModifier {
  id: string;
  name: string;
  text: string;
}

/**
 * The daily twist table. Single source of truth lives in sim/run as
 * MODIFIER_DEFS (shared with expedition omens); this alias keeps the
 * daily-UI imports stable.
 */
export const DAILY_MODIFIERS: readonly DailyModifier[] = MODIFIER_DEFS;

/** Deterministic by calendar ordinal: the same twist for everyone, all day. */
export function dailyModifier(key: string): DailyModifier {
  const day = Math.floor(Date.parse(key + 'T00:00:00Z') / 86400000);
  const idx = ((day % DAILY_MODIFIERS.length) + DAILY_MODIFIERS.length) % DAILY_MODIFIERS.length;
  return DAILY_MODIFIERS[idx];
}

export function settleDaily(
  daily: Meta['daily'],
  key: string | undefined,
  score: number
): Meta['daily'] {
  if (!key) return daily;
  const best = { ...daily.best, [key]: Math.max(daily.best[key] ?? 0, score) };
  const recent = Object.fromEntries(Object.entries(best).sort().slice(-30));
  let streak = daily.streak;
  if (daily.lastKey === key) streak = Math.max(streak, 1);
  else if (daily.lastKey && isNextDay(daily.lastKey, key)) streak += 1;
  else streak = 1;
  return {
    best: recent,
    streak,
    bestStreak: Math.max(daily.bestStreak, streak),
    lastKey: key,
  };
}
