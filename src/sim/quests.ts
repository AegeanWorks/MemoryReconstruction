/** NPCs and their quests. Progress is derived from the save, never stored twice. */
import { EQUIPMENT } from './equipment';
import { restorationLevel, restoredLevels, type SanctuaryProgress } from './hub';

export type QuestKind =
  'fragments' | 'kills' | 'restored' | 'depth' | 'bosses' | 'elites' | 'relics' | 'trust';

export interface QuestDef {
  id: string;
  npcId: string;
  name: string;
  text: string;
  kind: QuestKind;
  target: number;
  rewardEchoes: number;
  /** Equipment def id added to the permanent starting kit. */
  rewardItem?: string;
}

export const NPCS: Record<string, { name: string; role: string; greeting: string }> = {
  archivist: {
    name: 'The Archivist',
    role: 'Keeper of names',
    greeting:
      'I keep what the world drops. Bring me names, Walker, and I will write them back into the index.',
  },
  smith: {
    name: 'The Smith',
    role: 'Keeper of edges',
    greeting:
      'Everything here was broken once. I do not mind broken. I mind when nothing comes back to be mended.',
  },
  gardener: {
    name: 'The Gardener',
    role: 'Keeper of the growing',
    greeting:
      'The sanctuary is not a building. It is a habit. Every stone you set back makes the next one easier.',
  },
  warden: {
    name: 'The Warden',
    role: 'Keeper of the gate',
    greeting:
      'I do not stop walkers leaving. I only count how far they got, so the next one knows the way.',
  },
  lamplighter: {
    name: 'The Lamplighter',
    role: 'Keeper of the dark',
    greeting:
      'Every guardian you put down is one less shadow on my rounds. I keep the lamps; you keep the road.',
  },
  hearthkeeper: {
    name: 'The Hearthkeeper',
    role: 'Keeper of the table',
    greeting:
      'Sit, Walker, sit. Soup first, stories after. Tell me how far the road went this time — the stew tastes better with a long tale in it.',
  },
};

/** The in-run Wayfarer trades one generous choice for a scrap of road-story. */
export const WAYFARER_LINES: readonly string[] = [
  'Every road is a memory walked twice. Take a choice and leave a name.',
  'I have been to the room you are looking for. It is not there yet.',
  'The sealed places remember the hands that built them. Pull the lever gently.',
  'A waystone is only a promise that the road goes both ways.',
];

/** The Ferryman sells the shortest road to the guardian, for shards. */
export const FERRYMAN_LINES: readonly string[] = [
  'The dark water remembers every crossing. It does not remember the fare.',
  'I do not ask why you are in a hurry. I only ask how many shards.',
  'The guardian is already waiting. It has been waiting longer than you.',
  'Step in. Keep your hands inside the memory.',
];

