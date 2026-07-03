'use client';

import { PipelineStages } from '@/components/dashboard/pipeline-stages';
import { PipelinePreview } from '@/components/dashboard/pipeline-preview';

export default function PipelinePage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-200 mb-2">Pipeline</h1>
        <p className="text-sm text-slate-400">
          Generated CI/CD pipeline configurations and security scanning templates
        </p>
      </div>

      {/* Split layout: visual pipeline left, code right */}
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4 items-stretch">
        <PipelineStages />
        <PipelinePreview />
      </div>
    </div>
  );
}
