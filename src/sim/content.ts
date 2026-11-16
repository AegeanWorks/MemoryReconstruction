/**
 * Game content: typed views over the JSON data files plus the run's floor plan.
 *
 * The JSON stays the source of names, stats and lore; this module decides how
 * those records map onto the simulation (AI archetype, floor rosters, bosses).
 */
import { z } from 'zod';
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
  | 'tide'
  | 'storm'
  | 'sanctuary';

/** How an enemy fights; several data behaviours share one archetype. */
export type Archetype =
  'melee' | 'skirmisher' | 'caster' | 'brute' | 'duelist' | 'boss' | 'teleporter';

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
  /** One line of field-guide lore, shown under the boss bar. */
  description: string;
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
  layout:
    | 'branch'
    | 'ring'
    | 'spine'
    | 'grid'
    | 'diamond'
    | 'cross'
    | 'clover'
    | 'terrace'
    | 'atoll'
    | 'spire';
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
  /** Legacy unlock marker kept from the lore data for future story use. */
  reward?: string;
}

/** Enemy attacks hit this hard relative to enemies.json, tuned for 100 base player health. */
export const ENEMY_DAMAGE_SCALE = 1.15;
/** Harder enemy pass: global multipliers over enemies.json. */
export const ENEMY_SPEED_SCALE = 1.08;
export const ENEMY_ATTACK_SPEED_SCALE = 1.2;
export const ENEMY_WINDUP_SCALE = 1.1;
/** Wave size multiplier before the room-area cap; late rooms were too crowded. */
export const ENEMY_COUNT_SCALE = 1.1;
/** Kill XP is deliberately scarce: levels should be earned, not showered. */
export const ENEMY_XP_SCALE = 0.3;
/** Extra incoming-damage growth per section past the first: section 2 is 1.05, section 3 is 1.10. */
export const ENEMY_DAMAGE_DEPTH_SCALE = 0.05;
/** Enemy damage added (additive) for every room cleared this run: twenty rooms double it. */
export const ROOM_DAMAGE_STEP = 0.05;
/** Enemy damage added (additive) for every wave after a room's first. */
export const WAVE_DAMAGE_STEP = 0.1;
/** Extra enemies each wave of a room brings after the first. */
export const WAVE_EXTRA_ENEMIES = 1;

/**
 * The one place enemy damage grows: per section, per cleared room and per wave are all
 * additive steps, so 20 cleared rooms are exactly +100% and waves stack on top of that.
 */
export function enemyDamageMultiplier(depth: number, roomsCleared: number, wave = 1): number {
  return (
    1 +
    ENEMY_DAMAGE_DEPTH_SCALE * depth +
    ROOM_DAMAGE_STEP * roomsCleared +
    WAVE_DAMAGE_STEP * Math.max(0, wave - 1)
  );
}

