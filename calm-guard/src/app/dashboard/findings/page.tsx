'use client';

import { FindingsTable } from '@/components/dashboard/findings-table';

export default function FindingsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-200 mb-2">Findings</h1>
        <p className="text-sm text-slate-400">
          Compliance findings sorted by severity with recommendations
        </p>
      </div>
      <FindingsTable />
    </div>
  );
}
