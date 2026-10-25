/**
 * Events a world step emits. The view turns them into effects, the audio
 * layer into sounds and the UI into messages; the sim never depends on them.
 */
import type { AttackKind, InteractableKind, PickupKind } from './entities';

export type SimEvent =
  | { type: 'swing'; x: number; y: number; angle: number; combo: number }
  | { type: 'dash'; x: number; y: number }
  | { type: 'bolt'; x: number; y: number; angle: number }
  | { type: 'hit'; x: number; y: number; amount: number; crit: boolean; target: 'enemy' | 'player' }
  | { type: 'shockwave'; x: number; y: number; radius: number }
  | { type: 'enemySpawned'; id: number; x: number; y: number }
  | { type: 'enemyWindup'; id: number; attack: AttackKind }
  | { type: 'enemyAttack'; id: number; attack: AttackKind; x: number; y: number }
  | { type: 'enemyDied'; id: number; x: number; y: number; boss: boolean }
  | { type: 'playerHurt'; amount: number }
  | { type: 'playerDied' }
  | { type: 'potion'; healed: number }
  | { type: 'pickup'; kind: PickupKind; x: number; y: number; amount: number }
  | { type: 'levelUp'; level: number }
  | { type: 'roomLocked'; roomId: number }
  | { type: 'roomCleared'; roomId: number }
  | { type: 'bossIntro'; name: string }
  | { type: 'bossPhase'; phase: number }
  | { type: 'fragmentFound'; fragmentId: string }
  | { type: 'interact'; kind: InteractableKind; x: number; y: number }
  | { type: 'notice'; text: string }
  | { type: 'floorExit' }
  | { type: 'victory' }
  | { type: 'shake'; strength: number };