/** The size of one wave: later waves of a room bring more enemies, up to the room cap. */
export function waveEnemyCount(baseCount: number, cap: number, wave: number, restless = 0): number {
  const grown = baseCount + WAVE_EXTRA_ENEMIES * Math.max(0, wave - 1);
  return Math.min(cap, Math.max(1, Math.round(grown * ENEMY_COUNT_SCALE) + restless));
}
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
  duelist: 'duelist',
  storm_caller: 'caster',
  sweeper: 'caster',
  wall_warden: 'caster',
  pillar_warden: 'caster',
  bombardier: 'caster',
  phase_stalker: 'teleporter',
  teleport: 'teleporter',
  boss: 'boss',
  final_boss: 'boss',
  // Cycle 109 archetypes.
  laser_warden: 'caster',
  stomper: 'brute',
  slow_aura: 'melee',
  charger: 'skirmisher',
  mud_spitter: 'caster',
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
  ossuary_chanter: 'voidCantor',
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
  // Roots and flowers, not the Guardian's keyhole chest.
  bloom_sentinel: 'petalWitch',
  petal_stalker: 'caveDweller',
  grave_warden: 'boneKnight',
  void_herald: 'voidCantor',
  hive_slinger: 'hiveDrone',
  hive_oracle: 'voidCantor',
  mire_lurker: 'bogLeech',
  phase_stalker: 'crystalGuardian',
  void_stalker: 'voidWalker',
  dread_champion: 'boneKnight',
  // The Ruin Warlord's bestiary promises obsidian spiked armor; the Guardian
  // sheet is the depth-0 chest construct, so reuse the ash-forged armor art.
  ruin_warlord: 'cinderWarden',
  obsidian_reaver: 'cinderWarden',
  first_echo: 'voidCantor',
  first_memory: 'keeper',
  // Both the duelist and the trial boss wear the player's own sheet.
  lost_self: 'mirror',
  mirror_self: 'mirror',
  // Sunken Tideways and Howling Spire mobs carry dedicated sheets.
  tide_reaver: 'tideReaver',
  brine_hulk: 'brineHulk',
  harbor_gunner: 'harborGunner',
  siren_caller: 'sirenCaller',
  storm_squire: 'stormSquire',
  gale_archer: 'galeArcher',
  thunder_brute: 'thunderBrute',
  tempest_oracle: 'tempestOracle',
  drowned_blademaster: 'drownedBlademaster',
  storm_warlord: 'stormWarlord',
  // Second wave: deepen the early and middle rosters.
  gutter_runner: 'gutterRunner',
  briar_wolf: 'briarWolf',
  gloom_stalker: 'gloomStalker',
  prism_wisp: 'prismWisp',
  null_hound: 'nullHound',
  slag_golem: 'slagGolem',
  // Third wave: melee-led and human-like blades. All reuse existing sheets
  // with tint/scale so the atlas gate stays green without new art.
  ember_squire: 'guardian',
  pale_blademaster: 'crystalGuardian',
  mire_halberdier: 'boneKnight',
  // Frail first-floor slinger: the catacomb archer's sheet, tinted to ruin stone.
  rubble_slinger: 'catacombArcher',
  // Frost bruiser on the bone knight sheet, deep-water ambusher on the gloom stalker's.
  rime_thrall: 'boneKnight',
  // Frail casters for the forest and caves, on the wildling and prism wisp sheets.
  thorn_spitter: 'wildling',
  pressure_husk: 'brineHulk',
  rivet_squire: 'boneKnight',
  wax_crawler: 'cogHound',
  cavern_glowmoth: 'prismWisp',
  trench_lurker: 'gloomStalker',
  // The Drowned Court trial boss borrows the leviathan sheet.
  abyssal_revenant: 'leviathan',
  // Cycle 100 additions: two late mobs and two late guardians, all reusing
  // existing sheets with tint and scale so the atlas stays honest.
  bone_picker: 'gutterRunner',
  lantern_wraith: 'gloomStalker',
  cinder_stalker: 'briarWolf',
  spire_marksman: 'harborGunner',
  reliquary_warden: 'guardian',
  salt_orchard_hydra: 'thornMatriarch',
  // Cycle 109: new behaviours reuse existing sheets with a tint.
  prism_lancer: 'crystalGuardian',
  quake_colossus: 'slagGolem',
  mire_warden: 'boneKnight',
  brine_charger: 'brineHulk',
  bog_spitter: 'bogLeech',
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
    ossuary_chanter: 0xe0d8c8,
    void_herald: 0xc0b0ff,
    hive_slinger: 0xffd090,
    hive_oracle: 0xffd98a,
    mire_lurker: 0x9fd0a0,
    prism_lancer: 0xaad8ff,
    quake_colossus: 0xffa060,
    mire_warden: 0x9fd0a0,
    brine_charger: 0x8fe8dc,
    bog_spitter: 0x9fd0a0,
    phase_stalker: 0xc4b5ff,
    void_stalker: 0xa8c0ff,
    dread_champion: 0xffdf80,
    ruin_warlord: 0xff8a7a,
    obsidian_reaver: 0xff8a7a,
    first_echo: 0x9fd8ff,
    first_memory: 0xffd98a,
    abyssal_revenant: 0x7fd8e8,
    ember_squire: 0xffb070,
    rubble_slinger: 0xc8a878,
    rime_thrall: 0xbfeaff,
    thorn_spitter: 0xa8e070,
    pressure_husk: 0x6fa0b8,
    rivet_squire: 0xffb347,
    wax_crawler: 0xffd25a,
    cavern_glowmoth: 0xffd070,
    trench_lurker: 0x5fd0e8,
    pale_blademaster: 0xbfeaff,
    mire_halberdier: 0x9fd0a0,
    lost_self: 0x9fd8ff,
    mirror_self: 0xbfeaff,
    bone_picker: 0xd8d2b0,
    lantern_wraith: 0x9fd8ff,
    cinder_stalker: 0xff9050,
    spire_marksman: 0xbfd9ff,
    reliquary_warden: 0xffd27a,
    salt_orchard_hydra: 0xa8e0b0,
  }).map(([id, color]) => [id, pastel(color)])
);

