/**
 * Which interactables get the fountain's animated water pool.
 *
 * The shrine got its own gabled sprite with a memory flame, so it must not
 * inherit the fountain's water ripples. The wellspring is a built structure
 * and keeps the pool; chests use their own gleam effect.
 */
export function hasWaterEffect(kind: string, structureId?: string): boolean {
  return kind === 'fountain' || (kind === 'structure' && structureId === 'wellspring');
}
