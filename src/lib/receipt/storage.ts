import type { Expense, JournalEntry } from '@/lib/data/types';
import type { ReceiptPreferences, ReceiptScan } from './types';
const SCANS_KEY='finova.receipt.scans.v1'; const PREFS_KEY='finova.receipt.prefs.v1';
function monthKey(date=new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`; }
export function getReceiptScans(): ReceiptScan[] { try { return JSON.parse(localStorage.getItem(SCANS_KEY) ?? '[]') as ReceiptScan[]; } catch { return []; } }
export function saveReceiptScan(scan: ReceiptScan) { const all=getReceiptScans().filter(x=>x.id!==scan.id); localStorage.setItem(SCANS_KEY,JSON.stringify([scan,...all].slice(0,100))); }
export function deleteReceiptScan(id:string) { localStorage.setItem(SCANS_KEY,JSON.stringify(getReceiptScans().filter(x=>x.id!==id))); }
export function getReceiptPreferences(): ReceiptPreferences { const base:ReceiptPreferences={scanCount:0,monthKey:monthKey(),premium:false,vendorCategories:{}}; try { const p={...base,...JSON.parse(localStorage.getItem(PREFS_KEY)??'{}')}; if(p.monthKey!==monthKey()){p.scanCount=0;p.monthKey=monthKey();} return p; } catch{return base;} }
export function saveReceiptPreferences(p:ReceiptPreferences){localStorage.setItem(PREFS_KEY,JSON.stringify(p));}
export function registerScan(premium:boolean){const p=getReceiptPreferences(); p.premium=premium; p.scanCount+=1; saveReceiptPreferences(p); return p;}
export function rememberVendorCategory(vendor:string,category:string){const p=getReceiptPreferences(); if(vendor.trim()) p.vendorCategories[vendor.trim().toLowerCase()]=category; saveReceiptPreferences(p);}
export function findDuplicateExpense(expenses:Expense[], vendor:string, amount:number, date:string, imageHash:string, scans:ReceiptScan[]) { const same=scans.find(s=>s.imageHash===imageHash&&s.confirmedExpenseId); if(same) return same.confirmedExpenseId; return expenses.find(e=>e.vendor.trim().toLowerCase()===vendor.trim().toLowerCase()&&Math.round(e.amount*100)===Math.round(amount*100)&&e.date===date)?.id; }
export function findMatchingTransaction(entries:JournalEntry[], amount:number, date:string) { const cents=Math.round(amount*100); return entries.find(e=>e.date===date && e.source!=='EXPENSE' && e.lines.some(l=>Math.round((l.debit-l.credit)*100)===cents || Math.round((l.credit-l.debit)*100)===cents))?.id; }
