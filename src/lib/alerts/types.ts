import { z } from 'zod';

export const severitySchema = z.enum(['critical','warning','info','positive']);
export type Severity = z.infer<typeof severitySchema>;
export const categorySchema = z.enum(['receivables','spending','cash','payables','tax','data-quality','milestone']);
export type AlertCategory = z.infer<typeof categorySchema>;
export type EvidenceRecord = { type:'invoice'|'expense'|'transaction'|'account'|'customer'; id:string; label:string; amount?:number; href:string };
export type Alert = {
  id:string; ruleId:string; category:AlertCategory; severity:Severity; title:string; summary:string;
  why:{whatHappened:string; comparedWith?:string; whyItMatters:string; suggestedAction:string};
  evidence:{facts:Record<string,number|string>; records:EvidenceRecord[]; method:string};
  impact?:{amount:number; direction:'at-risk'|'incoming'|'outgoing'|'saved'|'neutral'};
  action:{label:string;href:string}; period?:{from:string;to:string;label:string};
  firstSeenAt:string; lastEvaluatedAt:string; materiality:number;
};
export type AlertConfig = {
  overdueGraceDays:number; expenseIncreasePct:number; expenseIncreaseMin:number; expenseMinRecords:number;
  categorySpikePct:number; categorySpikeMin:number; expectedReceiptsDays:number; cashFlowChangePct:number;
  lowCashCriticalDays:number; lowCashWarningDays:number; runwayHistoryDays:number; dueSoonDays:number;
  staleDraftDays:number; customerConcentrationPct:number; duplicateExpenseMin:number; maxAlerts:number; maxCriticalExpanded:number;
  cashAccountIds:string[]; gstReminders:boolean;
  mutedCategories: AlertCategory[];
};
export type AlertState = {
  version:1; read:string[]; snoozed:Record<string,string>; dismissed:string[]; mutedRules:string[]; mutedCategories:AlertCategory[];
  seen:Record<string,{impact:number;count:number;severity:Severity}>; resolved:{id:string;title:string;resolvedAt:string}[];
};
export const alertConfigSchema=z.object({
  overdueGraceDays:z.number().int().min(0).max(30), expenseIncreasePct:z.number().min(0).max(500),
  expenseIncreaseMin:z.number().min(0), expenseMinRecords:z.number().int().min(1).max(100),
  categorySpikePct:z.number().min(0), categorySpikeMin:z.number().min(0),
  expectedReceiptsDays:z.union([z.literal(7),z.literal(14),z.literal(30)]), cashFlowChangePct:z.number().min(0).max(500),
  lowCashCriticalDays:z.number().min(1), lowCashWarningDays:z.number().min(1), runwayHistoryDays:z.number().int().min(30).max(365),
  dueSoonDays:z.number().int().min(0).max(30), staleDraftDays:z.number().int().min(1).max(90),
  customerConcentrationPct:z.number().min(0).max(100), duplicateExpenseMin:z.number().min(0),
  maxAlerts:z.number().int().min(1).max(20), maxCriticalExpanded:z.number().int().min(1).max(5),
  cashAccountIds:z.array(z.string()), gstReminders:z.boolean(), mutedCategories:z.array(categorySchema)
});
