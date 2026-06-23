'use client';

import { useMemo } from 'react';
import { Brain, Zap, TrendingUp, ShieldCheck, Trash2, Clock, Target, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLearningStore } from '@/lib/learning/store';

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-300 border-red-500/40',
  high: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  medium: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  low: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  info: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
};

const STATUS_COLORS: Record<string, string> = {
  'non-compliant': 'text-red-400',
  partial: 'text-amber-400',
  compliant: 'text-emerald-400',
  'not-applicable': 'text-slate-500',
};

export default function LearningPage() {
  const patternLibrary = useLearningStore((state) => state.patternLibrary);
  const deterministicRules = useLearningStore((state) => state.deterministicRules);
  const analysisHistory = useLearningStore((state) => state.analysisHistory);
  const clearAll = useLearningStore((state) => state.clearAll);
  const metrics = useLearningStore.getState().getMetrics();

  const patterns = useMemo(
    () => Object.values(patternLibrary).sort((a, b) => b.confidence - a.confidence),
    [patternLibrary],
  );

  const promotedPatterns = useMemo(() => patterns.filter((p) => p.promoted), [patterns]);
  const emergingPatterns = useMemo(
    () => patterns.filter((p) => !p.promoted && p.observationCount >= 2),
    [patterns],
  );
  const newPatterns = useMemo(
    () => patterns.filter((p) => !p.promoted && p.observationCount < 2),
    [patterns],
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-200 mb-2 flex items-center gap-2">
            <Brain className="h-6 w-6 text-cyan-400" />
            Learning Intelligence
          </h1>
          <p className="text-sm text-slate-400">
            Self-learning compliance engine — patterns, deterministic rules, and analysis history
          </p>
        </div>
        {metrics.totalRuns > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => { if (confirm('Clear all learning data? This cannot be undone.')) clearAll(); }}
            className="text-slate-400 border-slate-700 hover:text-red-400 hover:border-red-500/50"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Reset
          </Button>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Intelligence" value={`${metrics.intelligenceScore}/100`} icon={Brain} color="text-cyan-400" />
        <StatCard label="Patterns" value={metrics.totalPatterns} icon={TrendingUp} color="text-blue-400" />
        <StatCard label="Rules" value={metrics.promotedCount} icon={Zap} color="text-amber-400" />
        <StatCard label="Runs" value={metrics.totalRuns} icon={Target} color="text-emerald-400" />
        <StatCard label="Confidence" value={metrics.averageConfidence > 0 ? `${Math.round(metrics.averageConfidence * 100)}%` : '—'} icon={ShieldCheck} color="text-purple-400" />
      </div>

      {/* Deterministic Rules */}
      <Card className="bg-slate-800 border-slate-700">
        <div className="p-5">
          <h2 className="text-sm font-semibold text-amber-400 uppercase tracking-wider mb-1 flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Deterministic Rules
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Auto-promoted patterns that fire as instant pre-checks (Phase 0) before LLM agents — no AI calls, zero latency
          </p>

          {deterministicRules.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-slate-700 rounded-lg">
              <Zap className="h-8 w-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No deterministic rules yet</p>
              <p className="text-xs text-slate-600 mt-1">
                Patterns auto-promote after 3+ observations with 75%+ confidence
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {deterministicRules.map((rule) => (
                <div key={rule.id} className="bg-amber-500/5 rounded-lg p-4 border border-amber-500/20">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <p className="text-sm text-slate-200 font-medium">{rule.description}</p>
                    <span className={`shrink-0 inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold border ${SEVERITY_COLORS[rule.severity]}`}>
                      {rule.severity}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span>Framework: <span className="text-slate-300">{rule.framework}</span></span>
                    <span>Status: <span className={STATUS_COLORS[rule.status]}>{rule.status}</span></span>
                    <span>Observed: <span className="text-slate-300">{rule.sourceObservations}x</span></span>
                    <span>Confidence: <span className="text-slate-300">{Math.round(rule.sourceConfidence * 100)}%</span></span>
                    <span>Promoted: <span className="text-slate-300">{new Date(rule.promotedAt).toLocaleString()}</span></span>
                  </div>
                  {rule.recommendation && (
                    <p className="mt-2 text-xs text-slate-400 bg-slate-900/50 rounded px-3 py-2">
                      {rule.recommendation}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {rule.triggers.protocols.map((p) => (
                      <TriggerBadge key={p} label={p} type="protocol" />
                    ))}
                    {rule.triggers.nodeTypes.map((n) => (
                      <TriggerBadge key={n} label={n} type="node" />
                    ))}
                    {rule.triggers.missingControls.map((c) => (
                      <TriggerBadge key={c} label={`missing: ${c}`} type="control" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Pattern Library */}
      <Card className="bg-slate-800 border-slate-700">
        <div className="p-5">
          <h2 className="text-sm font-semibold text-cyan-400 uppercase tracking-wider mb-1 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Pattern Library
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Compliance patterns extracted from analysis results — tracked across runs with fingerprinting
          </p>

          {patterns.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-slate-700 rounded-lg">
              <TrendingUp className="h-8 w-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No patterns discovered yet</p>
              <p className="text-xs text-slate-600 mt-1">Run an analysis to start learning</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Promoted */}
              {promotedPatterns.length > 0 && (
                <PatternSection title="Promoted to Rules" patterns={promotedPatterns} badge="RULE" badgeColor="bg-amber-500/20 text-amber-300" />
              )}
              {/* Emerging */}
              {emergingPatterns.length > 0 && (
                <PatternSection title="Emerging (2+ observations)" patterns={emergingPatterns} badge="EMERGING" badgeColor="bg-cyan-500/20 text-cyan-300" />
              )}
              {/* New */}
              {newPatterns.length > 0 && (
                <PatternSection title="New (1 observation)" patterns={newPatterns} badge="NEW" badgeColor="bg-slate-500/20 text-slate-300" />
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Analysis History */}
      <Card className="bg-slate-800 border-slate-700">
        <div className="p-5">
          <h2 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-1 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Analysis History
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Run-by-run record of pattern discovery, rule promotion, and scoring
          </p>

          {analysisHistory.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-slate-700 rounded-lg">
              <Clock className="h-8 w-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No analysis runs recorded yet</p>
            </div>
          ) : (
            <ScrollArea className={analysisHistory.length > 5 ? 'h-[300px]' : ''}>
              <div className="space-y-2">
                {[...analysisHistory].reverse().map((run, i) => (
                  <div key={run.id} className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-300">
                        Run #{analysisHistory.length - i}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(run.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      {run.overallScore !== null && (
                        <span>Score: <span className="text-slate-300">{run.overallScore}/100</span></span>
                      )}
                      <span>New patterns: <span className="text-cyan-400">+{run.newPatternsDiscovered}</span></span>
                      {run.patternsPromoted > 0 && (
                        <span>Promoted: <span className="text-amber-400">+{run.patternsPromoted}</span></span>
                      )}
                      {run.deterministicRulesFired > 0 && (
                        <span>Rules fired: <span className="text-emerald-400">{run.deterministicRulesFired}</span></span>
                      )}
                      <span>Duration: <span className="text-slate-300">{(run.duration / 1000).toFixed(1)}s</span></span>
                    </div>
                    {run.frameworkScores.length > 0 && (
                      <div className="flex gap-2 mt-2">
                        {run.frameworkScores.map((fs) => (
                          <span key={fs.framework} className="text-[10px] bg-slate-800 rounded px-1.5 py-0.5 text-slate-400">
                            {fs.framework}: {fs.score}/100
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </Card>

      {/* How it works */}
      <Card className="bg-slate-800 border-slate-700">
        <div className="p-5">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            How Learning Works
          </h2>
          <div className="grid md:grid-cols-4 gap-4">
            <StepCard step={1} title="Extract" description="After each analysis, patterns are fingerprinted from structural triggers (protocols, node types, missing controls)" />
            <StepCard step={2} title="Track" description="Each pattern tracks observation count and confidence score. Same structural issue = same fingerprint across runs" />
            <StepCard step={3} title="Promote" description="At 3+ observations with 75%+ confidence, patterns auto-promote to deterministic rules" />
            <StepCard step={4} title="Fire" description="Oracle runs promoted rules as Phase 0 pre-checks — instant findings before any LLM agent starts" />
          </div>
        </div>
      </Card>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: typeof Brain; color: string }) {
  return (
    <Card className="bg-slate-800 border-slate-700 p-4">
      <div className="flex items-center gap-3">
        <Icon className={`h-5 w-5 ${color}`} />
        <div>
          <p className="text-lg font-bold text-slate-200">{value}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
        </div>
      </div>
    </Card>
  );
}

function PatternSection({ title, patterns, badge, badgeColor }: { title: string; patterns: { fingerprint: string; description: string; framework: string; status: string; severity: string; observationCount: number; confidence: number; firstSeen: string; lastSeen: string; triggers: { protocols: string[]; nodeTypes: string[]; relationshipTypes: string[]; missingControls: string[] } }[]; badge: string; badgeColor: string }) {
  return (
    <div>
      <h3 className="text-xs font-medium text-slate-500 mb-2">{title} ({patterns.length})</h3>
      <ScrollArea className={patterns.length > 4 ? 'h-[280px]' : ''}>
        <div className="space-y-2 pr-2">
          {patterns.map((p) => (
            <div key={p.fingerprint} className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-xs text-slate-300">{p.description}</p>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold ${badgeColor}`}>{badge}</span>
                  <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold border ${SEVERITY_COLORS[p.severity]}`}>{p.severity}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500">
                <span>{p.framework}</span>
                <span className={STATUS_COLORS[p.status]}>{p.status}</span>
                <span>{p.observationCount}x observed</span>
                <span>{Math.round(p.confidence * 100)}% confidence</span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {p.triggers.protocols.map((t) => <TriggerBadge key={t} label={t} type="protocol" />)}
                {p.triggers.nodeTypes.map((t) => <TriggerBadge key={t} label={t} type="node" />)}
                {p.triggers.missingControls.map((t) => <TriggerBadge key={t} label={`missing: ${t}`} type="control" />)}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function TriggerBadge({ label, type }: { label: string; type: 'protocol' | 'node' | 'control' }) {
  const colors = {
    protocol: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    node: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    control: 'bg-red-500/10 text-red-400 border-red-500/30',
  };
  return (
    <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] border ${colors[type]}`}>
      {label}
    </span>
  );
}

function StepCard({ step, title, description }: { step: number; title: string; description: string }) {
  return (
    <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="flex items-center justify-center h-5 w-5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-bold">{step}</span>
        <span className="text-xs font-medium text-slate-300">{title}</span>
      </div>
      <p className="text-[10px] text-slate-500 leading-relaxed">{description}</p>
    </div>
  );
}
