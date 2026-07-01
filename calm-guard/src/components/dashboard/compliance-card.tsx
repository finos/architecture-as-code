'use client';

import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { OdometerScore } from '@/components/ui/odometer-score';
import { useAnalysisStore } from '@/store/analysis-store';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RADIUS = 56;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const CENTER = 64; // viewBox is 128x128

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getGaugeColor(score: number): string {
  if (score < 40) return '#ef4444'; // red-500
  if (score < 70) return '#f59e0b'; // amber-500
  return '#10b981'; // emerald-500
}

function getBarColorClass(score: number): string {
  if (score < 40) return 'bg-red-500';
  if (score < 70) return 'bg-amber-500';
  return 'bg-emerald-500';
}

// ---------------------------------------------------------------------------
// useCountUp hook
// ---------------------------------------------------------------------------

function useCountUp(targetScore: number, duration: number = 1200): number {
  const [displayScore, setDisplayScore] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (targetScore <= 0) {
      setDisplayScore(0);
      return;
    }

    // Cancel any in-progress animation
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }

    const startTime = performance.now();

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic: starts fast, decelerates to target
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(targetScore * eased));

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
  }, [targetScore, duration]);

  return displayScore;
}

// ---------------------------------------------------------------------------
// SVG Gauge
// ---------------------------------------------------------------------------

interface GaugeProps {
  displayScore: number;
  hasData: boolean;
}

