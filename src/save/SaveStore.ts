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
import { checkpointForDepth, echoesEarned } from '../sim/hub';
import { restoreRun, type RunState } from '../sim/run';

const META_KEY = 'memory-reconstruction.meta.v1'; // aikit:allow-secret
const RUN_KEY = 'memory-reconstruction.run.v1';

const SettingsSchema = z.object({
  masterVolume: z.number().min(0).max(1),
  musicVolume: z.number().min(0).max(1),
  sfxVolume: z.number().min(0).max(1),
  screenShake: z.boolean(),
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
  /** Permanent starting relics earned from quests (equipment def ids). */
  vault: z.array(z.string()).default([]),
  quests: z
    .object({
      accepted: z.array(z.string()).default([]),
      claimed: z.array(z.string()).default([]),
    })
    .default({ accepted: [], claimed: [] }),
  settings: SettingsSchema,
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
    vault: [],
    quests: { accepted: [], claimed: [] },
    settings: { masterVolume: 0.8, musicVolume: 0.5, sfxVolume: 0.8, screenShake: true },
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
    return parsed.success ? parsed.data : defaultMeta();
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
 * Adds a run's fragments, echoes and checkpoint into the meta progress (pure).
 * Half of the shards still in hand become echoes, so spending at a well is a
 * real trade against what the Sanctuary keeps.
 */
export function recordRun(meta: Meta, run: RunState, won: boolean): Meta {
  const fragments = Array.from(new Set([...meta.fragments, ...run.fragmentsFound]));
  return {
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
}
