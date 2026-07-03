'use client';

import {
  GitCommit,
  CheckCircle,
  FlaskConical,
  Shield,
  Package,
  Rocket,
  AlertTriangle,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAnalysisStore } from '@/store/analysis-store';
import type { LucideIcon } from 'lucide-react';

// ---------------------------------------------------------------------------
// Stage definitions
// ---------------------------------------------------------------------------

interface Stage {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
  glowColor: string;
  dotColor: string;
}

const STAGES: Stage[] = [
  { id: 'source',   label: 'Source',   icon: GitCommit,   color: 'text-blue-400',    glowColor: 'shadow-blue-500/20',    dotColor: 'bg-blue-400' },
  { id: 'quality',  label: 'Quality',  icon: CheckCircle, color: 'text-violet-400',  glowColor: 'shadow-violet-500/20',  dotColor: 'bg-violet-400' },
  { id: 'test',     label: 'Test',     icon: FlaskConical, color: 'text-cyan-400',   glowColor: 'shadow-cyan-500/20',    dotColor: 'bg-cyan-400' },
  { id: 'security', label: 'Security', icon: Shield,      color: 'text-amber-400',   glowColor: 'shadow-amber-500/20',   dotColor: 'bg-amber-400' },
  { id: 'build',    label: 'Build',    icon: Package,     color: 'text-emerald-400', glowColor: 'shadow-emerald-500/20', dotColor: 'bg-emerald-400' },
  { id: 'deploy',   label: 'Deploy',   icon: Rocket,      color: 'text-rose-400',    glowColor: 'shadow-rose-500/20',    dotColor: 'bg-rose-400' },
];

const TOOL_COLORS: Record<string, string> = {
  semgrep: 'bg-purple-500/15 text-purple-300 border-purple-500/25',
  codeql: 'bg-blue-500/15 text-blue-300 border-blue-500/25',
  trivy: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25',
  'npm-audit': 'bg-red-500/15 text-red-300 border-red-500/25',
  gitleaks: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
  syft: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PipelineStages() {
  const analysisResult = useAnalysisStore((state) => state.analysisResult);
  const status = useAnalysisStore((state) => state.status);

  const pipeline = analysisResult?.pipeline ?? null;

  // Loading skeleton — vertical
  if (status === 'idle' || status === 'parsed' || status === 'loading') {
    return (
      <Card className="bg-slate-800/50 border-slate-700/50 h-full">
        <div className="p-5 space-y-4">
          <Skeleton className="h-4 w-24 bg-slate-700/50" />
          <div className="space-y-6 pl-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full bg-slate-700/50" />
                <Skeleton className="h-3 w-16 bg-slate-700/50" />
              </div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  // Analyzing — animated skeleton
  if (status === 'analyzing' && !pipeline) {
    return (
      <Card className="bg-slate-800/50 border-slate-700/50 h-full relative overflow-hidden">
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Pipeline</span>
            <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
          </div>
          <div className="space-y-6 pl-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full bg-slate-700/50" />
                <Skeleton className="h-3 w-16 bg-slate-700/50" />
              </div>
            ))}
          </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-700/5 to-transparent animate-shimmer" />
      </Card>
    );
  }

  // Failed
  if (status === 'complete' && !pipeline) {
    return (
      <Card className="bg-slate-800/50 border-slate-700/50 h-full">
        <div className="p-5 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-400">Pipeline unavailable</p>
        </div>
      </Card>
    );
  }

  if (!pipeline) return null;

  const tools = pipeline.securityScanning.tools;
  const provider = pipeline.infrastructureAsCode.provider === 'terraform' ? 'Terraform' : 'CloudFormation';

  return (
    <Card className="bg-slate-800/50 border-slate-700/50 h-full">
      <div className="p-5 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Pipeline</span>
          <span className="text-[10px] text-slate-600">{provider}</span>
        </div>

        {/* Vertical stage flow */}
        <div className="flex-1 flex flex-col justify-between relative">
          {/* Vertical connector line */}
          <div className="absolute left-5 top-5 bottom-5 w-px bg-gradient-to-b from-blue-500/40 via-amber-500/40 to-rose-500/40" />

          {STAGES.map((stage, i) => {
            const Icon = stage.icon;
            const isSecurityStage = stage.id === 'security';
            return (
              <div
                key={stage.id}
                className="relative flex items-center gap-4 group"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                {/* Icon circle */}
                <div className={`relative z-10 flex items-center justify-center h-10 w-10 rounded-full bg-slate-900 border border-slate-700/80 shadow-lg ${stage.glowColor} group-hover:scale-110 transition-transform duration-200`}>
                  <Icon className={`h-4.5 w-4.5 ${stage.color}`} />
                </div>

                {/* Label + optional tool badges */}
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">
                    {stage.label}
                  </span>
                  {isSecurityStage && tools.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {tools.map((tool) => (
                        <span
                          key={tool.name}
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${TOOL_COLORS[tool.name] ?? 'bg-slate-700/50 text-slate-400 border-slate-600/50'}`}
                        >
                          {tool.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pulse dot on active line */}
                <div className={`absolute left-[18px] top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full ${stage.dotColor} opacity-0 group-hover:opacity-100 transition-opacity ring-2 ring-current`} />
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
