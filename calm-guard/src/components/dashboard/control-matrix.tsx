'use client';

import { useState, useMemo } from 'react';
import { useAnalysisStore } from '@/store/analysis-store';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ChevronUp, ChevronDown, AlertTriangle } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type SortField = 'framework' | 'controlId' | 'status';
type SortDir = 'asc' | 'desc';

// Maps status to sort order (lower = higher priority = shown first when desc)
const STATUS_ORDER: Record<string, number> = {
  'non-compliant': 0,
  partial: 1,
  compliant: 2,
  'not-applicable': 3,
};

// ─── Status badge ─────────────────────────────────────────────────────────────

function getStatusBadge(status: string) {
  const variants: Record<string, string> = {
    compliant: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    partial: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    'non-compliant': 'bg-red-500/20 text-red-400 border border-red-500/30',
    'not-applicable': 'bg-slate-700/50 text-slate-500 border border-slate-600/30',
  };
  const labels: Record<string, string> = {
    compliant: 'Pass',
    partial: 'Partial',
    'non-compliant': 'Fail',
    'not-applicable': 'N/A',
  };

  const variantClass = variants[status] ?? variants['not-applicable'];
  const label = labels[status] ?? status;

  return (
    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', variantClass)}>
      {label}
    </span>
  );
}

// ─── Sort icon ────────────────────────────────────────────────────────────────

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (field !== sortField) {
    return <ChevronDown className="h-3 w-3 opacity-30 ml-1 inline" />;
  }
  return sortDir === 'asc'
    ? <ChevronUp className="h-3 w-3 ml-1 inline" />
    : <ChevronDown className="h-3 w-3 ml-1 inline" />;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ControlMatrix() {
  const analysisResult = useAnalysisStore((state) => state.analysisResult);

  const [sortField, setSortField] = useState<SortField>('status');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [frameworkFilter, setFrameworkFilter] = useState<string>('all');

  const hasData = analysisResult !== null;
  const hasCompliance = hasData && analysisResult.compliance !== null;

  // Graceful degradation: analysis ran but compliance failed
  if (hasData && !hasCompliance) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <div className="p-6">
          <h3 className="text-sm font-medium text-slate-400 mb-4">Control Matrix</h3>
          <div className="flex items-center gap-2 text-amber-400 text-sm">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>Compliance data unavailable — agent failed</span>
          </div>
        </div>
      </Card>
    );
  }

  // Empty state: no analysis run yet
  if (!hasData) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <div className="p-6">
          <h3 className="text-sm font-medium text-slate-400 mb-4">Control Matrix</h3>
          <p className="text-slate-500 text-sm">Run analysis to view control mappings</p>
        </div>
      </Card>
    );
  }

  // Data is available — use hook-derived values below
  return (
    <ControlMatrixInner
      frameworkMappings={analysisResult!.compliance!.frameworkMappings}
      sortField={sortField}
      setSortField={setSortField}
      sortDir={sortDir}
      setSortDir={setSortDir}
      frameworkFilter={frameworkFilter}
      setFrameworkFilter={setFrameworkFilter}
    />
  );
}

// ─── Inner component (renders after data check) ───────────────────────────────

interface FrameworkMapping {
  framework: 'SOX' | 'PCI-DSS' | 'CCC' | 'NIST-CSF' | 'SOC2';
  controlId: string;
  controlName: string;
  calmControlId: string | null;
  status: 'compliant' | 'partial' | 'non-compliant' | 'not-applicable';
  evidence: string;
  recommendation: string;
  severity: string;
}

interface ControlMatrixInnerProps {
  frameworkMappings: FrameworkMapping[];
  sortField: SortField;
  setSortField: (field: SortField) => void;
  sortDir: SortDir;
  setSortDir: (dir: SortDir) => void;
  frameworkFilter: string;
  setFrameworkFilter: (fw: string) => void;
}

