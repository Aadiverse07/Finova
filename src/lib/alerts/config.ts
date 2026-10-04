import { alertConfigSchema, type AlertConfig } from './types';
export const DEFAULT_ALERT_CONFIG: AlertConfig={
  overdueGraceDays:0, expenseIncreasePct:15, expenseIncreaseMin:5000, expenseMinRecords:3,
  categorySpikePct:50, categorySpikeMin:5000, expectedReceiptsDays:14, cashFlowChangePct:10,
  lowCashCriticalDays:15, lowCashWarningDays:30, runwayHistoryDays:90, dueSoonDays:3, staleDraftDays:7,
  customerConcentrationPct:50, duplicateExpenseMin:500, maxAlerts:5, maxCriticalExpanded:2, cashAccountIds:[],
  gstReminders:false, mutedCategories:[]
};
export function mergeAlertConfig(input?:Partial<AlertConfig>):AlertConfig {
  const parsed=alertConfigSchema.safeParse({...DEFAULT_ALERT_CONFIG,...input});
  return parsed.success?parsed.data:DEFAULT_ALERT_CONFIG;
}