/**
 * Shared sheets keep their silhouette, so each borrower gets a distinct
 * display scale: a reskin that is also 8-15% taller or shorter reads as a
 * different creature instead of a palette swap.
 */
const ENEMY_SCALE_OVERRIDES: Record<string, number> = {
  cinder_wisp: 0.92,
  drowned: 1.06,
  frost_stalker: 1.12,
  glass_sentinel: 1.2,
  bloom_crawler: 0.9,
  rime_duelist: 1.05,
  bloom_sentinel: 1.25,
  petal_stalker: 0.92,
  grave_warden: 1.15,
  ossuary_chanter: 1.05,
  void_herald: 1.1,
  hive_slinger: 0.88,
  hive_oracle: 1.05,
  bone_picker: 0.94,
  lantern_wraith: 1.06,
  cinder_stalker: 1.02,
  spire_marksman: 1.08,
  reliquary_warden: 2,
  salt_orchard_hydra: 1.9,
  mire_lurker: 1.05,
  phase_stalker: 1.08,
  void_stalker: 1.02,
  dread_champion: 1.35,
  ruin_warlord: 1.4,
  obsidian_reaver: 1.15,
  first_echo: 1.05,
  // Same display height as the Keeper: the 1.15 scale clipped the halo and
  // crowded the boss bar against the top of the screen.
  first_memory: 1.0,
  abyssal_revenant: 1.15,
  ember_squire: 1.05,
  rubble_slinger: 0.9,
  rime_thrall: 1.1,
  thorn_spitter: 0.95,
  pressure_husk: 1.2,
  rivet_squire: 1.05,
  wax_crawler: 0.95,
  cavern_glowmoth: 0.95,
  trench_lurker: 1.05,
  pale_blademaster: 1.1,
  mire_halberdier: 1.15,
  lost_self: 1.0,
  mirror_self: 1.0,
};

/** Tint is multiplicative, so dark shared sheets need a mostly-white mix. */
function pastel(color: number): number {
  const mix = (channel: number): number => Math.round(channel * 0.35 + 255 * 0.65);
  const r = mix((color >> 16) & 0xff);
  const g = mix((color >> 8) & 0xff);
  const b = mix(color & 0xff);
  return (r << 16) | (g << 8) | b;
}

/** Zod-validated shape of a floor plan: new bosses/levels arrive as DATA, never code. */
export const FloorPlanSchema = z.object({
  depth: z.number().int().min(0),
  biome: z.enum([
    'ruins',
    'forest',
    'caves',
    'crystal',
    'ash',
    'foundry',
    'abyss',
    'void',
    'frost',
    'mire',
    'bloom',
    'hive',
    'catacomb',
    'tide',
    'storm',
    'sanctuary',
  ]),
  roster: z.array(z.string()),
  boss: z.string().min(1),
  roomCount: z.number().int().min(1),
  finale: z.boolean(),
  layout: z.enum([
    'branch',
    'ring',
    'spine',
    'grid',
    'diamond',
    'cross',
    'clover',
    'terrace',
    'atoll',
    'spire',
  ]),
  bossOnly: z.boolean().optional(),
  trialName: z.string().optional(),
});

function parsePlans(plans: readonly FloorPlan[]): readonly FloorPlan[] {
  return plans.map((plan) => FloorPlanSchema.parse(plan));
}

