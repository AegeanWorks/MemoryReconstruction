/**
 * A small corner note that confirms a save. A burst of writes (a purchase saves at once) shows one
 * note, not a flicker. A failed write stays up longer, because the player has to act on it.
 */
import { h } from './dom';

const SHOWN_MS = 1200;
const FAILED_MS = 6000;

/** Mounts the note in `parent` and returns the function that reports one write. */
export function createSaveIndicator(parent: HTMLElement): (ok: boolean) => void {
  const note = h('div', { class: 'save-indicator', role: 'status', 'aria-live': 'polite' });
  parent.append(note);
  let timer: number | undefined;
  return (ok) => {
    note.textContent = ok ? 'Saved' : 'Could not save: browser storage may be full or blocked';
    note.classList.toggle('failed', !ok);
    note.classList.add('shown');
    if (timer !== undefined) window.clearTimeout(timer);
    timer = window.setTimeout(() => note.classList.remove('shown'), ok ? SHOWN_MS : FAILED_MS);
  };
}
