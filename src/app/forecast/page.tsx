'use client';

import { FinanceModuleShell } from '@/components/finance-module-shell';
import { ForecastDashboard } from '@/components/forecast/forecast-dashboard';

export default function ForecastPage() {
  return <FinanceModuleShell active="forecast"><ForecastDashboard /></FinanceModuleShell>;
}