function ControlMatrixInner({
  frameworkMappings,
  sortField,
  setSortField,
  sortDir,
  setSortDir,
  frameworkFilter,
  setFrameworkFilter,
}: ControlMatrixInnerProps) {
  // Derive unique framework names for the filter dropdown
  const uniqueFrameworks = useMemo(
    () => [...new Set(frameworkMappings.map((row) => row.framework))].sort(),
    [frameworkMappings],
  );

  // Handle column header sort click
  function handleSort(field: SortField) {
    if (field === sortField) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }

  // Apply filter then sort
  const sortedFiltered = useMemo(() => {
    let rows = [...frameworkMappings];

    // Filter
    if (frameworkFilter !== 'all') {
      rows = rows.filter((row) => row.framework === frameworkFilter);
    }

    // Sort
    rows.sort((a, b) => {
      let comparison = 0;

      if (sortField === 'framework') {
        comparison = a.framework.localeCompare(b.framework);
      } else if (sortField === 'controlId') {
        comparison = a.controlId.localeCompare(b.controlId);
      } else if (sortField === 'status') {
        const orderA = STATUS_ORDER[a.status] ?? 99;
        const orderB = STATUS_ORDER[b.status] ?? 99;
        comparison = orderA - orderB;
      }

      return sortDir === 'asc' ? comparison : -comparison;
    });

    return rows;
  }, [frameworkMappings, frameworkFilter, sortField, sortDir]);

  const thClass =
    'px-3 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200 select-none';
  const thStaticClass =
    'px-3 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider select-none';

  return (
    <Card className="bg-slate-800 border-slate-700">
      <div className="p-6">
        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-slate-400">Control Matrix</h3>
          <Select onValueChange={setFrameworkFilter} defaultValue="all">
            <SelectTrigger className="w-48 h-8 text-xs bg-slate-900 border-slate-700 text-slate-300">
              <SelectValue placeholder="Filter by framework" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700 text-slate-300">
              <SelectItem value="all" className="text-xs">All Frameworks</SelectItem>
              {uniqueFrameworks.map((fw) => (
                <SelectItem key={fw} value={fw} className="text-xs">
                  {fw}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="overflow-auto max-h-96">
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-400 border-b border-slate-700 sticky top-0 bg-slate-800">
              <tr>
                <th
                  className={thClass}
                  onClick={() => handleSort('framework')}
                >
                  Framework
                  <SortIcon field="framework" sortField={sortField} sortDir={sortDir} />
                </th>
                <th
                  className={thClass}
                  onClick={() => handleSort('controlId')}
                >
                  Control ID
                  <SortIcon field="controlId" sortField={sortField} sortDir={sortDir} />
                </th>
                <th className={thStaticClass}>Control Name</th>
                <th className={thStaticClass}>CALM Mapping</th>
                <th
                  className={thClass}
                  onClick={() => handleSort('status')}
                >
                  Status
                  <SortIcon field="status" sortField={sortField} sortDir={sortDir} />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {sortedFiltered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-500 text-xs">
                    No controls match the selected filter.
                  </td>
                </tr>
              ) : (
                sortedFiltered.map((row, idx) => (
                  <tr
                    key={`${row.framework}-${row.controlId}-${idx}`}
                    className="hover:bg-slate-700/30 transition-colors"
                  >
                    <td className="px-3 py-2 text-xs text-slate-300 font-medium whitespace-nowrap">
                      {row.framework}
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-mono text-xs text-slate-400">{row.controlId}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-300 max-w-xs">
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="truncate block cursor-default">{row.controlName}</span>
                          </TooltipTrigger>
                          <TooltipContent className="bg-slate-800 border-slate-700 text-slate-200 max-w-sm">
                            <p className="text-xs">{row.controlName}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-400 font-mono">
                      {row.calmControlId ?? (
                        <span className="text-slate-600 not-italic">N/A</span>
                      )}
                    </td>
                    <td className="px-3 py-2">{getStatusBadge(row.status)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Row count footer */}
        <div className="mt-3 pt-3 border-t border-slate-700/50">
          <p className="text-xs text-slate-600">
            Showing {sortedFiltered.length} of {frameworkMappings.length} controls
          </p>
        </div>
      </div>
    </Card>
  );
}
