export type OCRLine = { text: string; bbox: { x: number; y: number; width: number; height: number } };
export type OCRResult = { text: string; confidence: number; provider: string; lines: OCRLine[] };

type OCROptions = {
  onProgress?: (value: number) => void;
  signal?: AbortSignal;
  timeoutMs?: number;
};

const TESSERACT_BASE = '/tesseract';
const WORKER_PATH = `${TESSERACT_BASE}/worker.min.js`;
const CORE_PATH = `${TESSERACT_BASE}/tesseract-core.wasm.js`;
const LANG_PATH = TESSERACT_BASE;

function assertNotAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('OCR cancelled.', 'AbortError');
}

async function runSingleLanguage(file: File | Blob, language: 'eng' | 'hin', options: OCROptions = {}): Promise<OCRResult> {
  assertNotAborted(options.signal);
  const mod = await import('tesseract.js');
  const timeoutMs = options.timeoutMs ?? 45_000;
  let worker: Awaited<ReturnType<typeof mod.createWorker>> | null = null;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let abortHandler: (() => void) | null = null;
  try {
    worker = await mod.createWorker(language, 1, {
      workerPath: WORKER_PATH,
      corePath: CORE_PATH,
      langPath: LANG_PATH,
      logger: (m: { progress?: number }) => {
        if (typeof m.progress === 'number') options.onProgress?.(Math.max(0, Math.min(1, m.progress)));
      },
    });
    const recognition = worker.recognize(file);
    const guarded = new Promise<Awaited<typeof recognition>>((resolve, reject) => {
      timeout = setTimeout(() => reject(new Error('OCR timed out.')), timeoutMs);
      abortHandler = () => { try { void worker?.terminate(); } catch {} reject(new DOMException('OCR cancelled.', 'AbortError')); };
      options.signal?.addEventListener('abort', abortHandler, { once: true });
      recognition.then(resolve, reject);
    });
    const result = await guarded;
    assertNotAborted(options.signal);
    const lines = (result.data.lines ?? []).map((line: { text?: string; bbox?: { x0?: number; y0?: number; x1?: number; y1?: number } }) => ({
      text: String(line.text ?? ''),
      bbox: {
        x: line.bbox?.x0 ?? 0,
        y: line.bbox?.y0 ?? 0,
        width: Math.max(0, (line.bbox?.x1 ?? 0) - (line.bbox?.x0 ?? 0)),
        height: Math.max(0, (line.bbox?.y1 ?? 0) - (line.bbox?.y0 ?? 0)),
      },
    }));
    return { text: String(result.data.text ?? ''), confidence: Number(result.data.confidence ?? 0) / 100, provider: `Tesseract.js (${language})`, lines };
  } finally {
    if (timeout) clearTimeout(timeout);
    if (abortHandler) options.signal?.removeEventListener('abort', abortHandler);
    if (worker) await worker.terminate().catch(() => undefined);
  }
}

export async function runImageOCR(file: File, language = 'eng+hin', onProgress?: (value: number) => void, signal?: AbortSignal): Promise<OCRResult> {
  // English is deliberately loaded first. Hindi trained data is loaded only when the combined mode is requested.
  if (language === 'eng+hin') {
    const english = await runSingleLanguage(file, 'eng', { onProgress: (p) => onProgress?.(p * 0.55), signal });
    const needsHindi = /[\u0900-\u097f]/u.test(english.text) || english.confidence < 0.78 || english.text.trim().length < 20;
    if (!needsHindi) return english;
    try {
      const hindi = await runSingleLanguage(file, 'hin', { onProgress: (p) => onProgress?.(0.55 + p * 0.45), signal });
      return {
        text: `${english.text}\n${hindi.text}`.trim(),
        confidence: Math.max(english.confidence, hindi.confidence),
        provider: 'Tesseract.js (eng → hin)',
        lines: [...english.lines, ...hindi.lines],
      };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      return english;
    }
  }
  const lang = language === 'hin' ? 'hin' : 'eng';
  return runSingleLanguage(file, lang, { onProgress, signal });
}

