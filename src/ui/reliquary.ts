/**
 * Empty-state copy for the Reliquary art. The caption must never claim that a
 * relic waits on the shrine when the vault is empty or nothing is attuned.
 */
export function reliquaryCaption(attuned: string | null): string {
  return attuned ? 'The attuned relic waits on the shrine.' : 'No relic waits on the shrine yet.';
}
