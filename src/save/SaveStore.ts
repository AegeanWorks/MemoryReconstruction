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
import { MODIFIER_DEFS, restoreRun, type RunState } from '../sim/run';

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

const SettingsSchema = z.object({
  masterVolume: z.number().min(0).max(1).default(DEFAULT_SETTINGS.masterVolume),
  musicVolume: z.number().min(0).max(1).default(DEFAULT_SETTINGS.musicVolume),
  sfxVolume: z.number().min(0).max(1).default(DEFAULT_SETTINGS.sfxVolume),
  screenShake: z.boolean().default(DEFAULT_SETTINGS.screenShake),
  difficulty: z.enum(['story', 'normal', 'nightmare']).default('normal'),
  damageNumbers: z.boolean().default(true),
  autoPause: z.boolean().default(true),
  screenFlash: z.boolean().default(true),
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
  /** Lifetime kills, used by NPC quests. */
  kills: z.number().int().min(0).default(0),
  bossKills: z.number().int().min(0).default(0),
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
  quests: z
    .object({
      accepted: z.array(z.string()).default([]),
      claimed: z.array(z.string()).default([]),
      acceptedAt: z.record(z.string(), z.number().int().min(0)).default({}),
    })
    .default({ accepted: [], claimed: [], acceptedAt: {} }),
  /** Long-term NPC relationships, 0-3 hearts each (see trustLevel). */
  trust: z.record(z.string(), z.number().int().min(0).max(3)).default({}),
  /** NPC ids whose full-trust parting gift has already been given. */
  trustGifted: z.array(z.string()).default([]),
  /** Daily bounty progress; keyed so a new day starts clean. */
  dailyBounty: z
    .object({
      key: z.string().default(''),
      kills: z.number().int().min(0).default(0),
      claimed: z.boolean().default(false),
    })
    .default({ key: '', kills: 0, claimed: false }),
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
  daily: z
    .object({
      best: z.record(z.string(), z.number().int().min(0)).default({}),
      streak: z.number().int().min(0).default(0),
      bestStreak: z.number().int().min(0).default(0),
      lastKey: z.string().default(''),
    })
    .default({ best: {}, streak: 0, bestStreak: 0, lastKey: '' }),
  settings: SettingsSchema.default(DEFAULT_SETTINGS),
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
    kills: 0,
    bossKills: 0,
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
    dailyBounty: { key: '', kills: 0, claimed: false },
    vault: [],
    attunedRelic: null,
    offerings: 0,
    relicRanks: {},
    quests: { accepted: [], claimed: [], acceptedAt: {} },
    settings: { ...DEFAULT_SETTINGS },
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

export class SaveStore {
  constructor(private readonly storage: KeyValueStore | undefined = browserStorage()) {}

  private read(key: string): unknown {
    try {
      const raw = this.storage?.getItem(key);
      return raw ? (JSON.parse(raw) as unknown) : undefined;
    } catch {
      return undefined;
    }
  }

  private write(key: string, value: unknown): boolean {
    try {
      this.storage?.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  loadMeta(): Meta {
    const parsed = MetaSchema.safeParse(this.read(META_KEY));
    if (!parsed.success) return defaultMeta();
    return dropPhantomRelics(parsed.data);
  }

  saveMeta(meta: Meta): boolean {
    return this.write(META_KEY, meta);
  }

  loadRun(): RunState | undefined {
    return restoreRun(this.read(RUN_KEY));
  }

  hasRun(): boolean {
    return this.loadRun() !== undefined;
  }

  saveRun(run: RunState): boolean {
    return this.write(RUN_KEY, run);
  }

  clearRun(): void {
    try {
      this.storage?.removeItem(RUN_KEY);
    } catch {
      // Nothing to clear when storage is unavailable.
    }
  }
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
