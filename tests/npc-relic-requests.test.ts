import { describe, expect, it } from 'vitest';
import { EQUIPMENT, equipmentDef } from '../src/sim/equipment';
import {
  NPCS,
  RELIC_REQUESTS,
  ROAD_HINTS,
  applyRelicRequest,
  requestForNpc,
  type TributeMeta,
} from '../src/sim/quests';
import { defaultMeta } from '../src/save/SaveStore';

const base = (overrides: Partial<TributeMeta> = {}): TributeMeta => ({
  echoes: 0,
  vault: [],
  trust: {},
  trustGifted: [],
  relicRequests: [],
  ...overrides,
});

describe('residents ask for a specific relic', () => {
  it('gives every resident one wanted relic that exists in the armoury', () => {
    const wanted = Object.values(RELIC_REQUESTS).map((request) => request.defId);
    expect(wanted).toHaveLength(Object.keys(NPCS).length);
    expect(new Set(wanted).size).toBe(wanted.length);
    for (const id of wanted) {
      expect(EQUIPMENT.map((def) => def.id)).toContain(id);
    }
    for (const npcId of Object.keys(NPCS)) {
      expect(requestForNpc(npcId), npcId).toBeDefined();
    }
    expect(requestForNpc('nobody')).toBeUndefined();
  });

  it('hands the relic over, pays echoes and deepens trust by one', () => {
    const request = RELIC_REQUESTS.archivist;
    const settled = applyRelicRequest(
      base({ echoes: 5, vault: ['choir_staff', 'sun_core'] }),
      'archivist'
    );
    expect(settled).toBeDefined();
    expect(settled!.vault).toEqual(['sun_core']);
    expect(settled!.echoes).toBe(5 + request.echoes);
    expect(settled!.trust.archivist).toBe(1);
    expect(settled!.relicRequests).toEqual(['archivist']);
  });

  it('refuses a gift the vault does not hold', () => {
    expect(applyRelicRequest(base({ vault: ['sun_core'] }), 'archivist')).toBeUndefined();
    expect(applyRelicRequest(base({}), 'nobody')).toBeUndefined();
  });

  it('takes only one request per resident', () => {
    const once = applyRelicRequest(base({ vault: [RELIC_REQUESTS.smith.defId] }), 'smith')!;
    expect(applyRelicRequest(once, 'smith')).toBeUndefined();
  });

  it('keeps trust at three hearts and offers a parting gift instead', () => {
    const settled = applyRelicRequest(
      base({ vault: [RELIC_REQUESTS.gardener.defId], trust: { gardener: 3 } }),
      'gardener'
    )!;
    expect(settled.trust.gardener).toBe(3);
    expect(settled.gift === undefined || equipmentDef(settled.gift) !== undefined).toBe(true);
  });
});

describe('more to talk about', () => {
  it('gives every resident a road hint short enough for the dialogue panel', () => {
    for (const npcId of Object.keys(NPCS)) {
      const hint = ROAD_HINTS[npcId];
      expect(hint, npcId).toBeTruthy();
      expect(hint.length, npcId).toBeLessThanOrEqual(160);
    }
  });

  it('stores answered requests in the save defaults', () => {
    expect(defaultMeta().relicRequests).toEqual([]);
  });
});