export const QUESTS: readonly QuestDef[] = [
  {
    id: 'names',
    npcId: 'archivist',
    name: 'Names in the Index',
    text: 'Recover 4 memory fragments so the index has something to remember.',
    kind: 'fragments',
    target: 4,
    rewardEchoes: 60,
  },
  {
    id: 'edges',
    npcId: 'smith',
    name: 'Edges for the Wall',
    text: 'Defeat 120 enemies across your expeditions. The wall remembers every blow struck for it.',
    kind: 'kills',
    target: 120,
    rewardEchoes: 50,
    rewardItem: 'echo_dagger',
  },
  {
    id: 'stones',
    npcId: 'gardener',
    name: 'Stones and Seeds',
    text: 'Restore 4 levels of the Sanctuary. A place grows by being used, not by being admired.',
    kind: 'restored',
    target: 4,
    rewardEchoes: 80,
  },
  {
    id: 'the_way',
    npcId: 'warden',
    name: 'The Way Down',
    text: 'Reach the eighth section. I will mark the route on every gate after that.',
    kind: 'depth',
    target: 8,
    rewardEchoes: 90,
  },
  {
    id: 'lights_out',
    npcId: 'lamplighter',
    name: 'Lights Out',
    text: 'Put down five guardians. The lamps burn steadier when the road is quiet.',
    kind: 'bosses',
    target: 5,
    rewardEchoes: 70,
    rewardItem: 'sun_core',
  },
  {
    id: 'long_tales',
    npcId: 'hearthkeeper',
    name: 'Long Tales',
    text: 'Reach section 12 and come back to tell of it. The stew needs a long story.',
    kind: 'depth',
    target: 12,
    rewardEchoes: 120,
    rewardItem: 'ember_charm',
  },
  {
    id: 'index_of_echoes',
    npcId: 'archivist',
    name: 'An Index of Echoes',
    text: 'Recover 12 memory fragments. The index wants the whole shape of the story, not four pages of it.',
    kind: 'fragments',
    target: 12,
    rewardEchoes: 180,
    rewardItem: 'oracle_circlet',
  },
  {
    id: 'the_long_forge',
    npcId: 'smith',
    name: 'The Long Forge',
    text: 'Defeat 400 enemies. The wall does not care how long the road is, only that the edge holds.',
    kind: 'kills',
    target: 400,
    rewardEchoes: 200,
    rewardItem: 'duelist_mantle',
  },
  {
    id: 'roots_deep',
    npcId: 'gardener',
    name: 'Roots Deep',
    text: 'Restore 8 levels of the Sanctuary. Let something here outlive the next expedition.',
    kind: 'restored',
    target: 8,
    rewardEchoes: 220,
    rewardItem: 'ember_drape',
  },
  {
    id: 'the_far_gate',
    npcId: 'warden',
    name: 'The Far Gate',
    text: 'Reach the seventeenth section. I will hold the gate open on your word.',
    kind: 'depth',
    target: 16,
    rewardEchoes: 240,
    rewardItem: 'iron_helm',
  },
  {
    id: 'every_light',
    npcId: 'lamplighter',
    name: 'Every Light',
    text: 'Put down twelve guardians. Every lamp on the coast should know your name.',
    kind: 'bosses',
    target: 12,
    rewardEchoes: 230,
    rewardItem: 'storm_dial',
  },
  {
    id: 'the_last_tale',
    npcId: 'hearthkeeper',
    name: 'The Last Tale',
    text: 'Reach the twentieth section and come back. The stew will be waiting, and so will I.',
    kind: 'depth',
    target: 20,
    rewardEchoes: 260,
    rewardItem: 'void_mantle',
  },
  {
    id: 'index_complete',
    npcId: 'archivist',
    name: 'The Complete Index',
    text: 'Recover 24 memory fragments. The index is no longer a pile of pages; it is becoming a life.',
    kind: 'fragments',
    target: 24,
    rewardEchoes: 300,
    rewardItem: 'tidecloak',
  },
  {
    id: 'elite_edges',
    npcId: 'smith',
    name: 'Edges Beyond the Wall',
    text: 'Defeat 30 elites. Only the ones the deep sends to test you count, and they send their best.',
    kind: 'elites',
    target: 30,
    rewardEchoes: 280,
    rewardItem: 'ember_drape',
  },
  {
    id: 'whole_garden',
    npcId: 'gardener',
    name: 'The Whole Garden',
    text: 'Restore 10 levels of the Sanctuary. I want to see every bed green before the next winter.',
    kind: 'restored',
    target: 10,
    rewardEchoes: 300,
    rewardItem: 'void_mantle',
  },
  {
    id: 'keepers_gate',
    npcId: 'warden',
    name: 'The Keeper’s Gate',
    text: 'Reach the twenty-sixth section. The gate there has no hinges; prove it still opens for you.',
    kind: 'depth',
    target: 25,
    rewardEchoes: 300,
    rewardItem: 'colossus_plate',
  },
  {
    id: 'sixteen_lights',
    npcId: 'lamplighter',
    name: 'Sixteen Lights',
    text: 'Put down 18 guardians. The coast would be dark without them; it would also be at peace.',
    kind: 'bosses',
    target: 18,
    rewardEchoes: 300,
    rewardItem: 'void_visor',
  },
  {
    id: 'full_table',
    npcId: 'hearthkeeper',
    name: 'A Full Table',
    text: 'Earn 6 hearts of trust across the Sanctuary. A full table is not built by one chair.',
    kind: 'trust',
    target: 6,
    rewardEchoes: 320,
    rewardItem: 'ember_ward',
  },
];

/** Every quest a resident offers, in chapter order. */
export function questsForNpcList(npcId: string): QuestDef[] {
  return QUESTS.filter((q) => q.npcId === npcId);
}

/** The first quest this resident still has open; undefined once all are claimed. */
export function nextQuestForNpc(npcId: string, claimed: readonly string[]): QuestDef | undefined {
  return questsForNpcList(npcId).find((quest) => !claimed.includes(quest.id));
}

