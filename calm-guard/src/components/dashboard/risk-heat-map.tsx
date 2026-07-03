'use client';

import { memo } from 'react';
import { useAnalysisStore } from '@/store/analysis-store';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AlertTriangle } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type CellStatus = 'compliant' | 'partial' | 'non-compliant' | 'not-applicable' | 'loading';

// ─── Constants ────────────────────────────────────────────────────────────────

const FRAMEWORKS = ['SOX', 'PCI-DSS', 'NIST-CSF', 'CCC'] as const;

const cellColors: Record<CellStatus, string> = {
  compliant: 'bg-emerald-500/30 border-emerald-500/20',
  partial: 'bg-amber-500/30 border-amber-500/20',
  'non-compliant': 'bg-red-500/30 border-red-500/20',
  'not-applicable': 'bg-slate-700/30 border-slate-700/20',
  loading: 'bg-slate-700/50 border-slate-700/30',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function deriveCellStatus(
  riskLevel: 'critical' | 'high' | 'medium' | 'low',
  complianceGaps: number,
): CellStatus {
  if (complianceGaps > 0 && (riskLevel === 'high' || riskLevel === 'critical')) {
    return 'non-compliant';
  }
  if (complianceGaps > 0 && riskLevel === 'medium') {
    return 'partial';
  }
  if (complianceGaps === 0 && riskLevel === 'low') {
    return 'compliant';
  }
  if (riskLevel === 'medium') return 'partial';
  if (riskLevel === 'high' || riskLevel === 'critical') return 'non-compliant';
  if (riskLevel === 'low') return 'compliant';
  return 'not-applicable';
}

function cellStatusLabel(status: CellStatus): string {
  const labels: Record<CellStatus, string> = {
    compliant: 'Compliant',
    partial: 'Partial',
    'non-compliant': 'Non-Compliant',
    'not-applicable': 'N/A',
    loading: 'Loading...',
  };
  return labels[status];
}

// ─── HeatMapCell sub-component ───────────────────────────────────────────────

interface HeatMapCellProps {
  nodeName: string;
  framework: string;
  cellStatus: CellStatus;
  riskFactors: string[];
  /** Row index for staggered cascade animation delay */
  rowIndex: number;
}

function HeatMapCell({ nodeName, framework, cellStatus, riskFactors, rowIndex }: HeatMapCellProps) {
  const findingSummary = riskFactors.length > 0 ? riskFactors[0] : null;
  const staggerDelay = `${rowIndex * 80}ms`;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'h-8 rounded border cursor-pointer animate-fade-in',
              cellColors[cellStatus],
              'transition-colors duration-700 ease-in-out',
            )}
            style={{ animationDelay: staggerDelay, transitionDelay: staggerDelay }}
          />
        </TooltipTrigger>
        <TooltipContent className="bg-slate-800 border-slate-700 text-slate-200 max-w-xs">
          <p className="font-medium">{nodeName}</p>
          <p className="text-xs text-slate-400">
            {framework}: {cellStatusLabel(cellStatus)}
          </p>
          {findingSummary && (
            <p className="text-xs text-slate-400 mt-1">{findingSummary}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export const RiskHeatMap = memo(function RiskHeatMap() {
  const analysisResult = useAnalysisStore((state) => state.analysisResult);
  const status = useAnalysisStore((state) => state.status);

  const isAnalyzing = status === 'analyzing';
  const hasData = analysisResult !== null;
  const hasRisk = hasData && analysisResult.risk !== null;
  const hasCompliance = hasData && analysisResult.compliance !== null;

  // Graceful degradation: has compliance but no risk
  if (hasCompliance && !hasRisk) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <div className="p-6">
          <h3 className="text-sm font-medium text-slate-400 mb-4">Risk Heat Map</h3>
          <div className="flex items-center gap-2 text-amber-400 text-sm">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>Risk data unavailable — agent failed</span>
          </div>
        </div>
      </Card>
    );
  }

  // Empty state: no analysis run yet
  if (!hasData && !isAnalyzing) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <div className="p-6">
          <h3 className="text-sm font-medium text-slate-400 mb-4">Risk Heat Map</h3>
          <p className="text-slate-500 text-sm">Run analysis to view risk heat map</p>
        </div>
      </Card>
    );
  }

  // Loading state: show gray skeleton grid
  if (isAnalyzing && !hasRisk) {
    const placeholderNodes = Array.from({ length: 5 }, (_, i) => `node-${i}`);
    const frameworks = FRAMEWORKS;
    return (
      <Card className="bg-slate-800 border-slate-700">
        <div className="p-6">
          <h3 className="text-sm font-medium text-slate-400 mb-4">Risk Heat Map</h3>
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: `180px repeat(${frameworks.length}, 1fr)` }}
          >
            {/* Column headers */}
            <div />
            {frameworks.map((fw) => (
              <div key={fw} className="text-xs text-slate-400 text-center font-medium px-2 py-1">
                {fw}
              </div>
            ))}
            {/* Placeholder rows */}
            {placeholderNodes.map((nodeId) => (
              <>
                <div key={`${nodeId}-label`} className="h-8 w-32 bg-slate-700/50 rounded animate-pulse" />
                {frameworks.map((fw) => (
                  <div
                    key={`${nodeId}-${fw}`}
                    className="h-8 rounded border bg-slate-700/50 border-slate-700/30 animate-pulse"
                  />
                ))}
              </>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  // Data available: render actual heat map
  if (!hasRisk || !analysisResult?.risk) {
    return null;
  }

  const { nodeRiskMap, frameworkScores } = analysisResult.risk;

  // Use frameworkScores to determine which frameworks have data, fallback to FRAMEWORKS constant
  const frameworks =
    frameworkScores.length > 0
      ? (frameworkScores.map((fs) => fs.framework) as string[])
      : [...FRAMEWORKS];

  return (
    <Card className="bg-slate-800 border-slate-700">
      <div className="p-6">
        <h3 className="text-sm font-medium text-slate-400 mb-4">Risk Heat Map</h3>
        <div className="overflow-auto">
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: `180px repeat(${frameworks.length}, 1fr)` }}
          >
            {/* Column headers */}
            <div />
            {frameworks.map((fw) => (
              <div key={fw} className="text-xs text-slate-400 text-center font-medium px-2 py-1">
                {fw}
              </div>
            ))}

            {/* Data rows — rowIndex drives staggered cascade animation */}
            {nodeRiskMap.map((node, rowIndex) => {
              const cellStatus = deriveCellStatus(node.riskLevel, node.complianceGaps);

              return (
                <>
                  <div
                    key={`${node.nodeId}-label`}
                    className="text-xs text-slate-300 truncate py-1 pr-3 flex items-center"
                    title={node.nodeName}
                  >
                    {node.nodeName}
                  </div>
                  {frameworks.map((fw) => (
                    <HeatMapCell
                      key={`${node.nodeId}-${fw}`}
                      nodeName={node.nodeName}
                      framework={fw}
                      cellStatus={cellStatus}
                      riskFactors={node.riskFactors}
                      rowIndex={rowIndex}
                    />
                  ))}
                </>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-700">
          <span className="text-xs text-slate-500">Legend:</span>
          {(['compliant', 'partial', 'non-compliant', 'not-applicable'] as CellStatus[]).map(
            (status) => (
              <div key={status} className="flex items-center gap-1.5">
                <div className={cn('h-3 w-3 rounded border', cellColors[status])} />
                <span className="text-xs text-slate-500">{cellStatusLabel(status)}</span>
              </div>
            ),
          )}
        </div>
      </div>
    </Card>
  );
});
