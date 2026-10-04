import { NextRequest } from 'next/server';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { ok, fail } from '@/lib/api/response';
import { withOrgAuth } from '@/lib/api/withOrgAuth';

export const runtime = 'nodejs';
const execFileAsync = promisify(execFile);
const MAX_BYTES = 15 * 1024 * 1024;

export const POST = withOrgAuth(async (_ctx, req: NextRequest) => {
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  const language = form?.get('language') === 'hin' ? 'hin' : 'eng+hin';
  if (!(file instanceof File)) return fail('Please choose an image file.', 400);
  if (file.size <= 0 || file.size > MAX_BYTES) return fail('The image must be between 1 byte and 15 MB.', 400);
  if (!file.type.startsWith('image/')) return fail('Local OCR accepts image files only.', 400);
  const dir = await mkdtemp(join(tmpdir(), 'finova-ocr-'));
  const input = join(dir, `${randomUUID()}.img`);
  try {
    await writeFile(input, Buffer.from(await file.arrayBuffer()));
    const { stdout } = await execFileAsync('tesseract', [input, 'stdout', '-l', language, '--psm', '6'], { timeout: 45_000, maxBuffer: 4 * 1024 * 1024 });
    return ok({ text: stdout.trim(), confidence: stdout.trim() ? 0.62 : 0, provider: 'Local Tesseract CLI', lines: [] });
  } catch (error) {
    const message = error instanceof Error && /ENOENT|not found/i.test(error.message) ? 'Browser OCR assets are not installed and a local OCR engine is unavailable.' : 'Local OCR could not read this image.';
    return fail(message, 503);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
});
