/**
 * Melee weapons. Each one is a small combat stance: its own combo table,
 * reach/arc, movement commitment and swing effect. The sword is the baseline,
 * the spear trades width for reach and speed, the greatsword trades speed for
 * a wide, heavy finisher that always shockwaves.
 */
export type WeaponId = 'sword' | 'spear' | 'greatsword';

export interface WeaponStep {
  /** Multiplier on melee damage. */
  damage: number;
  reach: number;
  /** Half-angle of the hit arc, radians. */
  halfArc: number;
  knockback: number;
  /** Base duration before attack speed. */
  duration: number;
}

export interface WeaponDef {
  id: WeaponId;
  name: string;
  blurb: string;
  /** How the swing is drawn: crescent, thrust line or wide crescent. */
  style: 'arc' | 'thrust' | 'wide';
  steps: readonly WeaponStep[];
  /** Movement multiplier while swinging: heavy weapons root you more. */
  moveFactor: number;
  /** The last step always emits a shockwave, even without the upgrade. */
  finisherShockwave: boolean;
  /** Attack sheet playback speed; slower weapons read as heavier. */
  animationFps: number;
}

export const WEAPONS: readonly WeaponDef[] = [
  {
    id: 'sword',
    name: 'Sword',
    blurb: 'Three balanced cuts. The finisher sweeps wide.',
    style: 'arc',
    steps: [
      { damage: 1, reach: 54, halfArc: 1.0, knockback: 150, duration: 0.3 },
      { damage: 1.15, reach: 56, halfArc: 1.0, knockback: 170, duration: 0.3 },
      { damage: 1.8, reach: 64, halfArc: 1.45, knockback: 340, duration: 0.4 },
    ],
    moveFactor: 0.4,
    finisherShockwave: false,
    animationFps: 13,
  },
  {
    id: 'spear',
    name: 'Spear',
    blurb: 'Two long, narrow thrusts. Hits harder at max reach and keeps you mobile.',
    style: 'thrust',
    steps: [
      { damage: 0.9, reach: 86, halfArc: 0.34, knockback: 120, duration: 0.24 },
      { damage: 1.5, reach: 102, halfArc: 0.38, knockback: 230, duration: 0.34 },
    ],
    moveFactor: 0.68,
    finisherShockwave: false,
    animationFps: 18,
  },
  {
    id: 'greatsword',
    name: 'Greatsword',
    blurb: 'Two wide, slow arcs. The finisher always shockwaves, but you barely move.',
    style: 'wide',
    steps: [
      { damage: 1.35, reach: 68, halfArc: 1.35, knockback: 240, duration: 0.42 },
      { damage: 2.25, reach: 78, halfArc: 1.7, knockback: 420, duration: 0.54 },
    ],
    moveFactor: 0.24,
    finisherShockwave: true,
    animationFps: 9,
  },
];

const BY_ID = new Map(WEAPONS.map((weapon) => [weapon.id, weapon]));

export function weaponDef(id: string): WeaponDef {
  return BY_ID.get(id as WeaponId) ?? WEAPONS[0];
}

export function isWeaponId(id: unknown): id is WeaponId {
  return typeof id === 'string' && BY_ID.has(id as WeaponId);
}