/** The most recent claimed chapter, for the resident's after-task line. */
export function latestClaimedQuestForNpc(
  npcId: string,
  claimed: readonly string[]
): QuestDef | undefined {
  const chapters = questsForNpcList(npcId);
  for (let i = chapters.length - 1; i >= 0; i--) {
    if (claimed.includes(chapters[i].id)) return chapters[i];
  }
  return undefined;
}

/** One closing line per chapter, shown once that chapter is turned in. */
export const QUEST_EPILOGUES: Record<string, string> = {
  names:
    'The first four names are filed. The index has a shape again, and it is beginning to look like you.',
  edges:
    'The wall holds your edge now. I hung it above the door so the recruits know what a long road looks like.',
  stones:
    'Four gardens breathing. I will plant the fifth in your name and argue with nobody about it.',
  the_way:
    'The route is marked past the eighth gate. Come back and I will walk the next one with you.',
  lights_out:
    'Five guardian lights out. The coast is darker, but the lamps in here burn cleaner for it.',
  long_tales:
    'A long road and a longer story. Sit. There is enough stew for the both of us and the tale is not finished.',
  index_of_echoes:
    'Twelve fragments, and the shape of the story finally holds still. You are written into the index now.',
  the_long_forge: 'Four hundred edges. The wall is part of you now, whether you carry it or not.',
  roots_deep:
    'Eight levels green. The Sanctuary is not a shelter any more; it is a place that will remember you.',
  the_far_gate: 'The far gate answered your word. I have never seen it do that for anyone else.',
  every_light:
    'Twelve guardians down. The lamps have run out of names to give you, so they just burn.',
  the_last_tale:
    'The last tale is not about the road. It is about the chair by the fire and the person who keeps coming back to it.',
  index_complete:
    'The index is whole enough to be read. You are not a name in it any more; you are the hand that keeps writing.',
  elite_edges:
    'Thirty of the deep’s best. I have stopped counting the wall as a wall; it is the edge of everything you survived.',
  whole_garden:
    'Ten beds green. There is no part of this Sanctuary that has not felt your hands in it now.',
  keepers_gate:
    'The gate opened because you remembered it. I have never seen the Keeper’s door do that, and I have watched it a long time.',
  sixteen_lights:
    'Eighteen guardians quiet. The lamps are not counting any more. They just burn for you.',
  full_table:
    'Six hearts at one table. Sit down. This is not a tale any more; it is the reason the house has a roof.',
};

export function epilogueForNpc(npcId: string, claimed: readonly string[]): string | undefined {
  const chapter = latestClaimedQuestForNpc(npcId, claimed);
  return chapter ? QUEST_EPILOGUES[chapter.id] : undefined;
}

/** One posted note per resident: the next chapter they still have to offer. */
export interface QuestBoardEntry {
  npcId: string;
  quest: QuestDef;
  accepted: boolean;
  ready: boolean;
  progress: number;
  bonusReached: boolean;
}

export function questBoardEntries(
  meta: { quests: { accepted: readonly string[]; claimed: readonly string[] } },
  snapshot: QuestSnapshot
): QuestBoardEntry[] {
  const entries: QuestBoardEntry[] = [];
  for (const npcId of Object.keys(NPCS)) {
    const quest = nextQuestForNpc(npcId, meta.quests.claimed);
    if (!quest) continue;
    const accepted = meta.quests.accepted.includes(quest.id);
    const progress = questProgress(quest, snapshot);
    entries.push({
      npcId,
      quest,
      accepted,
      ready: accepted && progress >= quest.target,
      progress,
      bonusReached: questBonusReached(quest, snapshot),
    });
  }
  return entries;
}

export function questDef(id: string): QuestDef | undefined {
  return QUESTS.find((q) => q.id === id);
}

export function questsForNpc(npcId: string): QuestDef | undefined {
  return QUESTS.find((q) => q.npcId === npcId);
}

export interface QuestSnapshot {
  fragments: number;
  kills: number;
  restored: number;
  depth: number;
  bosses: number;
  elites: number;
  /** Distinct relics kept in the vault. */
  relics: number;
  /** Hearts of trust earned across every resident. */
  trust: number;
}

/** A story beat an NPC shares once the walker has earned the context. */
export interface NpcStory {
  text: string;
  /** Shown once the walker has reached this section. */
  minDepth?: number;
  /** Shown once the walker has put down this many guardians. */
  minBosses?: number;
  /** Shown once the walker has won this many expeditions. */
  minVictories?: number;
  /** Shown while the resident's own task is in this state. */
  questState?: 'available' | 'accepted' | 'ready' | 'done';
}

export type QuestState = 'available' | 'accepted' | 'ready' | 'done';

