import { describe, expect, it } from 'vitest';
import { roomCentrePx } from '../../src/sim/dungeon';
import { NO_INPUT } from '../../src/sim/entities';
import { createRun } from '../../src/sim/run';
import { World } from '../../src/sim/world';

const DT = 1 / 60;

function newWorld(depth = 4, seed = 20261108): World {
  const run = createRun(seed, []);
  run.depth = depth;
  return new World(run);
}

function standAt(world: World, x: number, y: number): void {
  world.player.x = x;
  world.player.y = y;
}

describe('frontier world systems', () => {
  it('seals a vault until its lever opens the wall into a door', () => {
    const world = newWorld();
    const vault = world.floor.rooms.find((r) => r.kind === 'vault');
    expect(vault).toBeDefined();
    expect(vault!.sealed).toBe(true);
    const door = vault!.doors[0].tiles[0];
    expect(world.grid.isSolid(door.x, door.y)).toBe(true);
    const lever = world.interactables.find(
      (i) => i.kind === 'lever' && i.roomId === vault!.id
    );
    expect(lever).toBeDefined();
    standAt(world, lever!.x, lever!.y);
    const events = world.step({ ...NO_INPUT, interact: true }, DT);
    expect(events.some((e) => e.type === 'secretOpened' && e.roomId === vault!.id)).toBe(true);
    expect(vault!.sealed).toBe(false);
    expect(world.grid.isSolid(door.x, door.y)).toBe(false);
    const chest = world.interactables.find((i) => i.kind === 'chest' && i.x === roomCentrePx(vault!).x);
    expect(chest).toBeDefined();
  });

  it('puts a Wayfarer in the entrance who offers a generous choice', () => {
    const world = newWorld();
    const wayfarer = world.interactables.find((i) => i.kind === 'wayfarer');
    expect(wayfarer).toBeDefined();
    standAt(world, wayfarer!.x, wayfarer!.y);
    world.step({ ...NO_INPUT, interact: true }, DT);
    expect(world.awaitingChoice).toBe(true);
    expect(world.run.pendingChoices[0].source).toBe('wayfarer');
    expect(world.run.pendingChoices[0].options.length).toBeGreaterThan(0);
  });

  it('moves the vault lever out of the entrance room', () => {
    const world = newWorld();
    const vault = world.floor.rooms.find((r) => r.kind === 'vault')!;
    const lever = world.interactables.find(
      (i) => i.kind === 'lever' && i.roomId === vault.id
    )!;
    const start = world.floor.rooms[world.floor.startRoom];
    const tx = Math.floor(lever.x / 32);
    const ty = Math.floor(lever.y / 32);
    const insideStart = tx >= start.x && tx < start.x + start.w && ty >= start.y && ty < start.y + start.h;
    expect(insideStart).toBe(false);
  });

  it('lets the Ferryman sell a crossing to the floor guardian', () => {
    const world = newWorld();
    const ferryman = world.interactables.find((i) => i.kind === 'ferryman');
    expect(ferryman).toBeDefined();
    world.player.shards = ferryman!.cost + 10;
    const before = world.player.shards;
    standAt(world, ferryman!.x, ferryman!.y);
    const events = world.step({ ...NO_INPUT, interact: true }, DT);
    expect(events.some((e) => e.type === 'blink')).toBe(true);
    expect(world.currentRoom()?.kind).toBe('boss');
    expect(world.player.shards).toBe(before - ferryman!.cost);
    expect(ferryman!.used).toBe(true);
  });

  it('lets the waystone carry the walker from the entrance to the deepest visited room', () => {
    const world = newWorld();
    const waystone = world.interactables.find((i) => i.kind === 'waystone');
    expect(waystone).toBeDefined();
    const start = world.floor.rooms[world.floor.startRoom];
    const target = world.floor.rooms.find(
      (r) => r.id !== start.id && r.kind === 'combat' && r.distance >= 2
    )!;
    world.visited[target.id] = true;
    standAt(world, waystone!.x, waystone!.y);
    const events = world.step({ ...NO_INPUT, interact: true }, DT);
    expect(events.some((e) => e.type === 'blink')).toBe(true);
    expect(world.currentRoom()?.id).toBe(target.id);
    expect(waystone!.used).toBe(true);
  });
});
