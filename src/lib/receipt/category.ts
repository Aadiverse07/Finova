const RULES: Array<[string, RegExp, number]> = [
  ['Software', /\b(?:adobe|microsoft|office\s*365|google\s*workspace|gsuite|software|saas|subscription|licen[cs]e|hosting|domain|cloud|aws|azure|github|slack|zoom|notion|figma|canva|openai|atlassian|jira|dropbox|antivirus|app\s*store|play\s*store)\b/i, 3],
  ['Travel', /\b(?:uber|ola|rapido|taxi|cab|flight|air\s*india|indigo|vistara|hotel|railway|irctc|travel|makemytrip|redbus|bus\s*ticket|toll|fastag|petrol|diesel|fuel|parking|boarding)\b/i, 3],
  ['Utilities', /\b(?:electricity|power|water\s*bill|gas\s*bill|airtel|jio|vodafone|vi|bsnl|internet|broadband|utility|postpaid|prepaid|recharge|dth|tata\s*play|consumer\s*no|meter)\b/i, 3],
  ['Marketing', /\b(?:advertis\w*|ads?|facebook\s*ads|google\s*ads|campaign|printing|banner|brochure|flyer|seo|promotion|branding|marketing|hoarding|sponsor\w*)\b/i, 3],
  ['Rent', /\b(?:rent|lease|co-?working|office\s*space|landlord)\b/i, 3],
  ['Office Supplies', /\b(?:stationery|stationers|paper|printer|cartridge|toner|pens?|notebooks?|stapler|folders?|files?|marker|amazon\s*business|office\s*supplies|furniture|courier|chairs?|desks?)\b/i, 2],
];
const norm = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ');
export function suggestCategory(vendor: string, lines: string[], history: Record<string, string>) {
  const key = norm(vendor);
  const known = Object.keys(history).find((k) => norm(k) === key);
  if (key && known && history[known]) return { value: history[known], confidence: 0.97, reason: 'You categorised this vendor before' };
  const vendorText = vendor; const body = lines.join(' ');
  const scored = RULES.map(([name, re, w]) => ({ name, s: (re.test(vendorText) ? w + 1 : 0) + (body.match(new RegExp(re.source, 'gi'))?.length ?? 0) * (w / 2) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
  const top = scored[0];
  if (!top) return { value: 'Office Supplies', confidence: 0.25, reason: 'No keyword matched; defaulted. Please pick a category.' };
  const margin = top.s - (scored[1]?.s ?? 0);
  return { value: top.name, confidence: margin >= 2 ? 0.82 : 0.62, reason: `Keyword match for ${top.name}` };
}