function ComplianceGauge({ displayScore, hasData }: GaugeProps) {
  const color = getGaugeColor(displayScore);
  const strokeDashoffset = CIRCUMFERENCE * (1 - displayScore / 100);

  if (!hasData) {
    // Empty state: dashed ring outline, no foreground arc
    return (
      <svg width={128} height={128} viewBox="0 0 128 128" aria-label="No compliance data yet">
        {/* Dashed background ring */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={8}
          strokeDasharray="4 4"
          className="text-slate-700"
        />
        {/* Placeholder text */}
        <text
          x={CENTER}
          y={CENTER - 6}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={10}
          fill="#64748b"
        >
          Run analysis
        </text>
        <text
          x={CENTER}
          y={CENTER + 10}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={10}
          fill="#64748b"
        >
          to see score
        </text>
      </svg>
    );
  }

  return (
    <svg width={128} height={128} viewBox="0 0 128 128" aria-label={`Compliance score: ${displayScore} out of 100`}>
      {/* Background track — full circle */}
      <circle
        cx={CENTER}
        cy={CENTER}
        r={RADIUS}
        fill="none"
        stroke="currentColor"
        strokeWidth={8}
        className="text-slate-700"
      />

      {/* Foreground arc — rotated to start at 12 o'clock */}
      <circle
        cx={CENTER}
        cy={CENTER}
        r={RADIUS}
        fill="none"
        stroke={color}
        strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={strokeDashoffset}
        transform={`rotate(-90 ${CENTER} ${CENTER})`}
        style={{ transition: 'stroke-dashoffset 0.1s linear, stroke 0.3s ease' }}
      />

      {/* Score — OdometerScore embedded via foreignObject for CSS animation inside SVG */}
      <foreignObject x={CENTER - 30} y={CENTER - 22} width={60} height={36}>
        <div
          style={{ color }}
          className="flex items-center justify-center h-full text-2xl font-bold"
        >
          <OdometerScore score={displayScore} />
        </div>
      </foreignObject>

      {/* Subtitle */}
      <text
        x={CENTER}
        y={CENTER + 16}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={11}
        fill="#94a3b8"
      >
        / 100
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Framework Bars
// ---------------------------------------------------------------------------

interface FrameworkScore {
  framework: string;
  score: number;
  rating: string;
}

interface FrameworkBarsProps {
  scores: FrameworkScore[];
}

function FrameworkBars({ scores }: FrameworkBarsProps) {
  if (scores.length === 0) {
    // Empty-state placeholder bars
    return (
      <div className="space-y-3">
        {['SOX', 'PCI-DSS', 'NIST-CSF', 'FINOS-CCC'].map((label) => (
          <div key={label}>
            <div className="flex justify-between mb-1">
              <span className="text-sm text-slate-500">{label}</span>
              <span className="text-sm text-slate-600">—</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-700/50" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {scores.map(({ framework, score }) => {
        const colorClass = getBarColorClass(score);
        const displayLabel = framework === 'CCC' ? 'FINOS-CCC' : framework;
        return (
          <div key={framework}>
            <div className="flex justify-between mb-1">
              <span className="text-sm text-slate-300">{displayLabel}</span>
              <span className="text-sm text-slate-400">{score}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-700">
              <div
                className={`h-1.5 rounded-full ${colorClass} transition-all duration-1000 ease-out`}
                style={{ width: `${score}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ComplianceCard — main export
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Analyzing state — pulsing gauge with progress text
// ---------------------------------------------------------------------------

function AnalyzingGauge() {
  return (
    <svg width={128} height={128} viewBox="0 0 128 128" aria-label="Analysis in progress">
      <defs>
        {/* Gradient for the pulsing ring */}
        <linearGradient id="analyzing-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.6" />
          <stop offset="50%" stopColor="#60a5fa" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.6" />
        </linearGradient>
      </defs>

      {/* Background track */}
      <circle
        cx={CENTER}
        cy={CENTER}
        r={RADIUS}
        fill="none"
        stroke="currentColor"
        strokeWidth={8}
        className="text-slate-700"
      />

      {/* Pulsing full ring with gradient — breathes in and out */}
      <circle
        cx={CENTER}
        cy={CENTER}
        r={RADIUS}
        fill="none"
        stroke="url(#analyzing-gradient)"
        strokeWidth={8}
        className="animate-gauge-pulse"
      />

      {/* Subtle inner glow ring */}
      <circle
        cx={CENTER}
        cy={CENTER}
        r={RADIUS - 12}
        fill="none"
        stroke="#3b82f6"
        strokeWidth={1}
        opacity={0.15}
        className="animate-gauge-pulse"
      />

      {/* Center text */}
      <text
        x={CENTER}
        y={CENTER - 4}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={11}
        fontWeight="600"
        fill="#60a5fa"
        className="animate-gauge-pulse"
      >
        Analyzing
      </text>
      <text
        x={CENTER}
        y={CENTER + 12}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={9}
        fill="#64748b"
      >
        Please wait...
      </text>
    </svg>
  );
}

function AnalyzingBars() {
  return (
    <div className="space-y-3">
      {['SOX', 'PCI-DSS', 'NIST-CSF', 'FINOS-CCC'].map((label) => (
        <div key={label}>
          <div className="flex justify-between mb-1">
            <span className="text-sm text-slate-500">{label}</span>
            <span className="text-sm text-slate-600 animate-pulse">...</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-700/50 overflow-hidden">
            <div className="h-full w-full bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700 animate-shimmer rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ComplianceCard() {
  const riskData = useAnalysisStore((state) => state.analysisResult?.risk ?? null);
  const status = useAnalysisStore((state) => state.status);

  const overallScore = riskData?.overallScore ?? 0;
  const displayScore = useCountUp(overallScore);
  const hasData = riskData !== null;
  const isAnalyzing = status === 'analyzing';

  return (
    <Card className="bg-slate-800 border-slate-700">
      <div className="p-6">
        <h3 className="text-sm font-medium text-slate-400 mb-4">Compliance Score</h3>

        {/* SVG Gauge */}
        <div className="flex justify-center mb-6">
          {isAnalyzing && !hasData ? (
            <AnalyzingGauge />
          ) : (
            <ComplianceGauge displayScore={displayScore} hasData={hasData} />
          )}
        </div>

        {/* Overall rating — only when data exists */}
        {riskData && (
          <p className="text-center text-sm text-slate-400 mb-6">
            Rating:{' '}
            <span className="font-medium text-slate-200 capitalize">{riskData.overallRating}</span>
          </p>
        )}

        {/* Per-framework breakdown bars */}
        {isAnalyzing && !hasData ? (
          <AnalyzingBars />
        ) : (
          <FrameworkBars scores={riskData?.frameworkScores ?? []} />
        )}
      </div>
    </Card>
  );
}
