import { describe, expect, it } from 'vitest';
import { shopLineState } from '../src/ui/Screens';
import type { ShopItem } from '../src/sim/world';

const line = (over: Partial<ShopItem> = {}): ShopItem => ({
  id: 'health',
  name: 'Healing draught',
  detail: 'One red flask.',
  cost: 24,
  sold: false,
  ...over,
});

describe('shop line buttons', () => {
  it('sells a draught when the purse covers it', () => {
    expect(shopLineState(line(), 100, 0, 2)).toEqual({ label: '24 shards', disabled: false });
  });

  it('greys out what the purse cannot cover', () => {
    expect(shopLineState(line(), 10, 0, 2)).toEqual({ label: '24 shards', disabled: true });
  });

  it('says Flasks full instead of offering a draught that cannot be carried', () => {
    expect(shopLineState(line(), 100, 2, 2)).toEqual({ label: 'Flasks full', disabled: true });
    expect(shopLineState(line(), 100, 3, 2)).toEqual({ label: 'Flasks full', disabled: true });
  });

  it('only blocks the health line when the flask rack is full', () => {
    expect(shopLineState(line({ id: 'mana' }), 100, 2, 2)).toEqual({
      label: '24 shards',
      disabled: false,
    });
  });

  it('keeps a sold line sold even with a full purse', () => {
    expect(shopLineState(line({ sold: true }), 999, 0, 2)).toEqual({
      label: 'Sold',
      disabled: true,
    });
  });
});
