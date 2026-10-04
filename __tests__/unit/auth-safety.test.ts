import { describe, expect, it } from 'vitest';
import { passwordStrength, initialsFor, registrationSchema, signInSchema } from '@/lib/demo-auth';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.next') return sourceFiles(path);
    return entry.isFile() && /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

describe('auth UX safety', () => {
  it('validates both sign-in and registration forms', () => {
    expect(signInSchema.safeParse({ email: 'bad', password: '' }).success).toBe(false);
    expect(registrationSchema.safeParse({ name: 'A', email: 'bad', password: '123', confirmPassword: '456', terms: false }).success).toBe(false);
    expect(passwordStrength('Abc123!').score).toBeGreaterThanOrEqual(3);
    expect(initialsFor({ name: 'Ada Lovelace', email: 'ada@example.com' })).toBe('AL');
  });
  it('contains no hard-coded legacy Shikhar identity in source', () => {
    const files = sourceFiles(join(process.cwd(), 'src'));
    const legacyName = [83,104,105,107,104,97,114,32,83,117,116,104,97,114].map(String.fromCharCode).join(''); const hits = files.flatMap((file) => { const text = readFileSync(file, 'utf8'); return text.includes(legacyName) ? [file] : []; });
    expect(hits).toEqual([]);
  });
});