/**
 * NPC trust, 0-3 hearts (cyberpunk contact-trust analog, ADR-020/022):
 * claimed tasks build it, and old friends pay better. Stored per NPC id.
 */
export function trustLevel(meta: { trust: Record<string, number> }, npcId: string): number {
  return Math.max(0, Math.min(3, meta.trust[npcId] ?? 0));
}

/** Claim bonus echoes from trust: +25% of the base reward per heart. */
export function trustBonus(rewardEchoes: number, trust: number): number {
  return Math.round(rewardEchoes * 0.25 * trust);
}

/**
 * Rush window (cyberpunk ADR-020 contracts with terms): claiming within
 * 30 minutes of accepting pays +50%. The clock is visible on the quest,
 * so the bonus is a term, not a surprise.
 */
export const RUSH_WINDOW_MS = 30 * 60 * 1000;

export function rushBonus(
  rewardEchoes: number,
  acceptedAt: number | undefined,
  now = Date.now()
): number {
  if (acceptedAt === undefined) return 0;
  return now - acceptedAt <= RUSH_WINDOW_MS ? Math.round(rewardEchoes * 0.5) : 0;
}

export function rushRemaining(acceptedAt: number | undefined, now = Date.now()): number {
  if (acceptedAt === undefined) return 0;
  return Math.max(0, RUSH_WINDOW_MS - (now - acceptedAt));
}

/** Whole minutes left in the rush window, for quest-panel copy. */
export function rushMinutesLeft(acceptedAt: number | undefined, now = Date.now()): number {
  return Math.ceil(rushRemaining(acceptedAt, now) / 60000);
}

/**
 * The daily mark (cyberpunk contract board, ADR-020, lite): one named
 * enemy, twelve kills, one reward, same for everyone each day. Deterministic
 * from the date key, so the board needs no server and no schedule.
 */
export interface DailyBounty {
  defId: string;
  name: string;
  target: number;
  reward: number;
}

const DAILY_BOUNTY_POOL: ReadonlyArray<{ defId: string; name: string }> = [
  { defId: 'scavenger', name: 'Scavengers' },
  { defId: 'wildling', name: 'Wildlings' },
  { defId: 'cave_dweller', name: 'Cave Dwellers' },
  { defId: 'cinder_hound', name: 'Cinder Hounds' },
  { defId: 'tide_reaver', name: 'Tide Reavers' },
  { defId: 'storm_squire', name: 'Storm Squires' },
  { defId: 'grave_warden', name: 'Grave Wardens' },
  { defId: 'bloom_sentinel', name: 'Bloom Sentinels' },
];

export function dailyBounty(key: string): DailyBounty {
  const day = Math.floor(Date.parse(`${key}T00:00:00Z`) / 86400000);
  const idx =
    ((day % DAILY_BOUNTY_POOL.length) + DAILY_BOUNTY_POOL.length) % DAILY_BOUNTY_POOL.length;
  const pick = DAILY_BOUNTY_POOL[idx];
  return { defId: pick.defId, name: pick.name, target: 12, reward: 250 };
}

export interface BountyProgress {
  key: string;
  kills: number;
  claimed: boolean;
}

/** Fresh progress for a new day; stale days reset instead of carrying over. */
export function bountyForDay(bounty: BountyProgress, key: string): BountyProgress {
  return bounty.key === key ? bounty : { key, kills: 0, claimed: false };
}

export function claimDailyBounty(
  meta: { echoes: number; dailyBounty: BountyProgress },
  key: string
): { echoes: number; dailyBounty: BountyProgress; reward: number } | undefined {
  const contract = dailyBounty(key);
  const progress = bountyForDay(meta.dailyBounty, key);
  if (progress.claimed || progress.kills < contract.target) return undefined;
  return {
    echoes: meta.echoes + contract.reward,
    dailyBounty: { ...progress, claimed: true },
    reward: contract.reward,
  };
}

/**
 * The weekly contract: a bigger, slower mark than the daily one, deterministic
 * from the ISO week key so the whole Sanctuary hunts the same thing for seven
 * days. Forty kills for eight hundred echoes; reset rather than carry over.
 */
const WEEKLY_BOUNTY_POOL: ReadonlyArray<{ defId: string; name: string }> = [
  { defId: 'bone_picker', name: 'Bone Pickers' },
  { defId: 'lantern_wraith', name: 'Lantern Wraiths' },
  { defId: 'cinder_stalker', name: 'Cinder Stalkers' },
  { defId: 'spire_marksman', name: 'Spire Marksmen' },
  { defId: 'rime_duelist', name: 'Rime Duellists' },
  { defId: 'ossuary_chanter', name: 'Ossuary Chanters' },
];

