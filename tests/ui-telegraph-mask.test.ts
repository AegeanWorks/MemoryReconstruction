import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const view = readFileSync(join(__dirname, '../src/view/ActorView.ts'), 'utf8');

describe('telegraph room mask', () => {
  it('masks the telegraph layer to the current room', () => {
    expect(view).toContain('this.telegraphs.mask = this.telegraphMask');
    expect(view).toContain('this.telegraphMask.rect(');
  });
});
