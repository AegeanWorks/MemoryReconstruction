/**
 * Game content: typed views over the JSON data files plus the run's floor plan.
 *
 * The JSON stays the source of names, stats and lore; this module decides how
 * those records map onto the simulation (AI archetype, floor rosters, bosses).
 */
import biomesJson from '@data/biomes.json';
import enemiesJson from '@data/enemies.json';
import loreJson from '@data/lore.json';

export type BiomeId =
  | 'ruins'
  | 'forest'
  | 'caves'
  | 'crystal'
  | 'ash'
  | 'foundry'
  | 'abyss'
  | 'void'
  | 'frost'
  | 'mire'
  | 'bloom'
  | 'hive'
  | 'catacomb'
  | 'sanctuary';

/** How an enemy fights; several data behaviours share one archetype. */
export type Archetype = 'melee' | 'skirmisher' | 'caster' | 'brute' | 'boss';

export interface BiomeInfo {
  id: BiomeId;
  name: string;
  palette: {
    primary: string;
    secondary: string;
    accent: string;
    dark: string;
    light: string;
    hazard: string;
  };
}

export interface EnemyDef {
  id: string;
  name: string;
  archetype: Archetype;
  /** `behavior` value from enemies.json, kept for variant tweaks (e.g. splitter). */
  behavior: string;
  maxHealth: number;
  damage: number;
  /** Pixels per second. */
  speed: number;
  radius: number;
  aggroRange: number;
  attackRange: number;
  /** Seconds between attacks. */
  attackCooldown: number;
  xp: number;
  /** Key into sprite_atlas.json `enemies`. */
  sprite: string;
  /** Display height in pixels. */
  displayHeight: number;
  /** Optional sprite tint, so a reused sheet still reads as a new enemy. */
  tint?: number;
}

export interface FloorPlan {
  depth: number;
  biome: BiomeId;
  roster: string[];
  boss: string;
  roomCount: number;
  finale: boolean;
  /** Cell pattern for this section. */
  layout: 'branch' | 'ring' | 'spine' | 'grid' | 'diamond' | 'cross' | 'clover' | 'terrace';
  /** A boss-only episode: one arena, no trash. */
  bossOnly?: boolean;
  /** Banner title for an episode instead of the biome name. */
  trialName?: string;
}

export interface MemoryFragment {
  id: string;
  text: string;
  biome: string;
}

export interface CoreMemory {
  id: string;
  title: string;
  text: string;
  fragments: string[];
}

/** Enemy attacks hit this hard relative to enemies.json, tuned for 100 base player health. */
export const ENEMY_DAMAGE_SCALE = 0.85;
/** Floor bosses are their data record with this much more health. */
const BOSS_HEALTH_SCALE = 3.2;

const ARCHETYPES: Record<string, Archetype> = {
  chase: 'melee',
  patrol_chase: 'melee',
  territorial: 'melee',
  sound_hunter: 'melee',
  relentless: 'melee',
  hit_and_run: 'skirmisher',
  ambush: 'skirmisher',
  ranged_support: 'caster',
  splitter: 'caster',
  tank: 'brute',
  duelist: 'brute',
  storm_caller: 'caster',
  sweeper: 'caster',
  wall_warden: 'caster',
  pillar_warden: 'caster',
  bombardier: 'caster',
  boss: 'boss',
  final_boss: 'boss',
};

const SPRITE_KEYS: Record<string, string> = {
  memory_echo: 'echo',
  cave_dweller: 'caveDweller',
  crystal_golem: 'crystalGolem',
  crystal_guardian: 'crystalGuardian',
  prism_entity: 'prismEntity',
  void_walker: 'voidWalker',
  // Later sections reuse existing art until dedicated sheets exist.
  cinder_wisp: 'spirit',
  magma_hound: 'magmaHound',
  drowned: 'caveDweller',
  tide_caller: 'tideCaller',
  // The shadow sheet is near-black, so a tint cannot lift it; late mobs borrow
  // mid-tone sheets and take their colour from tint. Bosses have own sheets.
  frost_stalker: 'crystalGuardian',
  glass_sentinel: 'guardian',
  bloom_crawler: 'caveDweller',
  petal_witch: 'petalWitch',
  cog_hound: 'cogHound',
  solder_wisp: 'solderWisp',
  bog_leech: 'bogLeech',
  plague_caster: 'plagueCaster',
  bombardier: 'bombardier',
  hive_drone: 'hiveDrone',
  hive_guard: 'hiveGuard',
  catacomb_archer: 'catacombArcher',
  bone_knight: 'boneKnight',
  grave_hound: 'graveHound',
  void_cantor: 'voidCantor',
  hive_queen: 'hiveQueen',
  bone_tyrant: 'boneTyrant',
  choir_hierophant: 'choirHierophant',
  hollow_behemoth: 'hollowBehemoth',
  cinder_warden: 'cinderWarden',
  leviathan: 'leviathan',
  frost_warden: 'frostWarden',
  thorn_matriarch: 'thornMatriarch',
  forgotten: 'forgottenGiant',
  clockwork_regent: 'clockworkRegent',
  mire_sovereign: 'mireSovereign',
  ash_herald: 'ashHerald',
  cinder_hound: 'cinderHound',
  frost_oracle: 'frostOracle',
  rime_duelist: 'crystalGuardian',
  bloom_sentinel: 'guardian',
  petal_stalker: 'caveDweller',
  grave_warden: 'boneKnight',
  void_herald: 'voidCantor',
  hive_slinger: 'hiveDrone',
  mire_lurker: 'bogLeech',
};

