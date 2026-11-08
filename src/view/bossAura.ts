import { bossPhaseFor } from '../sim/enemies';

/**
 * The boss aura's visual tier. Tiers 1-3 follow the simulation's own phase
 * thresholds so the tell never announces a phase the fight has not entered.
 * Tier 4 is a final flare inside phase two, not a new mechanic.
 */
export function bossAuraTier(health: number, maxHealth: number): 1 | 2 | 3 | 4 {
  const fraction = maxHealth > 0 ? health / maxHealth : 1;
  if (fraction < 0.25) return 4;
  return (bossPhaseFor(health, maxHealth) + 1) as 1 | 2 | 3;
}
