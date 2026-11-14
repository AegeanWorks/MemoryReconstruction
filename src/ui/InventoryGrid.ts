/**
 * The paper doll and the bag grid at the top of the inventory: three worn-slot boxes around the
 * player, and a box for every bag slot. Relics move by pointer drag (mouse and touch) or by a plain
 * click. The list rows below stay the keyboard and detail path, so nothing here takes a tab stop.
 */
import {
  EQUIPMENT_SLOTS,
  INVENTORY_SLOTS,
  equipmentDef,
  type EquipmentItem,
  type EquipmentSlot,
  type EquipmentSlots,
} from '../sim/equipment';
import { gearLooks } from '../view/gearLook';
import { recolorSheetUrl } from './dollArt';
import { assetUrl, h } from './dom';
import {
  bagCells,
  dragStarted,
  parseDropTarget,
  resolveDrop,
  type DragSource,
} from './inventoryDrag';

export interface GridPlayer {
  inventory: readonly EquipmentItem[];
  equipment: EquipmentSlots;
  weapon: string;
}

export interface GridActions {
  equip: (uid: number) => void;
  unequip: (slot: EquipmentSlot) => void;
  /** A drop that cannot work; the message says why. */
  reject: (message: string) => void;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const GLYPHS: Record<EquipmentSlot, string> = {
  weapon: 'M12 2 L14.5 13 L12 16 L9.5 13 Z M7 16 H17 M12 16 V22',
  armor: 'M12 3 L20 6 V12 C20 17 16 20 12 22 C8 20 4 17 4 12 V6 Z',
  trinket: 'M12 3 L19 9 L12 21 L5 9 Z M5 9 H19',
};

function glyph(slot: EquipmentSlot): SVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'relic-glyph');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', GLYPHS[slot]);
  svg.append(path);
  return svg;
}

function label(item: EquipmentItem): string {
  const def = equipmentDef(item.defId);
  return `${def.name}${item.rank ? ` +${item.rank}` : ''} · ${def.rarity} ${def.slot}`;
}

/** A relic box. `source` is set when the relic can be dragged. */
function relicBox(
  item: EquipmentItem | null,
  slot: EquipmentSlot | null,
  dropValue: string | null
): HTMLElement {
  const def = item ? equipmentDef(item.defId) : null;
  const box = h('div', {
    class: `relic-box${def ? ` filled ${def.rarity}` : ' empty'}${slot ? ` slot-${slot}` : ''}`,
  });
  if (dropValue) box.dataset.drop = dropValue;
  if (item && def) {
    box.title = label(item);
    box.setAttribute('aria-label', label(item));
    box.append(glyph(def.slot));
    if (item.rank) box.append(h('span', { class: 'relic-rank' }, `+${item.rank}`));
  } else if (slot) {
    box.append(glyph(slot), h('span', { class: 'relic-slot-name' }, slot));
  }
  return box;
}