/**
 * Late enemies share sheets with older ones, so each gets a tint that matches
 * its section (ember, deep water, ice, bloom) and stays readable in the dark.
 */
const ENEMY_TINTS: Record<string, number> = Object.fromEntries(
  Object.entries({
    // Only enemies that still borrow a shared sheet need a tint; the late mobs
    // with dedicated sheets (magma_hound, tide_caller, petal_witch, ash_herald,
    // cinder_hound, frost_oracle) carry their section colour in the art.
    cinder_wisp: 0xffb070,
    drowned: 0x8fe8dc,
    frost_stalker: 0xbfeaff,
    glass_sentinel: 0xaad8ff,
    bloom_crawler: 0xbaffc4,
    rime_duelist: 0xaad8ff,
    bloom_sentinel: 0xbaffc4,
    petal_stalker: 0xffb0e6,
    grave_warden: 0xd8d0c0,
    void_herald: 0xc0b0ff,
    hive_slinger: 0xffd090,
    mire_lurker: 0x9fd0a0,
  }).map(([id, color]) => [id, pastel(color)])
);

/** Tint is multiplicative, so dark shared sheets need a mostly-white mix. */
function pastel(color: number): number {
  const mix = (channel: number): number => Math.round(channel * 0.35 + 255 * 0.65);
  const r = mix((color >> 16) & 0xff);
  const g = mix((color >> 8) & 0xff);
  const b = mix(color & 0xff);
  return (r << 16) | (g << 8) | b;
}

export const FLOOR_PLANS: readonly FloorPlan[] = [
  {
    depth: 0,
    biome: 'ruins',
    roster: ['scavenger', 'memory_echo'],
    boss: 'guardian',
    roomCount: 7,
    finale: false,
    layout: 'branch',
  },
  {
    depth: 1,
    biome: 'forest',
    roster: ['wildling', 'scavenger', 'memory_echo'],
    boss: 'spirit',
    roomCount: 8,
    finale: false,
    layout: 'ring',
  },
  {
    depth: 2,
    biome: 'caves',
    roster: ['cave_dweller', 'shadow', 'wildling'],
    boss: 'crystal_golem',
    roomCount: 9,
    finale: false,
    layout: 'spine',
  },
  {
    depth: 3,
    biome: 'crystal',
    roster: ['prism_entity', 'shadow', 'cave_dweller'],
    boss: 'crystal_guardian',
    roomCount: 9,
    finale: false,
    layout: 'clover',
  },
  {
    depth: 4,
    biome: 'ash',
    roster: ['cinder_wisp', 'magma_hound', 'bombardier', 'ash_herald', 'cinder_hound'],
    boss: 'cinder_warden',
    roomCount: 10,
    finale: false,
    layout: 'branch',
  },
  {
    depth: 5,
    biome: 'frost',
    roster: [],
    boss: 'choir_hierophant',
    roomCount: 1,
    finale: false,
    layout: 'grid',
    bossOnly: true,
    trialName: 'Echo Trial: The Frozen Choir',
  },
  {
    depth: 6,
    biome: 'foundry',
    roster: ['cog_hound', 'solder_wisp', 'bombardier'],
    boss: 'clockwork_regent',
    roomCount: 10,
    finale: false,
    layout: 'grid',
  },
  {
    depth: 7,
    biome: 'abyss',
    roster: ['drowned', 'tide_caller', 'cinder_wisp'],
    boss: 'leviathan',
    roomCount: 10,
    finale: false,
    layout: 'ring',
  },
  {
    depth: 8,
    biome: 'void',
    roster: ['void_walker', 'prism_entity', 'shadow', 'void_cantor', 'void_herald'],
    boss: 'forgotten',
    roomCount: 11,
    finale: false,
    layout: 'spine',
  },
  {
    depth: 9,
    biome: 'frost',
    roster: ['frost_stalker', 'glass_sentinel', 'drowned', 'frost_oracle', 'rime_duelist'],
    boss: 'frost_warden',
    roomCount: 11,
    finale: false,
    layout: 'terrace',
  },
  {
    depth: 10,
    biome: 'void',
    roster: [],
    boss: 'hollow_behemoth',
    roomCount: 1,
    finale: false,
    layout: 'grid',
    bossOnly: true,
    trialName: 'Echo Trial: The Nameless',
  },
  {
    depth: 11,
    biome: 'mire',
    roster: ['bog_leech', 'plague_caster', 'drowned', 'mire_lurker'],
    boss: 'mire_sovereign',
    roomCount: 12,
    finale: false,
    layout: 'branch',
  },
  {
    depth: 12,
    biome: 'bloom',
    roster: ['bloom_crawler', 'petal_witch', 'frost_stalker', 'bloom_sentinel', 'petal_stalker'],
    boss: 'thorn_matriarch',
    roomCount: 12,
    finale: false,
    layout: 'ring',
  },
  {
    depth: 13,
    biome: 'hive',
    roster: ['hive_drone', 'hive_guard', 'cinder_wisp', 'hive_slinger'],
    boss: 'hive_queen',
    roomCount: 12,
    finale: false,
    layout: 'diamond',
  },
  {
    depth: 14,
    biome: 'catacomb',
    roster: ['bone_knight', 'catacomb_archer', 'hive_guard', 'grave_hound', 'grave_warden'],
    boss: 'bone_tyrant',
    roomCount: 13,
    finale: false,
    layout: 'cross',
  },
  {
    depth: 15,
    biome: 'sanctuary',
    roster: ['void_walker', 'memory_echo', 'prism_entity', 'void_herald'],
    boss: 'keeper',
    roomCount: 5,
    finale: true,
    layout: 'branch',
  },
];