export const FLOOR_PLANS: readonly FloorPlan[] = parsePlans([
  {
    depth: 0,
    biome: 'ruins',
    roster: ['scavenger', 'memory_echo', 'gutter_runner', 'rubble_slinger'],
    boss: 'guardian',
    roomCount: 7,
    finale: false,
    layout: 'branch',
  },
  {
    depth: 1,
    biome: 'forest',
    roster: ['wildling', 'scavenger', 'memory_echo', 'briar_wolf', 'thorn_spitter'],
    boss: 'spirit',
    roomCount: 8,
    finale: false,
    layout: 'ring',
  },
  {
    depth: 2,
    biome: 'caves',
    roster: ['cave_dweller', 'shadow', 'wildling', 'gloom_stalker', 'cavern_glowmoth'],
    boss: 'crystal_golem',
    roomCount: 9,
    finale: false,
    layout: 'spine',
  },
  {
    depth: 3,
    biome: 'crystal',
    roster: ['prism_entity', 'shadow', 'cave_dweller', 'prism_wisp', 'prism_lancer'],
    boss: 'crystal_guardian',
    roomCount: 9,
    finale: false,
    layout: 'clover',
  },
  {
    depth: 4,
    biome: 'ash',
    roster: [
      'cinder_wisp',
      'magma_hound',
      'bombardier',
      'ash_herald',
      'cinder_hound',
      'ember_squire',
      'cinder_stalker',
    ],
    boss: 'cinder_warden',
    roomCount: 10,
    finale: false,
    layout: 'branch',
  },
  {
    depth: 5,
    biome: 'frost',
    roster: ['frost_stalker', 'frost_oracle', 'rime_duelist'],
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
    roster: [
      'cog_hound',
      'solder_wisp',
      'bombardier',
      'slag_golem',
      'rivet_squire',
      'quake_colossus',
    ],
    boss: 'clockwork_regent',
    roomCount: 10,
    finale: false,
    layout: 'grid',
  },
  {
    depth: 7,
    biome: 'tide',
    roster: [
      'tide_reaver',
      'brine_hulk',
      'harbor_gunner',
      'siren_caller',
      'drowned',
      'brine_charger',
    ],
    boss: 'drowned_blademaster',
    roomCount: 10,
    finale: false,
    layout: 'atoll',
    trialName: 'The Sunken Tideways',
  },
  {
    depth: 8,
    biome: 'abyss',
    roster: ['drowned', 'tide_caller', 'trench_lurker', 'pressure_husk'],
    boss: 'leviathan',
    roomCount: 10,
    finale: false,
    layout: 'ring',
  },
  {
    depth: 9,
    biome: 'void',
    roster: [
      'void_walker',
      'prism_entity',
      'shadow',
      'void_cantor',
      'void_herald',
      'lost_self',
      'null_hound',
      'lantern_wraith',
    ],
    boss: 'forgotten',
    roomCount: 11,
    finale: false,
    layout: 'spine',
  },
  {
    depth: 10,
    biome: 'frost',
    roster: [
      'frost_stalker',
      'glass_sentinel',
      'rime_thrall',
      'frost_oracle',
      'rime_duelist',
      'pale_blademaster',
    ],
    boss: 'frost_warden',
    roomCount: 11,
    finale: false,
    layout: 'terrace',
  },
  {
    depth: 11,
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
    depth: 12,
    biome: 'mire',
    roster: [
      'bog_leech',
      'plague_caster',
      'drowned',
      'mire_lurker',
      'mire_halberdier',
      'mire_warden',
      'bog_spitter',
    ],
    boss: 'mire_sovereign',
    roomCount: 12,
    finale: false,
    layout: 'branch',
  },
  {
    depth: 13,
    biome: 'bloom',
    roster: ['bloom_crawler', 'petal_witch', 'frost_stalker', 'bloom_sentinel', 'petal_stalker'],
    boss: 'thorn_matriarch',
    roomCount: 12,
    finale: false,
    layout: 'ring',
  },
  {
    depth: 14,
    biome: 'storm',
    roster: [
      'storm_squire',
      'gale_archer',
      'thunder_brute',
      'tempest_oracle',
      'cinder_wisp',
      'spire_marksman',
    ],
    boss: 'storm_warlord',
    roomCount: 12,
    finale: false,
    layout: 'spire',
    trialName: 'The Howling Spire',
  },
  {
    depth: 15,
    biome: 'hive',
    roster: ['hive_drone', 'hive_guard', 'hive_oracle', 'hive_slinger', 'wax_crawler'],
    boss: 'hive_queen',
    roomCount: 12,
    finale: false,
    layout: 'diamond',
  },
  {
    depth: 16,
    biome: 'catacomb',
    roster: [
      'bone_knight',
      'catacomb_archer',
      'ossuary_chanter',
      'grave_hound',
      'grave_warden',
      'bone_picker',
    ],
    boss: 'bone_tyrant',
    roomCount: 13,
    finale: false,
    layout: 'cross',
  },
  {
    depth: 17,
    biome: 'void',
    roster: [],
    boss: 'mirror_self',
    roomCount: 1,
    finale: false,
    layout: 'grid',
    bossOnly: true,
    trialName: 'Echo Trial: The Mirror of Self',
  },
  {
    depth: 18,
    biome: 'ruins',
    roster: ['bone_knight', 'phase_stalker', 'scavenger', 'void_stalker'],
    boss: 'dread_champion',
    roomCount: 12,
    finale: false,
    layout: 'diamond',
    trialName: 'Echo Arena: The Sunken Colosseum',
  },
  {
    depth: 19,
    biome: 'ash',
    roster: ['cinder_hound', 'magma_hound', 'phase_stalker', 'ash_herald', 'obsidian_reaver'],
    boss: 'ruin_warlord',
    roomCount: 13,
    finale: false,
    layout: 'terrace',
    trialName: 'The Obsidian Ramparts',
  },
  {
    depth: 20,
    biome: 'tide',
    roster: [],
    boss: 'abyssal_revenant',
    roomCount: 1,
    finale: false,
    layout: 'grid',
    bossOnly: true,
    trialName: 'Echo Trial: The Drowned Court',
  },
  {
    depth: 21,
    biome: 'foundry',
    roster: [
      'rivet_squire',
      'solder_wisp',
      'cog_hound',
      'bone_picker',
      'cinder_stalker',
      'spire_marksman',
      'quake_colossus',
      'prism_lancer',
    ],
    boss: 'reliquary_warden',
    roomCount: 13,
    finale: false,
    layout: 'terrace',
    trialName: 'The Gilded Reliquary',
  },
  {
    depth: 22,
    biome: 'bloom',
    roster: [
      'bloom_crawler',
      'petal_stalker',
      'bloom_sentinel',
      'lantern_wraith',
      'spire_marksman',
      'bone_picker',
    ],
    boss: 'salt_orchard_hydra',
    roomCount: 13,
    finale: false,
    layout: 'atoll',
    trialName: 'The Salt Orchard',
  },
  {
    depth: 23,
    biome: 'sanctuary',
    roster: [
      'first_echo',
      'void_walker',
      'memory_echo',
      'prism_entity',
      'void_herald',
      'lost_self',
      'void_stalker',
    ],
    boss: 'keeper',
    roomCount: 5,
    finale: false,
    layout: 'branch',
  },
  {
    depth: 24,
    biome: 'void',
    roster: ['first_echo', 'obsidian_reaver', 'void_walker', 'memory_echo'],
    boss: 'first_memory',
    roomCount: 6,
    finale: true,
    layout: 'ring',
    trialName: 'The First Remembering',
  },
]);