export type PdfTextItem = { str: string; transform: number[]; width?: number; height?: number };

/**
 * Rebuild visual lines from pdf.js text fragments using their coordinates.
 * Joining fragments with a single space (the old behaviour) flattens a whole invoice into one line,
 * which makes labels and values impossible to pair. Fragments on the same baseline form a line; a wide
 * horizontal gap becomes a double space (a table column boundary).
 */
export function pdfItemsToText(items: PdfTextItem[]): string {
  const frags = items
    .filter((i) => i.str && i.str.trim().length > 0 && Array.isArray(i.transform))
    .map((i) => ({ str: i.str, x: i.transform[4] ?? 0, y: i.transform[5] ?? 0, w: i.width ?? 0, h: i.height || Math.abs(i.transform[3] ?? 0) || 10 }));
  frags.sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: Array<{ y: number; h: number; items: typeof frags }> = [];
  for (const f of frags) {
    const row = rows.find((r) => Math.abs(r.y - f.y) <= Math.max(2, Math.min(r.h, f.h) * 0.45));
    if (row) row.items.push(f); else rows.push({ y: f.y, h: f.h, items: [f] });
  }
  rows.sort((a, b) => b.y - a.y);
  return rows.map((row) => {
    const sorted = row.items.sort((a, b) => a.x - b.x);
    let line = ''; let prevEnd: number | null = null; let prevCharW = 5;
    for (const f of sorted) {
      if (prevEnd !== null) {
        const gap = f.x - prevEnd;
        if (gap > prevCharW * 3) line += '  '; else if (gap > prevCharW * 0.25) line += ' ';
      }
      line += f.str.trim();
      prevEnd = f.x + (f.w || f.str.length * prevCharW);
      prevCharW = f.w && f.str.length ? f.w / f.str.length : prevCharW;
    }
    return line;
  }).join('\n');
}

export function extractPdfTextFromPages(pages: Array<{ text: string }>): string {
  return pages.map((page) => page.text.trim()).filter(Boolean).join('\n').trim();
}

async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  // pdfjs-dist v4 removed the `disableWorker` option; a worker URL must always be configured.
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();
  }
  return pdfjs;
}

export async function readPdfText(file: File, onProgress?: (value: number) => void): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdfjs = await loadPdfjs();
  const loadingTask = pdfjs.getDocument({ data: bytes });
  const pdf = await loadingTask.promise;
  const pages: Array<{ text: string }> = [];
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push({ text: pdfItemsToText(content.items.filter((item) => 'str' in item) as unknown as PdfTextItem[]) });
      onProgress?.(Math.round((pageNumber / pdf.numPages) * 100));
    }
  } finally {
    await loadingTask.destroy().catch(() => undefined);
  }
  return extractPdfTextFromPages(pages);
}

export async function ocrScannedPdf(file: File, onProgress?: (value: number) => void, signal?: AbortSignal): Promise<OCRResult> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdfjs = await loadPdfjs();
  const loadingTask = pdfjs.getDocument({ data: bytes });
  const pdf = await loadingTask.promise;
  const results: OCRResult[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      assertNotAborted(signal);
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.6 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('This browser could not prepare the PDF page for OCR.');
      await page.render({ canvasContext: context, viewport }).promise;
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Could not rasterise the PDF page.')), 'image/png', 0.92));
      const result = await runImageOCR(new File([blob], `page-${pageNumber}.png`, { type: 'image/png' }), 'eng+hin', (p) => onProgress?.(((pageNumber - 1) + p) / pdf.numPages * 100), signal);
      results.push(result);
    }
  } finally {
    await loadingTask.destroy().catch(() => undefined);
  }
  return {
    text: results.map((x) => x.text).filter(Boolean).join('\n\n'),
    confidence: results.length ? results.reduce((s, x) => s + x.confidence, 0) / results.length : 0,
    provider: 'Tesseract.js via PDF rasterisation',
    lines: results.flatMap((x) => x.lines),
  };
}