export function weeklyBounty(key: string): DailyBounty {
  const match = /^(\d{4})-W(\d{2})$/.exec(key);
  const weeks = match ? Number(match[1]) * 53 + Number(match[2]) : 0;
  const idx =
    ((weeks % WEEKLY_BOUNTY_POOL.length) + WEEKLY_BOUNTY_POOL.length) % WEEKLY_BOUNTY_POOL.length;
  const pick = WEEKLY_BOUNTY_POOL[idx];
  return { defId: pick.defId, name: pick.name, target: 40, reward: 800 };
}

export function claimWeeklyBounty(
  meta: { echoes: number; weeklyBounty: BountyProgress },
  key: string
): { echoes: number; weeklyBounty: BountyProgress; reward: number } | undefined {
  const contract = weeklyBounty(key);
  const progress = bountyForDay(meta.weeklyBounty, key);
  if (progress.claimed || progress.kills < contract.target) return undefined;
  return {
    echoes: meta.echoes + contract.reward,
    weeklyBounty: { ...progress, claimed: true },
    reward: contract.reward,
  };
}

export interface QuestClaimMeta {
  echoes: number;
  vault: string[];
  trust: Record<string, number>;
  quests: { accepted: string[]; claimed: string[]; acceptedAt: Record<string, number> };
  trustGifted: string[];
}

/**
 * Settles a quest claim: base reward plus the friends' share, the relic if
 * it is new, the claim recorded, and trust in the giver deepened by one.
 * Reaching full trust earns a one-time parting gift: a relic from the back
 * room the walker does not own yet. Pure, so hub and tests share settlement.
 */
/** Echoes a tribute costs at a given trust level. */
export function tributeCost(trust: number): number {
  return 100 * (trust + 1);
}

function maybeTrustGift(
  vault: Set<string>,
  gifted: Set<string>,
  npcId: string,
  newTrust: number
): string | undefined {
  if (newTrust < 3 || gifted.has(npcId)) return undefined;
  const gift = EQUIPMENT.map((def) => def.id).find((id) => !vault.has(id));
  if (gift) {
    vault.add(gift);
    gifted.add(npcId);
  }
  return gift;
}

export function applyQuestClaim(
  meta: QuestClaimMeta,
  npcId: string,
  quest: QuestDef,
  now = Date.now(),
  bonusEchoes = 0
): QuestClaimMeta & { gift?: string; rush: number; bonus: number } {
  if (meta.quests.claimed.includes(quest.id))
    throw new Error(`Quest '${quest.id}' has already been claimed`);
  const trust = trustLevel({ trust: meta.trust }, npcId);
  const vault = new Set(meta.vault);
  if (quest.rewardItem) vault.add(quest.rewardItem);
  const gifted = new Set(meta.trustGifted);
  const newTrust = Math.min(3, trust + 1);
  const gift = maybeTrustGift(vault, gifted, npcId, newTrust);
  const rush = rushBonus(quest.rewardEchoes, meta.quests.acceptedAt[quest.id], now);
  return {
    echoes:
      meta.echoes + quest.rewardEchoes + trustBonus(quest.rewardEchoes, trust) + rush + bonusEchoes,
    vault: [...vault],
    trust: { ...meta.trust, [npcId]: newTrust },
    quests: {
      accepted: meta.quests.accepted,
      claimed: [...meta.quests.claimed, quest.id],
      acceptedAt: meta.quests.acceptedAt,
    },
    trustGifted: [...gifted],
    gift,
    rush,
    bonus: bonusEchoes,
  };
}

export interface TributeMeta {
  echoes: number;
  vault: string[];
  trust: Record<string, number>;
  trustGifted: string[];
  /** NPC ids whose specific-relic request has already been answered. */
  relicRequests?: string[];
}

/** A resident's specific-relic request: one relic from the vault, handed over for good. */
export interface RelicRequestDef {
  defId: string;
  echoes: number;
  line: string;
}

/**
 * Every resident wants one particular relic for their own work. Handing it
 * over removes it from the vault, deepens trust by one heart and pays echoes,
 * so a player's collection becomes a set of errands rather than a trophy shelf.
 */
