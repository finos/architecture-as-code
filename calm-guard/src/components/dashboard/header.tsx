'use client';

import { useAnalysisStore } from '@/store/analysis-store';
import { useAgentStream } from '@/hooks/use-agent-stream';
import { DEMO_ARCHITECTURES } from '../../../examples';
import { parseCalm } from '@/lib/calm/parser';
import { extractAnalysisInput } from '@/lib/calm/extractor';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AnalyzeButton } from '@/components/dashboard/analyze-button';

export function Header() {
  const rawCalmData = useAnalysisStore((state) => state.rawCalmData);
  const analysisInput = useAnalysisStore((state) => state.analysisInput);
  const calmVersion = useAnalysisStore((state) => state.calmVersion);
  const status = useAnalysisStore((state) => state.status);
  const selectedDemoId = useAnalysisStore((state) => state.selectedDemoId);
  const selectedFrameworks = useAnalysisStore((state) => state.selectedFrameworks);
  const setCalmData = useAnalysisStore((state) => state.setCalmData);
  const setSelectedDemo = useAnalysisStore((state) => state.setSelectedDemo);
  const setError = useAnalysisStore((state) => state.setError);
  const setStatus = useAnalysisStore((state) => state.setStatus);

  const { startStream } = useAgentStream();

  const nodeCount = analysisInput?.metadata.nodeCount ?? 0;
  const relationshipCount = analysisInput?.metadata.relationshipCount ?? 0;

  const handleDemoSelection = (demoId: string) => {
    const demo = DEMO_ARCHITECTURES.find((d) => d.id === demoId);
    if (!demo) return;

    setSelectedDemo(demoId);
    setStatus('loading');

    const result = parseCalm(demo.data);

    if (result.success) {
      const input = extractAnalysisInput(result.data);
      setCalmData(result.data, input, result.version);
    } else {
      setError(result.error);
    }
  };

  const handleAnalyze = () => {
    if (rawCalmData) {
      void startStream(rawCalmData, selectedFrameworks);
    }
  };

  const isAnalyzing = status === 'analyzing';
  const canAnalyze = rawCalmData !== null && !isAnalyzing;

  return (
    <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6">
      {/* Left: Breadcrumb */}
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-semibold text-slate-400">
          Dashboard
        </h2>
      </div>

      {/* Right: Architecture selector, Analyze button, parse status */}
      <div className="flex items-center gap-3">
        {/* Architecture Selector */}
        <Select
          value={selectedDemoId ?? undefined}
          onValueChange={handleDemoSelection}
          disabled={isAnalyzing}
        >
          <SelectTrigger className="w-52 bg-slate-800 border-slate-700 text-slate-100 hover:bg-slate-700 focus:ring-slate-600 h-8 text-sm">
            <SelectValue placeholder="Select Architecture..." />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            {DEMO_ARCHITECTURES.map((demo) => (
              <SelectItem
                key={demo.id}
                value={demo.id}
                className="text-slate-100 focus:bg-slate-700 focus:text-slate-50"
              >
                {demo.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Analyze Button */}
        <AnalyzeButton
          onAnalyze={handleAnalyze}
          disabled={!canAnalyze}
          loading={isAnalyzing}
        />

        {/* Parse status badges — version + node/relationship counts */}
        {analysisInput && (
          <>
            {calmVersion && (
              <Badge
                variant="secondary"
                className="bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                CALM v{calmVersion}
              </Badge>
            )}
            <Badge
              variant="secondary"
              className="bg-slate-800 text-slate-300 hover:bg-slate-700"
            >
              Parsed: {nodeCount} nodes, {relationshipCount} relationships
            </Badge>
          </>
        )}
      </div>
    </header>
  );
}
