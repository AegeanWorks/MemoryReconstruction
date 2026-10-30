import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOTS = ['src', 'tests', 'scripts', 'docs', '.aikit'];
const TEXT = /\.(ts|css|json|md|py|html)$/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry === 'node_modules' || entry === '__pycache__') continue;
      walk(path, out);
    } else if (TEXT.test(entry)) {
      out.push(path);
    }
  }
  return out;
}

describe('source encoding', () => {
  it('contains no Unicode replacement characters', () => {
    const bad: string[] = [];
    for (const root of ROOTS) {
      let files: string[] = [];
      try {
        files = walk(root);
      } catch {
        continue;
      }
      for (const file of files) {
        const bytes = readFileSync(file);
        const text = bytes.toString('utf8');
        // A lossy decode means the file is not valid UTF-8; a literal U+FFFD means
        // a previous bad write already happened and must be repaired.
        if (!Buffer.from(text, 'utf8').equals(bytes) || text.includes('\ufffd'))
          bad.push(file);
      }
    }
    expect(bad).toEqual([]);
  });
});