export const RELIC_REQUESTS: Record<string, RelicRequestDef> = {
  archivist: {
    defId: 'choir_staff',
    echoes: 140,
    line: 'A staff that still holds a voice in it. The index can quote what it hears.',
  },
  smith: {
    defId: 'void_cleaver',
    echoes: 150,
    line: 'A blade that cuts memory cleanly. I want to learn how it keeps an edge.',
  },
  gardener: {
    defId: 'bog_crown',
    echoes: 130,
    line: 'Something that grew in the mire and refused to stop. I have a bed for it.',
  },
  warden: {
    defId: 'colossus_plate',
    echoes: 160,
    line: 'A wall that learned to walk. My recruits should study the seams.',
  },
  lamplighter: {
    defId: 'tide_lens',
    echoes: 140,
    line: 'A lens from the drowned harbor. One lamp on the coast has been dark too long.',
  },
  hearthkeeper: {
    defId: 'ember_core',
    echoes: 150,
    line: 'A hearth that never went out. The kitchen fire could use a coal of it.',
  },
};

export function requestForNpc(npcId: string): RelicRequestDef | undefined {
  return RELIC_REQUESTS[npcId];
}

/** Where a resident's relic request stands, for the hub card badge. */
export type RelicRequestStatus = 'none' | 'wanted' | 'ready' | 'done';

export function relicRequestStatus(
  meta: { vault: string[]; relicRequests?: string[] },
  npcId: string
): RelicRequestStatus {
  const request = requestForNpc(npcId);
  if (!request) return 'none';
  if ((meta.relicRequests ?? []).includes(npcId)) return 'done';
  return meta.vault.includes(request.defId) ? 'ready' : 'wanted';
}

/**
 * Settles a relic request: the wanted relic leaves the vault, echoes and one
 * heart of trust arrive, and the request is recorded so it cannot be farmed.
 * Returns undefined when the resident wants nothing, the vault lacks the relic
 * or the request is already answered.
 */
export function applyRelicRequest(
  meta: TributeMeta,
  npcId: string
): (TributeMeta & { gift?: string }) | undefined {
  const request = requestForNpc(npcId);
  if (!request) return undefined;
  const answered = meta.relicRequests ?? [];
  if (answered.includes(npcId)) return undefined;
  if (!meta.vault.includes(request.defId)) return undefined;
  const vault = new Set(meta.vault);
  vault.delete(request.defId);
  const gifted = new Set(meta.trustGifted);
  const trust = trustLevel({ trust: meta.trust }, npcId);
  const newTrust = Math.min(3, trust + 1);
  const gift = maybeTrustGift(vault, gifted, npcId, newTrust);
  return {
    echoes: meta.echoes + request.echoes,
    vault: [...vault],
    trust: { ...meta.trust, [npcId]: newTrust },
    trustGifted: [...gifted],
    relicRequests: [...answered, npcId],
    gift,
  };
}

/**
 * One practical line per resident about the road ahead, offered on their page
 * beside the task and the relic request.
 */
export const ROAD_HINTS: Record<string, string> = {
  archivist:
    'Fragments cluster near sealed doors. If a room looks empty, look up — the index always does.',
  smith: 'Every guardian flinches after its third swing. Learn the rhythm before you answer it.',
  gardener:
    'Clear a whole floor and the Sanctuary grows back stronger. The bonus is worth the extra room.',
  warden: 'Checkpoints bank what you carry. Descend a section before you gamble on a new relic.',
  lamplighter:
    'A graze is a near miss that feeds your flow. Step close, then step out — do not run away.',
  hearthkeeper:
    'Rest before a long descent. Elders say the stew remembers the section you survived.',
};

/**
 * Gift-giving: echoes for trust, one tribute per heart. Pure; the hub
 * checks the wallet before calling.
 */
export function applyTribute(
  meta: TributeMeta,
  npcId: string
): (TributeMeta & { gift?: string }) | undefined {
  const trust = trustLevel({ trust: meta.trust }, npcId);
  if (trust >= 3) return undefined;
  const cost = tributeCost(trust);
  if (meta.echoes < cost) return undefined;
  const vault = new Set(meta.vault);
  const gifted = new Set(meta.trustGifted);
  const newTrust = trust + 1;
  const gift = maybeTrustGift(vault, gifted, npcId, newTrust);
  return {
    echoes: meta.echoes - cost,
    vault: [...vault],
    trust: { ...meta.trust, [npcId]: newTrust },
    trustGifted: [...gifted],
    gift,
  };
}

