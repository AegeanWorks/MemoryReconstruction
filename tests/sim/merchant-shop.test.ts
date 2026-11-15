import { describe, expect, it } from 'vitest';
import { NO_INPUT, type Interactable } from '../../src/sim/entities';
import { createRun } from '../../src/sim/run';
import { World } from '../../src/sim/world';

const DT = 1 / 60;

function stall(depth = 0) {
  const run = createRun(4, []);
  run.depth = depth;
  const world = new World(run);
  const merchant: Interactable = {
    id: 9001,
    kind: 'merchant',
    x: 120,
    y: 120,
    used: false,
    cost: 0,
  };
  world.interactables.push(merchant);
  world.player.shards = 500;
  return { run, world, merchant };
}

describe('a maze merchant sells consumables', () => {
  it('stocks red and blue flasks, bombs, traps and one relic priced in shards', () => {
    const { world, merchant } = stall(0);
    const stock = world.shopStock(merchant.id);
    expect(stock.map((item) => item.id)).toEqual(['health', 'mana', 'bomb', 'trap', 'relic']);
    expect(stock.find((item) => item.id === 'mana')!.cost).toBe(30);
    expect(stock.find((item) => item.id === 'health')!.cost).toBe(24);
    expect(stock.every((item) => !item.sold)).toBe(true);
  });

  it('raises prices with the section', () => {
    const { world, merchant } = stall(4);
    const cost = (id: string): number =>
      world.shopStock(merchant.id).find((item) => item.id === id)!.cost;
    expect(cost('health')).toBe(24 + 24);
    expect(cost('mana')).toBe(30 + 28);
    expect(cost('relic')).toBe(110 + 88);
  });

  it('buys a mana flask, takes the shards and marks the line sold', () => {
    const { world, merchant } = stall(0);
    const before = world.player.shards;
    expect(world.buyFromShop(merchant.id, 'mana')).toBe(true);
    expect(world.player.manaPotions).toBe(2);
    expect(world.player.shards).toBe(before - 30);
    expect(world.shopStock(merchant.id).find((item) => item.id === 'mana')!.sold).toBe(true);
    // The same line cannot be bought twice.
    expect(world.buyFromShop(merchant.id, 'mana')).toBe(false);
  });

  it('sells bombs and traps in pairs', () => {
    const { world, merchant } = stall(0);
    const bombs = world.player.bombs;
    const traps = world.player.traps;
    expect(world.buyFromShop(merchant.id, 'bomb')).toBe(true);
    expect(world.buyFromShop(merchant.id, 'trap')).toBe(true);
    expect(world.player.bombs).toBe(bombs + 2);
    expect(world.player.traps).toBe(traps + 2);
  });

  it('refuses what the purse cannot cover and a full flask rack', () => {
    const { world, merchant } = stall(0);
    world.player.shards = 10;
    expect(world.buyFromShop(merchant.id, 'mana')).toBe(false);
    world.player.shards = 500;
    world.player.potions = world.player.stats.maxPotions;
    expect(world.buyFromShop(merchant.id, 'health')).toBe(false);
  });

  it('drops the merchant relic as a pickup on the floor', () => {
    const { world, merchant } = stall(0);
    expect(world.buyFromShop(merchant.id, 'relic')).toBe(true);
    expect(world.pickups.some((item) => item.kind === 'equipment')).toBe(true);
  });

  it('opens the shop instead of charging when the walker interacts', () => {
    const { world, merchant } = stall(0);
    world.player.x = merchant.x;
    world.player.y = merchant.y + 20;
    const shards = world.player.shards;
    const events = world.step({ ...NO_INPUT, interact: true }, DT);
    expect(events.some((event) => event.type === 'shop')).toBe(true);
    expect(world.player.shards).toBe(shards);
    expect(world.pickups).toHaveLength(0);
  });
});
