'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { Brain, Zap, TrendingUp, BarChart3, ChevronUp, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { OdometerScore } from '@/components/ui/odometer-score';
import { useLearningStore } from '@/lib/learning/store';
import { useAnalysisStore } from '@/store/analysis-store';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RADIUS = 48;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const CENTER = 56;

// ---------------------------------------------------------------------------
// useCountUp hook — same ease-out-cubic as ComplianceCard
// ---------------------------------------------------------------------------

function useCountUp(target: number, duration = 1200): number {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (target <= 0) {
      setDisplay(0);
      return;
    }
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

    const startTime = performance.now();
    function animate(now: number) {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(target * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        rafRef.current = null;
      }
    }
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [target, duration]);

  return display;
}

// ---------------------------------------------------------------------------
// Intelligence Gauge — cyan color scheme
// ---------------------------------------------------------------------------

function getGaugeColor(score: number): string {
  if (score < 20) return '#64748b'; // slate-500 — dormant
  if (score < 50) return '#06b6d4'; // cyan-500 — learning
  if (score < 80) return '#22d3ee'; // cyan-400 — maturing
  return '#67e8f9'; // cyan-300 — expert
}

interface GaugeProps {
  displayScore: number;
  hasData: boolean;
  isAnalyzing: boolean;
}