export function questStateFor(
  quest: QuestDef | undefined,
  accepted: boolean,
  claimed: boolean,
  progress: number
): QuestState {
  if (!quest || claimed) return 'done';
  if (accepted && progress >= quest.target) return 'ready';
  if (accepted) return 'accepted';
  return 'available';
}

export function npcStories(
  npcId: string,
  snapshot: QuestSnapshot,
  victories: number,
  questState: QuestState
): string[] {
  return (NPC_STORIES[npcId] ?? [])
    .filter(
      (story) =>
        (story.minDepth === undefined || snapshot.depth >= story.minDepth) &&
        (story.minBosses === undefined || snapshot.bosses >= story.minBosses) &&
        (story.minVictories === undefined || victories >= story.minVictories) &&
        (story.questState === undefined || story.questState === questState)
    )
    .map((story) => story.text);
}

/** Short lines residents call out while the walker lingers nearby. */
export const NPC_AMBIENT: Record<string, readonly string[]> = {
  archivist: ['Another name for the index, Walker.', 'The shelves remember what you forget.'],
  smith: ['Mind the edge. It minds you.', 'Bring me back something broken.'],
  gardener: ['Water the cuttings if you pass.', 'Green things first. Always.'],
  warden: ['Drill forms before you go.', 'The gate holds. See that you do.'],
  lamplighter: ['Keep to the lit road.', 'A trimmed lamp is a kept promise.'],
  hearthkeeper: ['Soup is on. Sit when you can.', 'Save me a story for supper.'],
};

/**
 * Stories residents tell as the walker earns them: task-bound beats plus
 * recollections that unlock with depth, guardians and victories.
 */
export const NPC_STORIES: Record<string, readonly NpcStory[]> = {
  archivist: [
    {
      text: 'The index began as one shelf and a stubborn refusal to forget.',
      questState: 'available',
    },
    {
      text: 'Four names. You brought four names back. The shelf feels heavier already.',
      questState: 'done',
    },
    {
      text: 'Past the foundry the records go strange — pages fused to slag. Bring me what survives.',
      minDepth: 6,
    },
    {
      text: 'The tide took whole streets of names. If you walk the harbor, listen for them.',
      minDepth: 7,
    },
    { text: 'Guardians fall and the index grows teeth. Keep count for me.', minBosses: 5 },
    {
      text: 'A walker who wins comes home heavier. The shelf knows your step now.',
      minVictories: 1,
    },
    {
      text: 'The Gilded Reliquary keeps a ledger of every relic that passes through it. Bring back one line.',
      minDepth: 21,
    },
    {
      text: 'The first name is not in the index. It is the index. Bring it back carefully.',
      minDepth: 24,
    },
  ],
  smith: [
    {
      text: 'First hammer I ever held was my mother’s. Still rings true.',
      questState: 'available',
    },
    { text: 'Cinder work for cinder hands. You earned that edge.', questState: 'done' },
    {
      text: 'Storm steel is brittle until you fold the lightning out of it. The warlord never learned that.',
      minDepth: 14,
    },
    {
      text: 'Bring me a blademaster’s sword if you best one. I want to study the drowning in it.',
      minBosses: 3,
    },
    {
      text: 'Reliquary steel rings like a bell with no tongue. Bring me a shard and I will forge the answer.',
      minDepth: 21,
    },
  ],
  gardener: [
    {
      text: 'The first cutting I planted here died. The second one refused to.',
      questState: 'available',
    },
    {
      text: 'Four gardens green again. The sanctuary breathes easier, and so do I.',
      questState: 'done',
    },
    {
      text: 'Bloom petals close at night and dream of the mire. Do not ask how I know.',
      minDepth: 12,
    },
    { text: 'Frost moss only roots where something brave stood still. Like you.', minDepth: 10 },
    {
      text: 'The Salt Orchard grows fruit that tastes of the road home. I have never managed to keep one alive here.',
      minDepth: 22,
    },
  ],
  warden: [
    {
      text: 'Eight sections. That is the furthest any walker got before you. Beat it.',
      questState: 'available',
    },
    {
      text: 'Eight sections, reached and returned from. The gate log has your name underlined twice.',
      questState: 'done',
    },
    {
      text: 'The spire drills day and night. Match their forms and their warlord falls like any recruit.',
      minDepth: 14,
    },
    { text: 'Five guardians down. The road behind you is quiet. Good.', minBosses: 5 },
    {
      text: 'The reliquary gate does not open for strength. It opens for a walker who has kept a promise.',
      minDepth: 21,
    },
    {
      text: 'Past the Keeper there is no gate. That is what worries me. Come back through the one you left.',
      minDepth: 23,
    },
  ],
  lamplighter: [
    {
      text: 'Every lamp here was lit from one flame, carried out of the first dark.',
      questState: 'available',
    },
    { text: 'Five guardians quiet. My rounds are a walk in the park now.', questState: 'done' },
    {
      text: 'The harbor lamps burn green ever since the tide came. Still counts as lit.',
      minDepth: 7,
    },
    { text: 'A victor’s lamp burns a shade brighter. I can always tell.', minVictories: 1 },
    {
      text: 'Salt-white lamps burn without oil. I have stopped asking the orchard why.',
      minDepth: 22,
    },
  ],
  hearthkeeper: [
    {
      text: 'The stew recipe is older than the forgetting. The forgetting never got the recipe.',
      questState: 'available',
    },
    { text: 'Twelve sections of stories. You have fed this house for a year.', questState: 'done' },
    {
      text: 'Blademasters ate here once, before the harbor drowned. Terrible tippers, wonderful swordsmen.',
      minDepth: 7,
    },
    {
      text: 'Storm knights drink their soup cold and standing up. I allow it. Barely.',
      minDepth: 14,
    },
    {
      text: 'The reliquary road is long enough to make a stew of its own. Bring me the story that goes with it.',
      minDepth: 21,
    },
  ],
};