interface RawEnemy {
  id: string;
  name: string;
  description: string;
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
    description: raw.description ?? '',
    archetype,
    behavior: raw.ai.behavior,
    maxHealth: Math.round(
      raw.stats.health * (asBoss && raw.ai.behavior !== 'final_boss' ? BOSS_HEALTH_SCALE : 1)
    ),
    damage: Math.max(4, Math.round(raw.stats.damage * ENEMY_DAMAGE_SCALE)),
    speed: Math.round(raw.stats.speed * ENEMY_SPEED_SCALE),
    radius: Math.round(raw.hitbox.width / 2) * (asBoss ? 1.3 : 1),
    aggroRange: Math.max(raw.ai.aggroRange, 260),
    attackRange: raw.ai.attackRange,
    attackCooldown: raw.ai.attackCooldown / ENEMY_ATTACK_SPEED_SCALE,
    xp: raw.stats.xpValue,
    sprite: SPRITE_KEYS[raw.id] ?? raw.id,
    displayHeight:
      Math.max(48, raw.sprite.height) * (asBoss ? 1.5 : 1) * (ENEMY_SCALE_OVERRIDES[raw.id] ?? 1),
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

const GUARDIAN_IDS = new Set(FLOOR_PLANS.map((plan) => plan.boss));

/** Every enemy that waits at the end of a section. */
export function guardianIds(): string[] {
  return [...GUARDIAN_IDS];
}

export interface BestiaryEntry {
  id: string;
  name: string;
  description: string;
  isBoss: boolean;
  seen: boolean;
  /** Lifetime defeats of this species. */
  kills: number;
}

/** The codex views the player can switch between. */
export type BestiaryFilter = 'all' | 'seen' | 'sealed' | 'guardians';

export interface BestiaryProgress {
  recorded: number;
  total: number;
  complete: boolean;
}

/**
 * The Bestiary list: regular enemies first, then guardians, each alphabetical.
 * Unknown ids in the saved record are ignored, so a hand-edited save cannot
 * smuggle a phantom entry into the codex.
 */
export function bestiaryEntries(
  seen: readonly string[],
  kills: Readonly<Record<string, number>> = {}
): BestiaryEntry[] {
  const have = new Set(seen);
  return allEnemyIds()
    .map((id) => {
      const def = enemyDef(id);
      const count = kills[id] ?? 0;
      return {
        id,
        name: def.name,
        description: def.description,
        isBoss: GUARDIAN_IDS.has(id),
        seen: have.has(id),
        kills: Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0,
      };
    })
    .sort((a, b) => Number(a.isBoss) - Number(b.isBoss) || a.name.localeCompare(b.name));
}

/** How much of the codex is filled, against the real species count. */
export function bestiaryProgress(seen: readonly string[]): BestiaryProgress {
  const real = new Set(allEnemyIds());
  const recorded = new Set(seen.filter((id) => real.has(id))).size;
  const total = real.size;
  return { recorded, total, complete: total > 0 && recorded === total };
}

/** Entries for one codex view; `all` returns the list unchanged. */
export function filterBestiary(
  entries: readonly BestiaryEntry[],
  filter: BestiaryFilter
): BestiaryEntry[] {
  switch (filter) {
    case 'seen':
      return entries.filter((entry) => entry.seen);
    case 'sealed':
      return entries.filter((entry) => !entry.seen);
    case 'guardians':
      return entries.filter((entry) => entry.isBoss);
    default:
      return [...entries];
  }
}

/** One section a species can be met in. */
export interface EnemyHabitat {
  /** One-based section number. */
  section: number;
  biome: string;
  title: string;
  guardian: boolean;
  finale: boolean;
}

/**
 * Where a species appears: every plan whose roster names it, plus the plan
 * whose guardian it is. Ordered by section so the codex reads as a road.
 */
export function enemyHabitats(id: string): EnemyHabitat[] {
  const habitats: EnemyHabitat[] = [];
  FLOOR_PLANS.forEach((plan) => {
    const guardian = plan.boss === id;
    if (!guardian && !plan.roster.includes(id)) return;
    const biome = biomeInfo(plan.biome);
    habitats.push({
      section: plan.depth + 1,
      biome: biome.name,
      title: plan.trialName ?? biome.name,
      guardian,
      finale: plan.finale,
    });
  });
  return habitats;
}

/** Everything one codex card can show, including the stats a sealed entry hides. */
export interface BestiaryDetail {
  id: string;
  name: string;
  description: string;
  isBoss: boolean;
  seen: boolean;
  kills: number;
  habitats: EnemyHabitat[];
  stats?: { health: number; damage: number; xp: number };
}

/**
 * The detail view behind a codex card. A sealed species keeps its habitat list
 * (the road that hides it) but not its numbers, so looking ahead stays a tease
 * instead of a strategy sheet.
 */
export function bestiaryDetail(id: string, seen: boolean, kills = 0): BestiaryDetail | undefined {
  if (!rawEnemies.some((enemy) => enemy.id === id)) return undefined;
  const def = enemyDef(id);
  const entry: BestiaryDetail = {
    id,
    name: def.name,
    description: def.description,
    isBoss: GUARDIAN_IDS.has(id),
    seen,
    kills: Math.max(0, Math.floor(Number.isFinite(kills) ? kills : 0)),
    habitats: enemyHabitats(id),
  };
  if (seen) {
    entry.stats = {
      health: Math.max(0, Math.round(def.maxHealth)),
      damage: Math.max(0, Math.round(def.damage)),
      xp: Math.max(0, Math.round(def.xp)),
    };
  }
  return entry;
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
  return FLOOR_PLANS[Math.max(0, Math.min(depth, FLOOR_PLANS.length - 1))];
}

export const FINAL_DEPTH = FLOOR_PLANS.length - 1;

/**
 * The echo guardian that waits in a mid-floor arena: another section's boss.
 * The Keeper and the Mirror of Self are reserved for their own finales.
 */
export function arenaBossFor(depth: number): string {
  const pool = FLOOR_PLANS.filter(
    (plan, index) =>
      plan.boss !== 'keeper' &&
      plan.boss !== 'mirror_self' &&
      plan.boss !== 'first_memory' &&
      index !== depth
  );
  return pool[(depth * 5 + 3) % pool.length].boss;
}

interface RawLore {
  memoryFragments: Record<string, { text: string; location: string }>;
  coreMemories: Record<
    string,
    { title: string; text: string; fragments: string[]; reward?: string }
  >;
}

const rawLore = (loreJson as { lore: RawLore }).lore;

export const MEMORY_FRAGMENTS: readonly MemoryFragment[] = Object.entries(
  rawLore.memoryFragments
).map(([id, f]) => ({ id, text: f.text, biome: f.location }));

export const CORE_MEMORIES: readonly CoreMemory[] = Object.entries(rawLore.coreMemories).map(
  ([id, c]) => ({ id, title: c.title, text: c.text, fragments: c.fragments, reward: c.reward })
);

/** The core whose last fragment `fragmentId` just completed, if any. */
export function completedCoreFor(
  fragmentId: string,
  owned: ReadonlySet<string>
): CoreMemory | undefined {
  return CORE_MEMORIES.find(
    (core) => core.fragments.includes(fragmentId) && core.fragments.every((id) => owned.has(id))
  );
}

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

const BIOME_NAMES = new Map(rawBiomes.map((biome) => [biome.id as string, biome.name]));

/**
 * Where a memory fragment waits, as a readable biome name. A fragment whose
 * saved location is not a real biome gets no hint rather than a broken one.
 */
export function fragmentHabitat(id: string): string | undefined {
  const fragment = MEMORY_FRAGMENTS.find((f) => f.id === id);
  if (!fragment) return undefined;
  return BIOME_NAMES.get(fragment.biome);
}

export interface MemoriesProgress {
  fragments: number;
  totalFragments: number;
  cores: number;
  totalCores: number;
  complete: boolean;
}

/** How much of the lore is recovered: fragment count and fully restored memories. */
export function memoriesProgress(owned: readonly string[]): MemoriesProgress {
  const have = new Set(owned);
  const totalFragments = MEMORY_FRAGMENTS.length;
  const fragments = MEMORY_FRAGMENTS.filter((fragment) => have.has(fragment.id)).length;
  const cores = CORE_MEMORIES.filter((core) => core.fragments.every((id) => have.has(id))).length;
  return {
    fragments,
    totalFragments,
    cores,
    totalCores: CORE_MEMORIES.length,
    complete: totalFragments > 0 && fragments === totalFragments,
  };
}
