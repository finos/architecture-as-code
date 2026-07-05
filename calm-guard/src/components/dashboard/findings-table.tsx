'use client';

import { useMemo, useState } from 'react';
import { ChevronRight, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAnalysisStore } from '@/store/analysis-store';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  info: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SeverityBadge({ severity }: { severity: string }) {
  const colorClass = SEVERITY_COLORS[severity.toLowerCase()] ?? 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border shrink-0',
        colorClass
      )}
    >
      {severity}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function FindingsTable() {
  const analysisResult = useAnalysisStore((state) => state.analysisResult);
  const status = useAnalysisStore((state) => state.status);

  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [frameworkFilter, setFrameworkFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  const findings = useMemo(
    () => analysisResult?.risk?.topFindings ?? [],
    [analysisResult?.risk?.topFindings]
  );

  // Collect unique frameworks (framework is optional — filter undefined values)
  const uniqueFrameworks = useMemo(
    () => [...new Set(findings.map((f) => f.framework).filter(Boolean))] as string[],
    [findings]
  );

  // Filter + sort findings
  const sortedFiltered = useMemo(() => {
    let rows = [...findings];
    if (frameworkFilter !== 'all') {
      rows = rows.filter((r) => (r.framework ?? '') === frameworkFilter);
    }
    if (severityFilter !== 'all') {
      rows = rows.filter((r) => r.severity === severityFilter);
    }
    rows.sort((a, b) => {
      const orderA = SEVERITY_ORDER[a.severity] ?? 5;
      const orderB = SEVERITY_ORDER[b.severity] ?? 5;
      return orderA - orderB; // severity descending — critical first
    });
    return rows;
  }, [findings, frameworkFilter, severityFilter]);

  // Toggle expanded row by index
  const toggleExpand = (idx: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  // Empty state — no analysis run yet
  if (status === 'idle' || status === 'parsed' || status === 'loading') {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <div className="p-6 flex items-center justify-center h-48">
          <p className="text-sm text-slate-500">Run analysis to view findings</p>
        </div>
      </Card>
    );
  }

  // Graceful degradation — analysis ran but risk agent failed
  if (status === 'complete' && !analysisResult?.risk) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <div className="p-6 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-400">Risk data unavailable — risk scorer agent failed</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800 border-slate-700">
      <div className="p-6">
        {/* Header row with filters */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-slate-400">
            Findings
            {sortedFiltered.length !== findings.length && (
              <span className="ml-2 text-slate-600">
                ({sortedFiltered.length} of {findings.length})
              </span>
            )}
          </h3>
          <div className="flex gap-2">
            {/* Framework filter */}
            <Select defaultValue="all" onValueChange={setFrameworkFilter}>
              <SelectTrigger className="h-7 w-[130px] text-xs bg-slate-900 border-slate-700 text-slate-300">
                <SelectValue placeholder="All Frameworks" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700 text-slate-300">
                <SelectItem value="all" className="text-xs focus:bg-slate-800 focus:text-slate-100">
                  All Frameworks
                </SelectItem>
                {uniqueFrameworks.map((fw) => (
                  <SelectItem
                    key={fw}
                    value={fw}
                    className="text-xs focus:bg-slate-800 focus:text-slate-100"
                  >
                    {fw}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Severity filter */}
            <Select defaultValue="all" onValueChange={setSeverityFilter}>
              <SelectTrigger className="h-7 w-[130px] text-xs bg-slate-900 border-slate-700 text-slate-300">
                <SelectValue placeholder="All Severities" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700 text-slate-300">
                <SelectItem value="all" className="text-xs focus:bg-slate-800 focus:text-slate-100">
                  All Severities
                </SelectItem>
                {(['critical', 'high', 'medium', 'low', 'info'] as const).map((sev) => (
                  <SelectItem
                    key={sev}
                    value={sev}
                    className="text-xs focus:bg-slate-800 focus:text-slate-100"
                  >
                    {sev.charAt(0).toUpperCase() + sev.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Findings list */}
        {sortedFiltered.length === 0 ? (
          <div className="flex items-center justify-center h-24">
            <p className="text-sm text-slate-500">
              {findings.length === 0 ? 'No findings reported' : 'No findings match the current filters'}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {sortedFiltered.map((finding, idx) => (
              <div key={idx}>
                {/* Summary row — clickable */}
                <div
                  onClick={() => toggleExpand(idx)}
                  className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-700/50 cursor-pointer transition-colors"
                >
                  <ChevronRight
                    className={cn(
                      'h-4 w-4 text-slate-500 transition-transform shrink-0',
                      expandedRows.has(idx) && 'rotate-90'
                    )}
                  />
                  <SeverityBadge severity={finding.severity} />
                  <span className="text-sm text-slate-200 flex-1 truncate">{finding.finding}</span>
                  <span className="text-xs text-slate-500 shrink-0">
                    {finding.affectedNodes.join(', ')}
                  </span>
                </div>

                {/* Expanded detail row */}
                {expandedRows.has(idx) && (
                  <div className="ml-10 px-3 py-2 text-xs text-slate-400 space-y-1 border-l-2 border-slate-700">
                    <p>
                      <span className="text-slate-500">Framework:</span>{' '}
                      {finding.framework ?? 'General'}
                    </p>
                    <p>
                      <span className="text-slate-500">Recommendation:</span>{' '}
                      {finding.recommendation}
                    </p>
                    {finding.affectedNodes.length > 0 && (
                      <p>
                        <span className="text-slate-500">Affected Nodes:</span>{' '}
                        {finding.affectedNodes.join(', ')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
