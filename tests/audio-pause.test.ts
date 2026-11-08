import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const app = readFileSync(join(__dirname, '../src/app/App.ts'), 'utf8');
const sound = readFileSync(join(__dirname, '../src/audio/Sound.ts'), 'utf8');

function slice(startMarker: string, endMarker: string, source = app): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  expect(start, `missing ${startMarker}`).toBeGreaterThanOrEqual(0);
  expect(end, `missing ${endMarker}`).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe('audio lifecycle on pause', () => {
  it('suspends audio when the pause or sanctuary menu opens', () => {
    expect(slice('private pause(): void {', 'private resume(): void {')).toContain(
      'this.sound.setSuspended(true)'
    );
    expect(
      slice('private showSanctuaryMenu(): void {', 'private restSavedRun(')
    ).toContain('this.sound.setSuspended(true)');
  });

  it('does not let the generic unlock gesture resume paused audio', () => {
    expect(slice('unlock(): void {', 'setVolumes(', sound)).toContain(
      'this.suspended'
    );
    expect(slice('setSuspended(suspended: boolean): void {', 'handle(', sound)).toContain(
      'this.suspended = suspended'
    );
  });

  it('resumes audio whenever control returns to the world or a menu', () => {
    expect(slice('private resume(): void {', 'private resumeRoom(): void {')).toContain(
      'this.sound.setSuspended(false)'
    );
    expect(slice('private resumeRoom(): void {', 'private showSettings(')).toContain(
      'this.sound.setSuspended(false)'
    );
    expect(slice('private showHub(): void {', 'private enterBuilding(')).toContain(
      'this.sound.setSuspended(false)'
    );
    expect(slice('private showTitle(): void {', 'private showHub(): void {')).toContain(
      'this.sound.setSuspended(false)'
    );
    expect(slice('private startRun(', 'private enterFloor(): void {')).toContain(
      'this.sound.setSuspended(false)'
    );
  });
});
