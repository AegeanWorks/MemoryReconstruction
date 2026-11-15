/**
 * The Saves screen: one card per save slot with what it holds, and the actions a player needs to
 * keep their progress safe: play it, export it to a file, import a file into it, or delete it.
 * Destructive actions take a second click; an import that would replace progress says so first.
 */
import type { SlotSummary } from '../save/SaveStore';
import { button, h } from './dom';
import { confirmButton } from './Screens';

/** A save file is a few kilobytes; anything near this is not one, so it is refused unread. */
export const MAX_IMPORT_BYTES = 1_000_000;

export function exportFileName(slot: number, date: Date): string {
  return `memory-reconstruction-slot${slot}-${date.toISOString().slice(0, 10)}.json`;
}

export function savedAtText(savedAt: string): string {
  if (!savedAt) return 'Saved before save slots existed';
  const when = new Date(savedAt);
  if (Number.isNaN(when.getTime())) return 'Saved at an unknown time';
  return `Saved ${when.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`;
}

export function slotHeadline(slot: SlotSummary): string {
  if (slot.empty) return 'Empty slot';
  return `${slot.echoes} echoes · ${slot.restorations} restorations · ${slot.runs} expeditions · section ${slot.bestDepth}`;
}

/** Offers `text` to the player as a file download. */
function download(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = h('a', { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface SavesScreenOptions {
  slots: SlotSummary[];
  /** Last result line: what was exported, imported or refused. */
  status: string;
  onPlay: (slot: number) => void;
  onExport: (slot: number) => { name: string; text: string } | undefined;
  onImport: (slot: number, text: string) => void;
  onDelete: (slot: number) => void;
  onStatus: (message: string) => void;
  onBack: () => void;
}

function importButton(slot: SlotSummary, opts: SavesScreenOptions): HTMLElement {
  const input = h('input', { type: 'file', accept: '.json,application/json', class: 'hidden' });
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      opts.onStatus(`${file.name} is too large to be a save file.`);
      return;
    }
    file
      .text()
      .then((text) => opts.onImport(slot.slot, text))
      .catch(() => opts.onStatus(`${file.name} could not be read.`));
  });
  const choose = (): void => input.click();
  const trigger = slot.empty
    ? button('Import', choose, 'btn small')
    : confirmButton('Import', 'Replace this slot?', choose, 'btn small');
  return h('span', {}, trigger, input);
}

function slotCard(slot: SlotSummary, opts: SavesScreenOptions): HTMLElement {
  const play = button(
    slot.active ? 'Playing' : slot.empty ? 'Start here' : 'Play',
    () => opts.onPlay(slot.slot),
    'btn small primary'
  );
  play.disabled = slot.active;
  const exportBtn = button(
    'Export',
    () => {
      const file = opts.onExport(slot.slot);
      if (!file) return;
      download(file.name, file.text);
      opts.onStatus(`Slot ${slot.slot} exported as ${file.name}.`);
    },
    'btn small'
  );
  exportBtn.disabled = slot.empty;
  const remove = confirmButton(
    'Delete',
    'Delete for good?',
    () => opts.onDelete(slot.slot),
    'btn small'
  );
  if (slot.empty && remove instanceof HTMLButtonElement) remove.disabled = true;
  return h(
    'div',
    { class: `panel save-slot${slot.active ? ' active' : ''}${slot.empty ? ' empty' : ''}` },
    h(
      'div',
      { class: 'save-slot-head' },
      h('span', { class: 'save-slot-name' }, `Slot ${slot.slot}`),
      slot.active ? h('span', { class: 'save-slot-tag' }, 'Active') : null
    ),
    h('div', { class: 'save-slot-line' }, slotHeadline(slot)),
    slot.empty
      ? null
      : h(
          'div',
          { class: 'save-slot-meta' },
          `${slot.fragments} memories · ${slot.hasRun ? 'expedition in progress' : 'no expedition in progress'} · ${savedAtText(slot.savedAt)}`
        ),
    h('div', { class: 'save-slot-actions' }, play, exportBtn, importButton(slot, opts), remove)
  );
}

export function savesScreen(opts: SavesScreenOptions): HTMLElement {
  return h(
    'div',
    { class: 'screen saves-screen' },
    h('div', { class: 'heading' }, 'Saves'),
    h(
      'div',
      { class: 'subtitle' },
      'Progress saves on its own. Export a slot to keep a copy outside this browser.'
    ),
    h('div', { class: 'save-slots' }, ...opts.slots.map((slot) => slotCard(slot, opts))),
    h('div', { class: 'save-status', role: 'status' }, opts.status),
    h('div', { class: 'menu' }, button('Back', opts.onBack))
  );
}