function IntelligenceGauge({ displayScore, hasData, isAnalyzing }: GaugeProps) {
  const color = getGaugeColor(displayScore);
  const strokeDashoffset = CIRCUMFERENCE * (1 - displayScore / 100);

  if (isAnalyzing && !hasData) {
    return (
      <svg width={112} height={112} viewBox="0 0 112 112" aria-label="Learning in progress">
        <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="currentColor" strokeWidth={7} className="text-slate-700" />
        <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="#06b6d4" strokeWidth={7} opacity={0.4} className="animate-gauge-pulse" />
        <text x={CENTER} y={CENTER - 2} textAnchor="middle" dominantBaseline="middle" fontSize={10} fontWeight="600" fill="#06b6d4" className="animate-gauge-pulse">
          Learning
        </text>
        <text x={CENTER} y={CENTER + 12} textAnchor="middle" dominantBaseline="middle" fontSize={8} fill="#64748b">
          ...
        </text>
      </svg>
    );
  }

  if (!hasData) {
    return (
      <svg width={112} height={112} viewBox="0 0 112 112" aria-label="No learning data yet">
        <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="currentColor" strokeWidth={7} strokeDasharray="4 4" className="text-slate-700" />
        <text x={CENTER} y={CENTER - 4} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill="#64748b">Run analysis</text>
        <text x={CENTER} y={CENTER + 10} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill="#64748b">to start learning</text>
      </svg>
    );
  }

  return (
    <svg width={112} height={112} viewBox="0 0 112 112" aria-label={`Intelligence score: ${displayScore} out of 100`}>
      <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="currentColor" strokeWidth={7} className="text-slate-700" />
      <circle
        cx={CENTER} cy={CENTER} r={RADIUS} fill="none"
        stroke={color} strokeWidth={7} strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE} strokeDashoffset={strokeDashoffset}
        transform={`rotate(-90 ${CENTER} ${CENTER})`}
        style={{ transition: 'stroke-dashoffset 0.1s linear, stroke 0.3s ease' }}
      />
      <foreignObject x={CENTER - 26} y={CENTER - 18} width={52} height={30}>
        <div style={{ color }} className="flex items-center justify-center h-full text-xl font-bold">
          <OdometerScore score={displayScore} />
        </div>
      </foreignObject>
      <text x={CENTER} y={CENTER + 14} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill="#94a3b8">/ 100</text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Mini stat card
// ---------------------------------------------------------------------------

interface StatProps {
  label: string;
  value: string | number;
  icon: typeof Brain;
  color: string;
}

function MiniStat({ label, value, icon: Icon, color }: StatProps) {
  return (
    <div className="flex items-center gap-2.5 bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-700/50">
      <div className="flex items-center justify-center h-7 w-7 rounded-md bg-slate-700/50">
        <Icon className="h-3.5 w-3.5" style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 truncate">{label}</p>
        <p className="text-sm font-semibold text-slate-200">{value}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Learning Curve chart
// ---------------------------------------------------------------------------

interface ChartDataPoint {
  run: number;
  score: number;
}

function LearningCurve({ data }: { data: ChartDataPoint[] }) {
  if (data.length < 2) return null;

  return (
    <div className="h-[100px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="learningGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="run"
            tick={{ fontSize: 10, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              borderColor: '#334155',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(v) => `Run ${v}`}
            formatter={(v: number | undefined) => [`${v ?? 0}`, 'Score']}
          />
          <Area
            type="monotone"
            dataKey="score"
            stroke="#06b6d4"
            strokeWidth={2}
            fill="url(#learningGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confidence bar — thin horizontal bar
// ---------------------------------------------------------------------------

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color = confidence >= 0.75 ? 'bg-emerald-500' : confidence >= 0.5 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 rounded-full bg-slate-700">
        <div className={`h-1 rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-slate-500 w-8 text-right">{pct}%</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Framework badge
// ---------------------------------------------------------------------------

const FRAMEWORK_COLORS: Record<string, string> = {
  'PCI-DSS': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  SOX: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'NIST-CSF': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  CCC: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
};

function FrameworkBadge({ framework }: { framework: string }) {
  const style = FRAMEWORK_COLORS[framework] ?? 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium border ${style}`}>
      {framework}
    </span>
  );
}

// ---------------------------------------------------------------------------
// LearningPanel — main export
// ---------------------------------------------------------------------------

export function LearningPanel() {
  const status = useAnalysisStore((state) => state.status);
  const isAnalyzing = status === 'analyzing';

  const patternLibrary = useLearningStore((state) => state.patternLibrary);
  const deterministicRules = useLearningStore((state) => state.deterministicRules);
  const analysisHistory = useLearningStore((state) => state.analysisHistory);
  const metrics = useLearningStore.getState().getMetrics();

  const displayScore = useCountUp(metrics.intelligenceScore);
  const hasData = metrics.totalRuns > 0;

  // Sort patterns by confidence descending for insights feed
  const sortedPatterns = useMemo(() => {
    return Object.values(patternLibrary).sort((a, b) => b.confidence - a.confidence);
  }, [patternLibrary]);

  // Chart data from analysis history
  const chartData: ChartDataPoint[] = useMemo(() => {
    return analysisHistory.map((run, i) => ({
      run: i + 1,
      score: run.overallScore ?? 0,
    }));
  }, [analysisHistory]);

  return (
    <Card className="bg-slate-800 border-slate-700">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <Brain className="h-4 w-4 text-cyan-400" />
          <h3 className="text-sm font-medium text-slate-400">Learning Intelligence</h3>
          {isAnalyzing && (
            <span className="ml-auto flex items-center gap-1 text-[10px] text-cyan-400 animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
              live
            </span>
          )}
          {hasData && !isAnalyzing && (
            <span className="ml-auto text-[10px] text-slate-500">
              {metrics.totalRuns} run{metrics.totalRuns === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {/* Gauge + Stats row */}
        <div className="flex items-center gap-4 mb-4">
          <div className="shrink-0">
            <IntelligenceGauge displayScore={displayScore} hasData={hasData} isAnalyzing={isAnalyzing} />
          </div>
          <div className="flex-1 space-y-2">
            <MiniStat
              label="Patterns"
              value={metrics.totalPatterns}
              icon={TrendingUp}
              color="#06b6d4"
            />
            <MiniStat
              label="Rules"
              value={deterministicRules.length}
              icon={Zap}
              color="#f59e0b"
            />
            <MiniStat
              label="Confidence"
              value={metrics.averageConfidence > 0 ? `${Math.round(metrics.averageConfidence * 100)}%` : '—'}
              icon={BarChart3}
              color="#10b981"
            />
          </div>
        </div>

        {/* Learning Curve */}
        <LearningCurve data={chartData} />

        {/* Deterministic Rules — proof that auto-promotion works */}
        {deterministicRules.length > 0 && (
          <div className="mt-4">
            <h4 className="text-xs font-medium text-amber-500/80 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Zap className="h-3 w-3" />
              Deterministic Rules
              <span className="ml-auto text-[10px] text-slate-500 normal-case font-normal">
                fires on next analysis
              </span>
            </h4>
            <ScrollArea className={deterministicRules.length > 3 ? 'h-[120px]' : ''}>
              <div className="space-y-1.5 pr-2">
                {deterministicRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="bg-amber-500/5 rounded-lg px-3 py-2 border border-amber-500/20"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
                        {rule.description}
                      </p>
                      <FrameworkBadge framework={rule.framework} />
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500">
                      <span className="flex items-center gap-0.5">
                        <ShieldCheck className="h-2.5 w-2.5 text-amber-500" />
                        {rule.severity}
                      </span>
                      <span>
                        {rule.sourceObservations}x observed
                      </span>
                      <span>
                        {Math.round(rule.sourceConfidence * 100)}% confidence
                      </span>
                      <span className="ml-auto text-slate-600">
                        promoted {new Date(rule.promotedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Promotion progress — show when close to promoting */}
        {deterministicRules.length === 0 && sortedPatterns.length > 0 && (
          <div className="mt-3 px-3 py-2 bg-slate-900/30 rounded-lg border border-dashed border-slate-700/50">
            <p className="text-[10px] text-slate-500 text-center">
              {(() => {
                const maxObs = Math.max(...sortedPatterns.map(p => p.observationCount));
                if (maxObs >= 2) return `Patterns at ${maxObs}/3 observations — ${3 - maxObs} more run${3 - maxObs === 1 ? '' : 's'} to auto-promote`;
                return `Run ${3 - maxObs} more time${3 - maxObs === 1 ? '' : 's'} to start auto-promoting patterns to deterministic rules`;
              })()}
            </p>
          </div>
        )}

        {/* Insights Feed */}
        {sortedPatterns.length > 0 && (
          <div className="mt-4">
            <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
              Learned Patterns
            </h4>
            <ScrollArea className="h-[160px]">
              <div className="space-y-2 pr-2">
                {sortedPatterns.map((pattern) => (
                  <div
                    key={pattern.fingerprint}
                    className="bg-slate-900/50 rounded-lg px-3 py-2 border border-slate-700/50"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
                        {pattern.description}
                      </p>
                      <div className="flex items-center gap-1 shrink-0">
                        <FrameworkBadge framework={pattern.framework} />
                        {pattern.promoted && (
                          <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                            <Zap className="h-2.5 w-2.5" />
                            RULE
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <ConfidenceBar confidence={pattern.confidence} />
                      <span className="text-[10px] text-slate-500 shrink-0 flex items-center gap-0.5">
                        <ChevronUp className="h-2.5 w-2.5" />
                        {pattern.observationCount}x
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Empty state insights placeholder */}
        {sortedPatterns.length === 0 && !isAnalyzing && (
          <div className="mt-4 text-center py-4">
            <p className="text-xs text-slate-500">
              {hasData ? 'No patterns detected yet' : 'Run analysis to start discovering compliance patterns'}
            </p>
          </div>
        )}

        {/* Analyzing shimmer placeholder */}
        {isAnalyzing && sortedPatterns.length === 0 && (
          <div className="mt-4 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded-lg bg-slate-700/30 overflow-hidden">
                <div className="h-full w-full bg-gradient-to-r from-slate-700/0 via-slate-600/20 to-slate-700/0 animate-shimmer" />
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
