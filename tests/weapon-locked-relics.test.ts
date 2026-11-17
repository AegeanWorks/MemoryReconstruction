import { describe, expect, it } from 'vitest';
import equipmentJson from '../src/data/equipment.json';
import {
  EQUIPMENT,
  applyEquipment,
  emptyEquipment,
  equipmentDef,
  liveEquipment,
  weaponAllows,
} from '../src/sim/equipment';
import { refreshStats, createPlayer } from '../src/sim/player';
import { computeStats } from '../src/sim/upgrades';
import { weaponDef } from '../src/sim/weapons';
import { World } from '../src/sim/world';
import { createRun } from '../src/sim/run';

const restricted = EQUIPMENT.filter((def) => (def.restrictTo ?? []).length > 0);

describe('weapon-locked relics', () => {
  it('ships at least one relic locked to each stance', () => {
    const stances = new Set(restricted.flatMap((def) => def.restrictTo ?? []));
    expect([...stances].sort()).toEqual(['greatsword', 'spear', 'sword']);
    for (const def of restricted) {
      for (const id of def.restrictTo ?? []) expect(weaponDef(id).id).toBe(id);
    }
  });

  it('allows only the listed stances', () => {
    const def = equipmentDef('duelist_mantle');
    expect(weaponAllows(def, 'spear')).toBe(true);
    expect(weaponAllows(def, 'sword')).toBe(false);
    expect(weaponAllows(def, 'greatsword')).toBe(false);
    // Unrestricted relics work everywhere.
    expect(weaponAllows(equipmentDef('crystal_mail'), 'sword')).toBe(true);
    expect(weaponAllows(equipmentDef('crystal_mail'), 'greatsword')).toBe(true);
  });

  it('drops locked relics from the live set but keeps them in the slots', () => {
    const equipped = {
      ...emptyEquipment(),
      armor: { uid: 1, defId: 'duelist_mantle' },
      trinket: { uid: 2, defId: 'ember_charm' },
    };
    const withSpear = liveEquipment(equipped, 'spear')!;
    expect(withSpear.armor?.defId).toBe('duelist_mantle');
    expect(withSpear.trinket?.defId).toBe('ember_charm');
    const withSword = liveEquipment(equipped, 'sword')!;
    expect(withSword.armor).toBeNull();
    expect(withSword.trinket?.defId).toBe('ember_charm');
    // The worn slot still remembers the relic, so it comes back on a stance swap.
    expect(equipped.armor?.defId).toBe('duelist_mantle');
  });

  it('withholds the locked relic’s mods until the stance matches', () => {
    const equipped = {
      ...emptyEquipment(),
      armor: { uid: 1, defId: 'duelist_mantle' },
    };
    const base = computeStats({});
    const withSpear = applyEquipment(base, equipped, 'spear');
    const withSword = applyEquipment(base, equipped, 'sword');
    expect(withSpear.moveSpeed).toBeGreaterThan(withSword.moveSpeed);
    expect(withSword.moveSpeed).toBe(base.moveSpeed);
  });

  it('refuses to equip a locked relic with the wrong stance held', () => {
    const world = new World(createRun(11, []));
    const p = world.player;
    p.weapon = 'sword';
    p.inventory.push({ uid: 900, defId: 'duelist_mantle' });
    expect(world.equipItem(900)).toBe(false);
    expect(p.equipment.armor).toBeNull();
    expect(p.inventory.some((i) => i.uid === 900)).toBe(true);

    p.weapon = 'spear';
    expect(world.equipItem(900)).toBe(true);
    expect(p.equipment.armor?.defId).toBe('duelist_mantle');
  });

  it('recomputes stats when the stance changes', () => {
    const player = createPlayer(0, 0);
    player.equipment.armor = { uid: 1, defId: 'duelist_mantle' };
    player.weapon = 'spear';
    refreshStats(player);
    const withSpear = player.stats.moveSpeed;
    player.weapon = 'greatsword';
    refreshStats(player);
    expect(player.stats.moveSpeed).not.toBe(withSpear);
    player.weapon = 'spear';
    refreshStats(player);
    expect(player.stats.moveSpeed).toBe(withSpear);
  });

  it('keeps the data honest: every restriction names a real stance', () => {
    const raw = (equipmentJson as { items: Array<{ id: string; restrictTo?: string[] }> }).items;
    for (const item of raw) {
      for (const id of item.restrictTo ?? []) expect(() => weaponDef(id)).not.toThrow();
    }
  });
});
