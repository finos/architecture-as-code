import { useState, useMemo } from 'react';
import { Shield, Filter, Search, BarChart3, X } from 'lucide-react';
import type { ResolvedControl } from '@/types/calm';
import { ControlDetails } from './ControlDetails';
import { ControlCategoryBadge } from './ControlBadge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

interface ControlPanelProps {
  resolvedControls: ResolvedControl[];
  onClose?: () => void;
}

export function ControlPanel({ resolvedControls, onClose }: ControlPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [sourceTypeFilter, setSourceTypeFilter] = useState<'node' | 'relationship' | null>(null);

  // Filter controls based on search and filters
  const filteredControls = useMemo(() => {
    return resolvedControls.filter(rc => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = rc.controlName.toLowerCase().includes(query);
        const matchesSource = rc.sourceName.toLowerCase().includes(query);
        const matchesDescription = rc.control.description.toLowerCase().includes(query);
        const matchesControlId = rc.configs.some(config =>
          config['control-id'].toLowerCase().includes(query)
        );
        if (!matchesName && !matchesSource && !matchesDescription && !matchesControlId) {
          return false;
        }
      }

      // Category filter
      if (categoryFilter) {
        const hasCategory = rc.configs.some(config => config.category === categoryFilter);
        if (!hasCategory) return false;
      }

      // Source type filter
      if (sourceTypeFilter && rc.sourceType !== sourceTypeFilter) {
        return false;
      }

      return true;
    });
  }, [resolvedControls, searchQuery, categoryFilter, sourceTypeFilter]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = resolvedControls.length;
    const preventative = resolvedControls.filter(rc =>
      rc.configs.some(c => c.category === 'Preventative')
    ).length;
    const detective = resolvedControls.filter(rc =>
      rc.configs.some(c => c.category === 'Detective')
    ).length;
    const risk = resolvedControls.filter(rc =>
      rc.configs.some(c => c.category === 'Risk')
    ).length;

    const onNodes = resolvedControls.filter(rc => rc.sourceType === 'node').length;
    const onRelationships = resolvedControls.filter(rc => rc.sourceType === 'relationship').length;

    // Unique risks mitigated
    const uniqueRisks = new Set<string>();
    resolvedControls.forEach(rc => {
      rc.configs.forEach(config => {
        config['mitigates-risks']?.forEach(risk => uniqueRisks.add(risk));
      });
    });

    return {
      total,
      preventative,
      detective,
      risk,
      onNodes,
      onRelationships,
      uniqueRisksMitigated: uniqueRisks.size,
    };
  }, [resolvedControls]);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-950">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-800 p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Shield className="text-green-600" size={24} />
              Security Controls
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              FINOS AIGF control configurations across the architecture
            </p>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X size={20} />
            </Button>
          )}
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
          <StatCard label="Total Controls" value={stats.total} icon={Shield} />
          <StatCard
            label="Preventative"
            value={stats.preventative}
            color="text-green-600"
          />
          <StatCard label="Detective" value={stats.detective} color="text-blue-600" />
          <StatCard
            label="Risks Mitigated"
            value={stats.uniqueRisksMitigated}
            color="text-yellow-600"
          />
        </div>

        {/* Search */}
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            size={16}
          />
          <Input
            type="text"
            placeholder="Search controls by name, ID, or source..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mt-3">
          <div className="flex items-center gap-1">
            <Filter size={14} className="text-gray-500" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Category:</span>
            <Button
              variant={categoryFilter === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCategoryFilter(null)}
              className="h-7 text-xs"
            >
              All
            </Button>
            <Button
              variant={categoryFilter === 'Preventative' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCategoryFilter('Preventative')}
              className="h-7 text-xs"
            >
              Preventative
            </Button>
            <Button
              variant={categoryFilter === 'Detective' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCategoryFilter('Detective')}
              className="h-7 text-xs"
            >
              Detective
            </Button>
            <Button
              variant={categoryFilter === 'Risk' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCategoryFilter('Risk')}
              className="h-7 text-xs"
            >
              Risk
            </Button>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-600 dark:text-gray-400">Source:</span>
            <Button
              variant={sourceTypeFilter === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSourceTypeFilter(null)}
              className="h-7 text-xs"
            >
              All
            </Button>
            <Button
              variant={sourceTypeFilter === 'node' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSourceTypeFilter('node')}
              className="h-7 text-xs"
            >
              Nodes ({stats.onNodes})
            </Button>
            <Button
              variant={sourceTypeFilter === 'relationship' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSourceTypeFilter('relationship')}
              className="h-7 text-xs"
            >
              Relationships ({stats.onRelationships})
            </Button>
          </div>
        </div>
      </div>

      {/* Controls List */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredControls.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {resolvedControls.length === 0 ? (
              <p>No controls found in this architecture.</p>
            ) : (
              <p>No controls match the current filters.</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredControls.map((rc, index) => (
              <div key={`${rc.sourceId}-${rc.controlName}-${index}`}>
                <div className="flex items-center gap-2 mb-2 text-xs text-gray-600 dark:text-gray-400">
                  <Badge variant="outline" className="text-xs">
                    {rc.sourceType === 'node' ? 'Node' : 'Relationship'}
                  </Badge>
                  <span>{rc.sourceName}</span>
                </div>
                <ControlDetails
                  controlName={rc.controlName}
                  control={rc.control}
                  resolvedConfigs={rc.configs}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  icon?: React.ElementType;
  color?: string;
}

function StatCard({ label, value, icon: Icon, color = 'text-gray-900 dark:text-gray-100' }: StatCardProps) {
  return (
    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-800">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-600 dark:text-gray-400">{label}</span>
        {Icon && <Icon size={14} className="text-gray-400" />}
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
