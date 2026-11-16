/**
 * On-screen touch controls: a move stick on the left, an aim-and-attack stick on the right and
 * a cluster of action buttons. It only reports finger positions to a `TouchState`; all the maths
 * lives there. The overlay is mounted inside the HUD (so it hides with it on menus and the title)
 * and is shown by CSS only on coarse-pointer screens.
 */
import type { TouchState, TouchTap } from '../input/touch';
import { h } from './dom';

/** Thumb travel from the stick centre that counts as fully pushed, in CSS pixels. */
const STICK_RADIUS = 48;

/** A full-screen panel the touch rail can open without a keyboard. */
export type TouchMenuAction = 'pause' | 'map' | 'inventory' | 'quests';

function makeStick(
  kind: 'move' | 'aim',
  onPush: (dx: number, dy: number) => void,
  onRelease: () => void
): HTMLElement {
  const knob = h('i', { class: 'knob' });
  const root = h('div', { class: `touch-stick ${kind}` }, knob);
  let finger: number | undefined;

  const track = (e: PointerEvent): void => {
    const box = root.getBoundingClientRect();
    const dx = e.clientX - (box.left + box.width / 2);
    const dy = e.clientY - (box.top + box.height / 2);
    const length = Math.hypot(dx, dy);
    const scale = length > STICK_RADIUS ? STICK_RADIUS / length : 1;
    knob.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;
    onPush(dx, dy);
  };
  const release = (e: PointerEvent): void => {
    if (e.pointerId !== finger) return;
    finger = undefined;
    knob.style.transform = '';
    root.classList.remove('on');
    onRelease();
  };

  root.addEventListener('pointerdown', (e) => {
    if (finger !== undefined) return;
    finger = e.pointerId;
    root.setPointerCapture(e.pointerId);
    root.classList.add('on');
    e.preventDefault();
    track(e);
  });
  root.addEventListener('pointermove', (e) => {
    if (e.pointerId === finger) track(e);
  });
  root.addEventListener('pointerup', release);
  root.addEventListener('pointercancel', release);
  return root;
}

function makeButton(
  cls: string,
  label: string,
  onDown: () => void,
  onUp?: () => void
): HTMLElement {
  const button = h('div', { class: cls, role: 'button', 'aria-label': label }, label);
  let finger: number | undefined;
  button.addEventListener('pointerdown', (e) => {
    if (finger !== undefined) return;
    finger = e.pointerId;
    button.setPointerCapture(e.pointerId);
    button.classList.add('on');
    e.preventDefault();
    onDown();
  });
  const up = (e: PointerEvent): void => {
    if (e.pointerId !== finger) return;
    finger = undefined;
    button.classList.remove('on');
    onUp?.();
  };
  button.addEventListener('pointerup', up);
  button.addEventListener('pointercancel', up);
  return button;
}

/** Builds the overlay. `currentWeapon` returns the held stance index (0 to 2) for the stance button. */
export function createTouchControls(
  touch: TouchState,
  currentWeapon: () => number,
  onMenu: (action: TouchMenuAction) => void
): HTMLElement {
  const tap = (action: TouchTap) => (): void => touch.tap(action);
  const menu = (action: TouchMenuAction) => (): void => {
    // Drop any held stick or latch first, so a menu cannot open with an action still queued.
    touch.reset();
    onMenu(action);
  };
  const move = makeStick(
    'move',
    (dx, dy) => touch.setMove(dx, dy, STICK_RADIUS),
    () => touch.clearMove()
  );
  const aim = makeStick(
    'aim',
    (dx, dy) => touch.setAim(dx, dy, STICK_RADIUS),
    () => touch.clearAim()
  );
  const utility = h(
    'div',
    { class: 'touch-utility' },
    makeButton('touch-btn util', 'Relics', menu('inventory')),
    makeButton('touch-btn util', 'Quests', menu('quests')),
    makeButton('touch-btn util', 'Map', menu('map')),
    makeButton('touch-btn util', 'Menu', menu('pause'))
  );
  const buttons = h(
    'div',
    { class: 'touch-buttons' },
    makeButton('touch-btn dash', 'Dash', tap('dash')),
    makeButton(
      'touch-btn bolt',
      'Bolt',
      () => touch.hold('bolt', true),
      () => touch.hold('bolt', false)
    ),
    makeButton('touch-btn potion', 'Flask', tap('potion')),
    makeButton('touch-btn mana', 'Mana', tap('manaPotion')),
    makeButton('touch-btn interact', 'Use', tap('interact')),
    makeButton('touch-btn stance', 'Stance', () => {
      touch.nextWeapon(currentWeapon());
    }),
    makeButton('touch-btn art', 'Art', tap('art')),
    makeButton('touch-btn rage', 'Rage', tap('rage')),
    makeButton('touch-btn bomb', 'Bomb', tap('bomb')),
    makeButton('touch-btn trap', 'Trap', tap('trap'))
  );
  return h('div', { class: 'touch-controls', 'aria-hidden': 'true' }, utility, move, aim, buttons);
}
