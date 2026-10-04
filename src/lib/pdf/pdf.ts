/**
 * Tiny dependency-free PDF writer (text, lines, rectangles, multi-page) used for invoices and statements.
 * Uses the 14 standard PDF fonts so nothing needs to be embedded. Coordinates are in points, origin top-left.
 */
export type PdfFont = 'serif' | 'serifBold' | 'serifItalic' | 'sans' | 'sansBold';
const FONT_REF: Record<PdfFont, { name: string; base: string; css: string }> = {
  serif: { name: 'F1', base: 'Times-Roman', css: '"Times New Roman", Times, serif' },
  serifBold: { name: 'F2', base: 'Times-Bold', css: 'bold "Times New Roman", Times, serif' },
  serifItalic: { name: 'F3', base: 'Times-Italic', css: 'italic "Times New Roman", Times, serif' },
  sans: { name: 'F4', base: 'Helvetica', css: 'Arial, Helvetica, sans-serif' },
  sansBold: { name: 'F5', base: 'Helvetica-Bold', css: 'bold Arial, Helvetica, sans-serif' },
};
export type Rgb = [number, number, number];
export const hex = (h: string): Rgb => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];

let ctx: CanvasRenderingContext2D | null | undefined;
function measureCtx() {
  if (ctx === undefined) { try { ctx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null; } catch { ctx = null; } }
  return ctx;
}
/** Sanitise to the WinAnsi (Latin-1) range the standard fonts support. */
export const clean = (s: string) => s.replaceAll('₹', 'Rs. ').replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...').replace(/×/g, 'x').replace(/[^\x20-\x7E -ÿ]/g, '?');
const esc = (s: string) => clean(s).replace(/([\\()])/g, '\\$1');

export class PdfDoc {
  readonly width = 595.28; readonly height = 841.89; // A4
  private pages: string[][] = [];
  constructor() { this.addPage(); }
  get pageCount() { return this.pages.length; }
  addPage() { this.pages.push([]); }
  private out(op: string) { this.pages[this.pages.length - 1].push(op); }
  private y(y: number) { return (this.height - y).toFixed(2); }

  textWidth(s: string, font: PdfFont, size: number) {
    const c = measureCtx(); const t = clean(s);
    if (c) {
      const css = FONT_REF[font].css; const m = css.match(/^(bold|italic) (.*)$/);
      c.font = `${m ? m[1] : 'normal'} 100px ${m ? m[2] : css}`;
      return (c.measureText(t).width / 100) * size;
    }
    return t.length * size * (font.startsWith('sans') ? 0.52 : 0.46);
  }
  /** Truncate with an ellipsis so text fits within maxWidth. */
  fit(s: string, font: PdfFont, size: number, maxWidth: number) {
    if (this.textWidth(s, font, size) <= maxWidth) return s;
    let t = s; while (t.length > 1 && this.textWidth(t + '...', font, size) > maxWidth) t = t.slice(0, -1);
    return t.trimEnd() + '...';
  }
  wrap(s: string, font: PdfFont, size: number, maxWidth: number): string[] {
    const lines: string[] = [];
    for (const para of String(s).split(/\r?\n/)) {
      let cur = '';
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const next = cur ? `${cur} ${word}` : word;
        if (this.textWidth(next, font, size) <= maxWidth || !cur) cur = next; else { lines.push(cur); cur = word; }
      }
      lines.push(cur);
    }
    return lines;
  }
  text(s: string, x: number, y: number, o: { font?: PdfFont; size?: number; color?: Rgb; align?: 'left' | 'right' | 'center'; spacing?: number } = {}) {
    const font = o.font ?? 'serif', size = o.size ?? 11, [r, g, b] = o.color ?? [0, 0, 0];
    let px = x; const w = this.textWidth(s, font, size) + (o.spacing ?? 0) * clean(s).length;
    if (o.align === 'right') px = x - w; else if (o.align === 'center') px = x - w / 2;
    this.out(`BT /${FONT_REF[font].name} ${size} Tf ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg ${o.spacing ?? 0} Tc ${px.toFixed(2)} ${this.y(y)} Td (${esc(s)}) Tj ET`);
  }
  line(x1: number, y1: number, x2: number, y2: number, color: Rgb = [0.8, 0.8, 0.8], width = 0.6) {
    this.out(`${color.map((n) => n.toFixed(3)).join(' ')} RG ${width} w ${x1.toFixed(2)} ${this.y(y1)} m ${x2.toFixed(2)} ${this.y(y2)} l S`);
  }
  rect(x: number, y: number, w: number, h: number, fill?: Rgb, stroke?: Rgb) {
    const parts = [`${x.toFixed(2)} ${(this.height - y - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re`];
    if (fill) this.out(`${fill.map((n) => n.toFixed(3)).join(' ')} rg`);
    if (stroke) this.out(`${stroke.map((n) => n.toFixed(3)).join(' ')} RG 0.6 w`);
    this.out(`${parts[0]} ${fill && stroke ? 'B' : fill ? 'f' : 'S'}`);
  }
  build(meta: { title: string; author?: string }): Uint8Array {
    const objs: string[] = [];
    const add = (s: string) => { objs.push(s); return objs.length; };
    add('<< /Type /Catalog /Pages 2 0 R >>');
    add('PAGES');
    const fontIds = (Object.keys(FONT_REF) as PdfFont[]).map((k) => add(`<< /Type /Font /Subtype /Type1 /BaseFont /${FONT_REF[k].base} /Encoding /WinAnsiEncoding >>`));
    const fontRes = (Object.keys(FONT_REF) as PdfFont[]).map((k, i) => `/${FONT_REF[k].name} ${fontIds[i]} 0 R`).join(' ');
    const info = add(`<< /Title (${esc(meta.title)}) /Author (${esc(meta.author ?? 'Finova')}) /Producer (Finova) >>`);
    const pageIds: number[] = [];
    for (const ops of this.pages) {
      const content = ops.join('\n');
      const cid = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
      pageIds.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.width} ${this.height}] /Resources << /Font << ${fontRes} >> >> /Contents ${cid} 0 R >>`));
    }
    objs[1] = `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((i) => `${i} 0 R`).join(' ')}] >>`;
    let body = '%PDF-1.4\n'; const offsets: number[] = [];
    objs.forEach((o, i) => { offsets.push(body.length); body += `${i + 1} 0 obj\n${o}\nendobj\n`; });
    const xref = body.length;
    body += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
    body += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF`;
    const bytes = new Uint8Array(body.length); for (let i = 0; i < body.length; i++) bytes[i] = body.charCodeAt(i) & 0xff;
    return bytes;
  }
}

export function downloadPdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
