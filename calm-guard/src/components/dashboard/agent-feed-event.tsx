'use client';

import {
  Search,
  Shield,
  GitBranch,
  BarChart3,
  Layers,
  Activity,
  Play,
  CheckCircle,
  ScanEye,
  ShieldCheck,
  Wrench,
  Crosshair,
  Brain,
  type LucideIcon,
} from 'lucide-react';
import type { AgentEvent, Severity } from '@/lib/agents/types';
import { AGENT_BOT_PERSONAS, useAnalysisStore } from '@/store/analysis-store';

// ---------------------------------------------------------------------------
// Icon registry — maps agent.icon field to Lucide component
// ---------------------------------------------------------------------------
const ICON_MAP: Record<string, LucideIcon> = {
  search: Search,
  shield: Shield,
  'git-branch': GitBranch,
  'bar-chart': BarChart3,
  layers: Layers,
  network: ScanEye,
  'scan-eye': ScanEye,
  'shield-check': ShieldCheck,
  wrench: Wrench,
  crosshair: Crosshair,
  brain: Brain,
};

function resolveIcon(iconName: string): LucideIcon {
  return ICON_MAP[iconName] ?? Activity;
}

// ---------------------------------------------------------------------------
// Severity badge styling
// ---------------------------------------------------------------------------
const SEVERITY_STYLES: Record<Severity, string> = {
  critical: 'bg-red-500/20 text-red-400 border border-red-500/50',
  high: 'bg-orange-500/20 text-orange-400 border border-orange-500/50',
  medium: 'bg-amber-500/20 text-amber-400 border border-amber-500/50',
  low: 'bg-blue-500/20 text-blue-400 border border-blue-500/50',
  info: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50',
};

// ---------------------------------------------------------------------------
// Timestamp formatter — ISO 8601 → HH:MM:SS
// ---------------------------------------------------------------------------
function formatTime(isoTimestamp: string): string {
  try {
    const date = new Date(isoTimestamp);
    return date.toTimeString().slice(0, 8); // "HH:MM:SS"
  } catch {
    return '--:--:--';
  }
}

// ---------------------------------------------------------------------------
// AgentFeedEvent props
// ---------------------------------------------------------------------------
export interface AgentFeedEventProps {
  event: AgentEvent;
  /** Position index in the feed list — used for staggered animation delay */
  index: number;
}

// ---------------------------------------------------------------------------
// AgentFeedEvent component
// ---------------------------------------------------------------------------
export function AgentFeedEvent({ event, index }: AgentFeedEventProps) {
  const demoMode = useAnalysisStore((state) => state.demoMode);
  const persona = AGENT_BOT_PERSONAS[event.agent.name];
  const IconComponent = persona
    ? (ICON_MAP[persona.icon] ?? resolveIcon(event.agent.icon))
    : resolveIcon(event.agent.icon);
  const agentColor = persona?.color ?? event.agent.color;
  const displayName = persona?.botName ?? event.agent.displayName;

  // Cap stagger delay so old events don't wait forever
  const animationDelay = `${Math.min(index * 50, 500)}ms`;

  // Demo mode: highlight critical/high findings with a glow and KEY FINDING badge
  const isKeyFinding =
    demoMode &&
    event.type === 'finding' &&
    (event.severity === 'critical' || event.severity === 'high');

  // Deterministic findings from Oracle's learned rules
  const isDeterministic =
    event.type === 'finding' &&
    (event.data as Record<string, unknown> | undefined)?.deterministic === true;

  // Event-type-specific row background
  const rowBg = event.type === 'error'
    ? 'bg-red-500/5'
    : isDeterministic
    ? 'ring-1 ring-cyan-500/30 bg-cyan-500/5'
    : isKeyFinding
    ? 'ring-1 ring-amber-500/30 bg-amber-500/5'
    : '';

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-lg animate-slide-in-right ${rowBg}`}
      style={{ animationDelay }}
    >
      {/* Bot avatar */}
      <div
        className="mt-0.5 shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-slate-800 ring-1 ring-slate-700"
      >
        <IconComponent
          className="h-3.5 w-3.5"
          style={{ color: agentColor }}
          aria-hidden="true"
        />
      </div>

      {/* Middle column: header + message */}
      <div className="flex-1 min-w-0">
        {/* Header row: bot name + timestamp */}
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className="text-xs font-semibold text-slate-200 truncate">
            {displayName}
          </span>
          <span className="text-xs text-slate-500 shrink-0 font-mono">
            {formatTime(event.timestamp)}
          </span>
        </div>

        {/* Message row */}
        <div className="flex items-center gap-2">
          {event.type === 'started' && (
            <Play className="h-3 w-3 text-slate-500 shrink-0" aria-hidden="true" />
          )}
          {event.type === 'completed' && (
            <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0" aria-hidden="true" />
          )}

          <span className="text-xs text-slate-400 leading-relaxed">
            {event.message ?? ''}
            {event.type === 'thinking' && (
              <span className="animate-pulse ml-1 text-slate-500">...</span>
            )}
          </span>
        </div>
      </div>

      {/* Right: severity badge + KEY FINDING badge (only for finding events with severity) */}
      {event.type === 'finding' && event.severity && (
        <div className="shrink-0 mt-0.5 flex flex-col items-end gap-1">
          <span
            className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${SEVERITY_STYLES[event.severity]}`}
          >
            {event.severity}
          </span>
          {isDeterministic && (
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
              LEARNED
            </span>
          )}
          {isKeyFinding && (
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
              KEY FINDING
            </span>
          )}
        </div>
      )}
    </div>
  );
}
