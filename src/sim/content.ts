/**
 * Game content: typed views over the JSON data files plus the run's floor plan.
 *
 * The JSON stays the source of names, stats and lore; this module decides how
 * those records map onto the simulation (AI archetype, floor rosters, bosses).
 */
import biomesJson from '@data/biomes.json';
import enemiesJson from '@data/enemies.json';
import loreJson from '@data/lore.json';

export type BiomeId = 'ruins' | 'forest' | 'caves' | 'crystal' | 'void' | 'sanctuary';

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
}

export interface FloorPlan {
  depth: number;
  biome: BiomeId;
  roster: string[];
  boss: string;
  roomCount: number;
  finale: boolean;
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
};

export const FLOOR_PLANS: readonly FloorPlan[] = [
  {
    depth: 0,
    biome: 'ruins',
    roster: ['scavenger', 'memory_echo'],
    boss: 'guardian',
    roomCount: 7,
    finale: false,
  },
  {
    depth: 1,
    biome: 'forest',
    roster: ['wildling', 'scavenger', 'memory_echo'],
    boss: 'spirit',
    roomCount: 8,
    finale: false,
  },
  {
    depth: 2,
    biome: 'caves',
    roster: ['cave_dweller', 'shadow', 'wildling'],
    boss: 'crystal_golem',
    roomCount: 9,
    finale: false,
  },
  {
    depth: 3,
    biome: 'crystal',
    roster: ['prism_entity', 'shadow', 'cave_dweller'],
    boss: 'crystal_guardian',
    roomCount: 9,
    finale: false,
  },
  {
    depth: 4,
    biome: 'void',
    roster: ['void_walker', 'prism_entity', 'shadow'],
    boss: 'forgotten',
    roomCount: 10,
    finale: false,
  },
  {
    depth: 5,
    biome: 'sanctuary',
    roster: ['void_walker', 'memory_echo', 'prism_entity'],
    boss: 'keeper',
    roomCount: 5,
    finale: true,
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
