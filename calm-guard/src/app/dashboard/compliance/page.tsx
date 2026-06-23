'use client';

import { RiskHeatMap } from '@/components/dashboard/risk-heat-map';
import { ControlMatrix } from '@/components/dashboard/control-matrix';

export default function CompliancePage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-200 mb-2">Compliance</h1>
        <p className="text-sm text-slate-400">
          Risk assessment heat map and control framework mappings
        </p>
      </div>
      <RiskHeatMap />
      <ControlMatrix />
    </div>
  );
}
