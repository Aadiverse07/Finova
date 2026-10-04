import { parseQuestion } from './parser';
export function shouldRunNlq(text:string){const t=text.trim();if(t.startsWith('?'))return true;const ws=t.split(/\s+/).filter(Boolean);return ws.length>=3&&(/\b(spent|spend|expenses?|invoice|invoices|payments?|show|find|list|which|owe|unpaid|pending|paid|overdue|between|under|over|above|below|how much|how many)\b/i.test(t)||/₹|\brs\.?|\binr\b|\b(last|this|during|since|in)\s+(month|week|quarter|fy|january|february|march|april|may|june|july|august|september|october|november|december)/i.test(t));}
export const routeNlq=parseQuestion;