/** The meta-shaped subset the snapshot can read when the caller has it. */
export interface QuestSource extends SanctuaryProgress {
  vault?: readonly string[];
  trust?: Readonly<Record<string, number>>;
  eliteKills?: number;
}

export function questSnapshot(
  fragments: readonly string[],
  kills: number,
  progress: QuestSource,
  depth = 0,
  bosses = 0
): QuestSnapshot {
  const trust = Object.values(progress.trust ?? {}).reduce(
    (sum, hearts) => sum + Math.max(0, Math.min(3, hearts)),
    0
  );
  return {
    fragments: fragments.length,
    kills,
    restored: restoredLevels(progress),
    depth,
    bosses,
    elites: Math.max(0, progress.eliteKills ?? 0),
    relics: new Set(progress.vault ?? []).size,
    trust,
  };
}

/** Uncapped objective value, so bonus tiers can read past the base target. */
export function questRawProgress(def: QuestDef, snapshot: QuestSnapshot): number {
  const raw =
    def.kind === 'fragments'
      ? snapshot.fragments
      : def.kind === 'kills'
        ? snapshot.kills
        : def.kind === 'restored'
          ? snapshot.restored
          : def.kind === 'depth'
            ? snapshot.depth
            : def.kind === 'bosses'
              ? snapshot.bosses
              : def.kind === 'elites'
                ? snapshot.elites
                : def.kind === 'relics'
                  ? snapshot.relics
                  : snapshot.trust;
  return Math.max(0, Math.floor(raw));
}

export function questProgress(def: QuestDef, snapshot: QuestSnapshot): number {
  return Math.min(def.target, questRawProgress(def, snapshot));
}

/**
 * Optional bonus tier: 20% past the base target (clamped to what the game can
 * actually deliver) pays 40% of the base echoes on top. It gives every quest a
 * reason to be pushed a little further instead of claimed at the first tick.
 */
const QUEST_BONUS_CAPS: Record<QuestKind, number> = {
  fragments: 40,
  kills: 9999,
  restored: 12,
  depth: 26,
  bosses: 99,
  elites: 999,
  relics: 28,
  trust: 18,
};

export function questBonus(def: QuestDef): { target: number; echoes: number } | undefined {
  const target = Math.min(QUEST_BONUS_CAPS[def.kind], Math.ceil(def.target * 1.2));
  if (target <= def.target) return undefined;
  return { target, echoes: Math.round(def.rewardEchoes * 0.4) };
}

export function questBonusReached(def: QuestDef, snapshot: QuestSnapshot): boolean {
  const bonus = questBonus(def);
  return !!bonus && questRawProgress(def, snapshot) >= bonus.target;
}

/** "Chapter 2 of 3" for a resident's task, used by the journal and board. */
export function questChapterLabel(def: QuestDef): string {
  const chapters = questsForNpcList(def.npcId);
  const index = chapters.findIndex((chapter) => chapter.id === def.id);
  return `Chapter ${Math.max(1, index + 1)} of ${chapters.length}`;
}

/** Kept for callers that only need one structure's level. */
export function structureLevel(progress: SanctuaryProgress, id: string): number {
  return restorationLevel(progress, id);
}