/** Turns a box into a drag source; a press that never moves is a click and calls `onClick`. */
function makeDraggable(
  box: HTMLElement,
  root: HTMLElement,
  source: DragSource,
  onClick: () => void,
  finish: (outcome: ReturnType<typeof resolveDrop>) => void
): void {
  box.classList.add('draggable');
  let origin: { x: number; y: number } | null = null;
  let ghost: HTMLElement | null = null;
  let hovered: Element | null = null;
  const targetAt = (x: number, y: number): HTMLElement | null =>
    (document.elementFromPoint(x, y)?.closest('[data-drop]') as HTMLElement | null) ?? null;
  const cleanup = (): void => {
    ghost?.remove();
    ghost = null;
    hovered?.classList.remove('drop-hover');
    hovered = null;
    box.classList.remove('dragging');
    root.classList.remove('drag-active');
    for (const zone of root.querySelectorAll('.drop-ok, .drop-bad')) {
      zone.classList.remove('drop-ok', 'drop-bad');
    }
    origin = null;
  };
  box.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    origin = { x: event.clientX, y: event.clientY };
    box.setPointerCapture(event.pointerId);
  });
  box.addEventListener('pointermove', (event) => {
    if (!origin) return;
    if (!ghost) {
      if (!dragStarted(event.clientX - origin.x, event.clientY - origin.y)) return;
      ghost = box.cloneNode(true) as HTMLElement;
      ghost.classList.add('relic-ghost');
      ghost.removeAttribute('data-drop');
      document.body.append(ghost);
      box.classList.add('dragging');
      root.classList.add('drag-active');
      for (const zone of root.querySelectorAll<HTMLElement>('[data-drop]')) {
        const target = parseDropTarget(zone.dataset.drop);
        const outcome = resolveDrop(source, target);
        if (outcome.action === 'equip' || outcome.action === 'unequip') {
          zone.classList.add('drop-ok');
        } else if (outcome.action === 'reject') {
          zone.classList.add('drop-bad');
        }
      }
    }
    ghost.style.left = `${event.clientX}px`;
    ghost.style.top = `${event.clientY}px`;
    const over = targetAt(event.clientX, event.clientY);
    if (over !== hovered) {
      hovered?.classList.remove('drop-hover');
      over?.classList.add('drop-hover');
      hovered = over;
    }
  });
  box.addEventListener('pointerup', (event) => {
    if (!origin) return;
    const dragged = ghost !== null;
    const over = dragged ? targetAt(event.clientX, event.clientY) : null;
    cleanup();
    if (!dragged) {
      onClick();
      return;
    }
    finish(resolveDrop(source, parseDropTarget(over?.dataset.drop)));
  });
  box.addEventListener('pointercancel', cleanup);
}

/** The doll and the bag grid for one player, wired to the three inventory actions. */
export function inventoryGrid(player: GridPlayer, actions: GridActions): HTMLElement {
  const root = h('div', { class: 'inv-grid' });
  const apply = (outcome: ReturnType<typeof resolveDrop>, run: () => void): void => {
    if (outcome.action === 'equip' || outcome.action === 'unequip') run();
    else if (outcome.action === 'reject') actions.reject(outcome.reason);
  };

  const slotBoxes = EQUIPMENT_SLOTS.map((slot) => {
    const item = player.equipment[slot];
    const box = relicBox(item, slot, `slot:${slot}`);
    if (item) {
      makeDraggable(
        box,
        root,
        { from: 'worn', slot },
        () => actions.unequip(slot),
        (outcome) => apply(outcome, () => actions.unequip(slot))
      );
    }
    return box;
  });

  const idleSheet = player.weapon === 'sword' ? 'idle' : `idle_${player.weapon}`;
  const sheetUrl = assetUrl(`sprites/player/${idleSheet}.png`);
  const looks = gearLooks(player.equipment);
  const figure = h('div', { class: 'doll-figure' });
  figure.style.backgroundImage = `url('${sheetUrl}')`;
  if (looks.armor && looks.armorId) {
    // Plain sheet first, the armoured one as soon as it is painted, so the doll never flashes empty.
    void recolorSheetUrl(sheetUrl, looks.armorId, looks.armor).then((url) => {
      figure.style.backgroundImage = `url('${url}')`;
    });
  }
  if (looks.trinket) {
    const orb = h('div', { class: 'doll-orb' });
    const color = `#${looks.trinket.color.toString(16).padStart(6, '0')}`;
    orb.style.setProperty('--orb', color);
    orb.style.setProperty('--orb-size', `${Math.round(14 * looks.trinket.scale)}px`);
    figure.append(orb);
  }
  const doll = h(
    'div',
    { class: 'doll', 'data-drop': 'doll' },
    slotBoxes[0],
    figure,
    slotBoxes[1],
    slotBoxes[2]
  );

  const cells = bagCells(player.inventory, INVENTORY_SLOTS).map((item) => {
    const box = relicBox(item, null, null);
    if (item) {
      const slot = equipmentDef(item.defId).slot;
      makeDraggable(
        box,
        root,
        { from: 'bag', slot },
        () => actions.equip(item.uid),
        (outcome) => apply(outcome, () => actions.equip(item.uid))
      );
    }
    return box;
  });
  const bag = h('div', { class: 'bag-grid', 'data-drop': 'bag' }, ...cells);

  root.append(
    doll,
    bag,
    h(
      'div',
      { class: 'inv-grid-hint' },
      'Drag a relic onto its slot or onto your wanderer to wear it. Drag a worn relic back to the bag to take it off.'
    )
  );
  return root;
}
