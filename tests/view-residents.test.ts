import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
const view = readFileSync(join(__dirname, '../src/view/ActorView.ts'), 'utf8');
describe('residents in the view', () => {
  it('draws each resident from its building data, with no hand-kept map to fall out of date', () => {
    expect(view).toContain('building?.residentSprite');
    expect(view).not.toContain('NPC_PROPS');
  });
  it('flips the resident to the way the sim says it faces', () => {
    expect(view).toContain('sprite.scale.x = Math.abs(sprite.scale.x) * facing');
  });
  it('moves differently for each pose', () => {
    for (const pose of ["it.pose === 'walk'", "it.pose === 'work'", "it.pose === 'attend'"]) {
      expect(view).toContain(pose);
    }
  });
  it('measures label distance from the live interactable, so a walking name label stays true', () => {
    expect(view).toContain('this.labels.push({ text: label, at: it })');
    expect(view).toContain('Math.hypot(label.at.x - p.x, label.at.y - p.y)');
  });
});
