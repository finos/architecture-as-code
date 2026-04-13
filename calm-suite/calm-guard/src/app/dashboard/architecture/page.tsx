'use client';

import { useAnalysisStore } from '@/store/analysis-store';
import { ArchitectureGraph } from '@/components/graph/architecture-graph';

export default function ArchitecturePage() {
  const analysisInput = useAnalysisStore((state) => state.analysisInput);

  if (!analysisInput) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-500">Select an architecture and click Analyze to view the graph</p>
      </div>
    );
  }

  return (
    <div className="p-6 h-full">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-slate-200">Architecture</h1>
        <p className="text-sm text-slate-400">
          Interactive CALM architecture graph with compliance coloring
        </p>
      </div>
      <div className="h-[calc(100vh-12rem)] bg-slate-800 rounded-lg border border-slate-700">
        <ArchitectureGraph />
      </div>
    </div>
  );
}
