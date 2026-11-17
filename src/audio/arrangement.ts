/**
 * Procedural arrangement data, used when no rendered track exists.
 *
 * Ambient is a slow pad with sparse bells. Battle is a different piece of music,
 * not the same pad turned up: a faster tempo, a repeating bass figure drawn from
 * the scale, and percussive hits on the beat. The numbers here are pure data, so
 * the arrangement can be tested without an AudioContext.
 */
import type { BiomeId } from '../sim/content';

export type ArrangementMode = 'ambient' | 'battle';

export interface Arrangement {
  /** Beats per minute. */
  tempo: number;
  /** Bass steps as scale degrees; -1 is a rest. */
  bass: readonly number[];
  /** Where the percussion falls inside one bar, in beats. */
  hits: readonly number[];
  /** Bass note length as a fraction of a beat. */
  noteLength: number;
  /** Bell/lead notes per bar. */
  lead: number;
  /** Overall gain of the rhythmic layer, 0-1. */
  drive: number;
}

/**
 * One bar of four beats. Every battle figure is a different shape, so two biomes
 * never sound like the same fight, and the tempo rises with the depth of the run.
 */
const BATTLE: Record<BiomeId, Arrangement> = {
  ruins: {
    tempo: 104,
    bass: [0, 0, 2, 0, 3, 2, 0, -1],
    hits: [0, 2],
    noteLength: 0.5,
    lead: 2,
    drive: 0.5,
  },
  forest: {
    tempo: 118,
    bass: [0, 2, 0, 4, 0, 2, 3, 2],
    hits: [0, 1.5, 2, 3.5],
    noteLength: 0.4,
    lead: 3,
    drive: 0.55,
  },
  caves: {
    tempo: 96,
    bass: [0, -1, 0, 2, -1, 3, 0, -1],
    hits: [0, 2.5],
    noteLength: 0.7,
    lead: 1,
    drive: 0.45,
  },
  crystal: {
    tempo: 124,
    bass: [0, 3, 2, 3, 0, 3, 4, 3],
    hits: [0, 1, 2, 3],
    noteLength: 0.3,
    lead: 4,
    drive: 0.6,
  },
  ash: {
    tempo: 112,
    bass: [0, 0, 3, 0, 0, 4, 3, 0],
    hits: [0, 1.5, 2.5],
    noteLength: 0.45,
    lead: 2,
    drive: 0.6,
  },
  abyss: {
    tempo: 84,
    bass: [0, -1, 2, -1, 0, -1, 3, -1],
    hits: [0, 2],
    noteLength: 0.8,
    lead: 1,
    drive: 0.4,
  },
  void: {
    tempo: 100,
    bass: [0, 4, -1, 2, -1, 4, 0, -1],
    hits: [0, 1.5, 3],
    noteLength: 0.55,
    lead: 2,
    drive: 0.5,
  },
  frost: {
    tempo: 108,
    bass: [0, 2, 3, 2, 0, 4, 3, 2],
    hits: [0, 2],
    noteLength: 0.4,
    lead: 3,
    drive: 0.5,
  },
  bloom: {
    tempo: 126,
    bass: [0, 2, 4, 2, 3, 2, 0, 2],
    hits: [0, 1, 2, 3],
    noteLength: 0.35,
    lead: 4,
    drive: 0.58,
  },
  foundry: {
    tempo: 120,
    bass: [0, 0, 0, 3, 0, 0, 4, 3],
    hits: [0, 1, 2, 3],
    noteLength: 0.25,
    lead: 2,
    drive: 0.65,
  },
  mire: {
    tempo: 92,
    bass: [0, 2, -1, 2, 0, 3, -1, 2],
    hits: [0, 1.75, 3],
    noteLength: 0.6,
    lead: 2,
    drive: 0.45,
  },
  hive: {
    tempo: 132,
    bass: [0, 1, 0, 3, 0, 1, 3, 4],
    hits: [0, 0.75, 1.5, 2.25, 3],
    noteLength: 0.25,
    lead: 3,
    drive: 0.6,
  },
  catacomb: {
    tempo: 88,
    bass: [0, -1, 3, -1, 2, -1, 0, -1],
    hits: [0, 2],
    noteLength: 0.75,
    lead: 1,
    drive: 0.42,
  },
  tide: {
    tempo: 110,
    bass: [0, 2, 0, -1, 3, 2, 0, -1],
    hits: [0, 1.5, 2.5],
    noteLength: 0.5,
    lead: 2,
    drive: 0.5,
  },
  storm: {
    tempo: 128,
    bass: [0, 3, 4, 3, 0, 3, 2, 4],
    hits: [0, 1, 2, 3],
    noteLength: 0.3,
    lead: 4,
    drive: 0.62,
  },
  sanctuary: {
    tempo: 76,
    bass: [0, -1, 2, -1, 0, -1, 3, -1],
    hits: [0],
    noteLength: 0.9,
    lead: 1,
    drive: 0.3,
  },
};

/** Ambient is deliberately sparse: a slow pad, no bass figure, no pulse. */
function ambientSpec(): Arrangement {
  return {
    tempo: 52,
    bass: [-1, -1, -1, -1, -1, -1, -1, -1],
    hits: [],
    noteLength: 1,
    lead: 1,
    drive: 0,
  };
}

const AMBIENT = Object.fromEntries(
  (Object.keys(BATTLE) as BiomeId[]).map((biome) => [biome, ambientSpec()])
) as Record<BiomeId, Arrangement>;

/** The figure for a biome and mode. Ambient has no rhythm at all. */
export function arrangement(biome: BiomeId, mode: ArrangementMode): Arrangement {
  return (mode === 'battle' ? BATTLE : AMBIENT)[biome] ?? AMBIENT.ruins;
}

/** Seconds of one beat at the arrangement's tempo. */
export function beatSeconds(spec: Arrangement): number {
  return 60 / Math.max(30, spec.tempo);
}

/** True when a `tense` flag should be read as battle music. */
export function isBattleMode(tense: boolean): ArrangementMode {
  return tense ? 'battle' : 'ambient';
}
