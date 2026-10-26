/** NPCs and their quests. Progress is derived from the save, never stored twice. */
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
};

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
