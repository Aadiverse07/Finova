export type DetectedLanguage = 'en' | 'hi' | 'hinglish';
const pairs: [RegExp, string][] = [
  [/इस\s*महीने|iss\s+mahine|is\s+mahine/gi, 'this month'], [/पिछले\s*महीने|pichle\s+mahine|pichhle\s+mahine/gi, 'last month'],
  [/इस\s*हफ्ते|iss\s+hafte/gi, 'this week'], [/कल/gi, 'yesterday'], [/आज/gi, 'today'],
  [/कुल\s*खर्च|कुल\s*खर्?चा|total\s+kharcha|total\s+expense/gi, 'total expense'], [/खर्चा|खर्च|खरचा|kharcha|kharch|kharche/gi, 'expense'],
  [/आमदनी|आय|कमाई|income|aamdani|kamai/gi, 'income'], [/बकाया|बाकी|उधार|baaki|udhaar|baki/gi, 'outstanding'],
  [/कितना|कितने|kitna|kitne/gi, 'how much'], [/ग्राहक|कस्टमर|customer|grahak|client/gi, 'customer'],
  [/इस साल|इस वर्ष/gi, 'this year'], [/पिछले साल|पिछला साल/gi, 'last year'], [/लाभ|मुनाफा|profit|munafa/gi, 'profit'],
  [/सबसे ज्यादा|सर्वाधिक|sabse zyada/gi, 'top'], [/दिखाओ|बताओ|बताइए|batao|bataiye|dikhao/gi, 'show'],
];
export function detectLanguage(input: string): DetectedLanguage {
  const dev = (input.match(/[\u0900-\u097F]/g) ?? []).length;
  const latinHindi = /\b(mera|meri|mere|ka|ki|ke|kitna|kharcha|kharch|baki|baaki|paisa|iss|mahine|pichle|batao|dikhao|aamdani|kamai|grahak|udhaar|kaisa|kaise|kaisi|hai|hain|kya|mujhe|aapka|aapki|mausam|hoon)\b/i.test(input);
  if (dev >= 2) return 'hi';
  if (latinHindi) return 'hinglish';
  return 'en';
}
export function normalizeFinancialQuery(input: string): { text: string; language: DetectedLanguage } {
  let text = input.normalize('NFKC');
  for (const [re, replacement] of pairs) text = text.replace(re, ` ${replacement} `);
  text = text.replace(/[₹]/g, ' INR ').replace(/\s+/g, ' ').trim();
  return { text, language: detectLanguage(input) };
}
