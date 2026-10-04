export async function preprocessImage(file: File): Promise<{ file: File; dataUrl: string; width: number; height: number }> {
  if (!file.type.startsWith('image/')) return { file, dataUrl: await fileToDataUrl(file), width: 0, height: 0 };
  const bitmap = await createImageBitmap(file); const max = 2200; const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height)); const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(bitmap.width*scale)); canvas.height = Math.max(1, Math.round(bitmap.height*scale));
  const ctx = canvas.getContext('2d'); if (!ctx) return { file, dataUrl: await fileToDataUrl(file), width: bitmap.width, height: bitmap.height }; ctx.filter = 'contrast(1.08) brightness(1.03)'; ctx.drawImage(bitmap,0,0,canvas.width,canvas.height); bitmap.close();
  const blob = await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Could not preprocess image')),'image/jpeg',.84)); const processed = new File([blob], file.name.replace(/\.[^.]+$/i,'.jpg'), { type:'image/jpeg', lastModified:Date.now() }); return { file:processed, dataUrl:await blobToDataUrl(blob), width:canvas.width, height:canvas.height };
}
export function fileToDataUrl(file: File) { return new Promise<string>((resolve,reject)=>{ const r=new FileReader(); r.onload=()=>resolve(String(r.result)); r.onerror=()=>reject(r.error); r.readAsDataURL(file); }); }
function blobToDataUrl(blob: Blob) { return fileToDataUrl(new File([blob],'processed.jpg',{type:blob.type})); }
export async function sha256(file: File) { const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer()); return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join(''); }
