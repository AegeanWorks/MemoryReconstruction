/** NPCs and their quests. Progress is derived from the save, never stored twice. */
import { EQUIPMENT } from './equipment';
import { restorationLevel, restoredLevels, type SanctuaryProgress } from './hub';

export type QuestKind = 'fragments' | 'kills' | 'restored' | 'depth' | 'bosses';

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
];

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
  now = Date.now()
): QuestClaimMeta & { gift?: string; rush: number } {
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
    echoes: meta.echoes + quest.rewardEchoes + trustBonus(quest.rewardEchoes, trust) + rush,
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
  };
}

export interface TributeMeta {
  echoes: number;
  vault: string[];
  trust: Record<string, number>;
  trustGifted: string[];
}

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
      text: 'The first name is not in the index. It is the index. Bring it back carefully.',
      minDepth: 22,
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
      text: 'Past the Keeper there is no gate. That is what worries me. Come back through the one you left.',
      minDepth: 22,
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
  ],
};

export function questSnapshot(
  fragments: readonly string[],
  kills: number,
  progress: SanctuaryProgress,
  depth = 0,
  bosses = 0
): QuestSnapshot {
  return {
    fragments: fragments.length,
    kills,
    restored: restoredLevels(progress),
    depth,
    bosses,
  };
}

export function questProgress(def: QuestDef, snapshot: QuestSnapshot): number {
  const raw =
    def.kind === 'fragments'
      ? snapshot.fragments
      : def.kind === 'kills'
        ? snapshot.kills
        : def.kind === 'restored'
          ? snapshot.restored
          : def.kind === 'depth'
            ? snapshot.depth
            : snapshot.bosses;
  return Math.max(0, Math.min(def.target, raw));
}

/** Kept for callers that only need one structure's level. */
export function structureLevel(progress: SanctuaryProgress, id: string): number {
  return restorationLevel(progress, id);
}