interface RawEnemy {
  id: string;
  name: string;
  stats: { health: number; damage: number; speed: number; xpValue: number };
  ai: { behavior: string; aggroRange: number; attackRange: number; attackCooldown: number };
  hitbox: { width: number };
  sprite: { height: number };
}

const rawEnemies = (enemiesJson as { enemies: RawEnemy[] }).enemies;

function toEnemyDef(raw: RawEnemy, asBoss: boolean): EnemyDef {
  const archetype = asBoss ? 'boss' : (ARCHETYPES[raw.ai.behavior] ?? 'melee');
  return {
    id: raw.id,
    name: raw.name,
    archetype,
    behavior: raw.ai.behavior,
    maxHealth: Math.round(
      raw.stats.health * (asBoss && raw.ai.behavior !== 'final_boss' ? BOSS_HEALTH_SCALE : 1)
    ),
    damage: Math.max(4, Math.round(raw.stats.damage * ENEMY_DAMAGE_SCALE)),
    speed: raw.stats.speed,
    radius: Math.round(raw.hitbox.width / 2) * (asBoss ? 1.3 : 1),
    aggroRange: Math.max(raw.ai.aggroRange, 260),
    attackRange: raw.ai.attackRange,
    attackCooldown: raw.ai.attackCooldown,
    xp: raw.stats.xpValue,
    sprite: SPRITE_KEYS[raw.id] ?? raw.id,
    displayHeight: Math.max(48, raw.sprite.height) * (asBoss ? 1.5 : 1),
    tint: ENEMY_TINTS[raw.id],
  };
}

export function enemyDef(id: string, asBoss = false): EnemyDef {
  const raw = rawEnemies.find((e) => e.id === id);
  if (!raw) throw new Error(`Unknown enemy id '${id}' (not in enemies.json)`);
  return toEnemyDef(raw, asBoss);
}

export function allEnemyIds(): string[] {
  return rawEnemies.map((e) => e.id);
}

const rawBiomes = (
  biomesJson as { biomes: Array<{ id: BiomeId; name: string; colorPalette: BiomeInfo['palette'] }> }
).biomes;

export function biomeInfo(id: BiomeId): BiomeInfo {
  const raw = rawBiomes.find((b) => b.id === id);
  if (!raw) throw new Error(`Unknown biome '${id}' (not in biomes.json)`);
  return { id: raw.id, name: raw.name, palette: raw.colorPalette };
}

export function floorPlan(depth: number): FloorPlan {
  return FLOOR_PLANS[Math.min(depth, FLOOR_PLANS.length - 1)];
}

export const FINAL_DEPTH = FLOOR_PLANS.length - 1;

/** The echo guardian that waits in a mid-floor arena: another section's boss. */
export function arenaBossFor(depth: number): string {
  const pool = FLOOR_PLANS.filter((plan, index) => plan.boss !== 'keeper' && index !== depth);
  return pool[(depth * 5 + 3) % pool.length].boss;
}

interface RawLore {
  memoryFragments: Record<string, { text: string; location: string }>;
  coreMemories: Record<string, { title: string; text: string; fragments: string[] }>;
}

const rawLore = (loreJson as { lore: RawLore }).lore;

export const MEMORY_FRAGMENTS: readonly MemoryFragment[] = Object.entries(
  rawLore.memoryFragments
).map(([id, f]) => ({ id, text: f.text, biome: f.location }));

export const CORE_MEMORIES: readonly CoreMemory[] = Object.entries(rawLore.coreMemories).map(
  ([id, c]) => ({ id, title: c.title, text: c.text, fragments: c.fragments })
);

/**
 * Fragments a floor can award: its biome's first, then any not yet owned.
 * Returns ids in preference order.
 */
export function fragmentsForFloor(biome: BiomeId, owned: ReadonlySet<string>): string[] {
  const unowned = MEMORY_FRAGMENTS.filter((f) => !owned.has(f.id));
  const local = unowned.filter((f) => f.biome === biome);
  const rest = unowned.filter((f) => f.biome !== biome);
  return [...local, ...rest].map((f) => f.id);
}
