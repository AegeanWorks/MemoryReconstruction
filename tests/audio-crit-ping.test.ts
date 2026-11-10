import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const soundSource = readFileSync(
  join(__dirname, '../src/audio/Sound.ts'),
  'utf8'
);

describe('combat audio: critical hit metallic resonance ping', () => {
  it('layers a high metallic ping tone when e.crit is true on enemy hit', () => {
    const hitCaseStart = soundSource.indexOf("case 'hit':");
    expect(hitCaseStart).toBeGreaterThanOrEqual(0);
    const hitCaseEnd = soundSource.indexOf("case 'playerHurt':", hitCaseStart);
    expect(hitCaseEnd).toBeGreaterThan(hitCaseStart);
    const hitBlock = soundSource.slice(hitCaseStart, hitCaseEnd);

    // Should play thump for tactile body
    expect(hitBlock).toContain('this.thump');
    // Should layer a high-frequency metallic ping on critical hits
    expect(hitBlock).toContain("this.tone(1480, 2200, 0.08, 'triangle', 0.16, 'critPing')");
  });
});
