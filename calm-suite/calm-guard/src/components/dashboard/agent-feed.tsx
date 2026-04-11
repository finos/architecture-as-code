'use client';

import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAnalysisStore } from '@/store/analysis-store';
import { AgentFeedEvent } from './agent-feed-event';

// ---------------------------------------------------------------------------
// Live indicator — green pulsing dot when agents are actively analyzing
// ---------------------------------------------------------------------------
function LiveIndicator({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <span className="relative flex h-2 w-2" aria-label="Live">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Empty state variants
// ---------------------------------------------------------------------------
function EmptyStateIdle() {
  return (
    <div className="flex h-full items-center justify-center py-12">
      <p className="text-sm text-slate-500 italic text-center px-4">
        Agent events will appear here during analysis
      </p>
    </div>
  );
}

function EmptyStateAnalyzing() {
  return (
    <div className="flex h-full items-center justify-center py-12">
      <p className="text-sm text-slate-400 italic animate-pulse text-center px-4">
        Waiting for agent events...
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AgentFeed
// ---------------------------------------------------------------------------
export function AgentFeed() {
  const agentEvents = useAnalysisStore((state) => state.agentEvents);
  const status = useAnalysisStore((state) => state.status);

  // Ref to the invisible sentinel div at the bottom of the list
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the latest event whenever a new one arrives
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [agentEvents.length]);

  const isAnalyzing = status === 'analyzing';
  const hasEvents = agentEvents.length > 0;

  return (
    <Card className="bg-slate-800 border-slate-700 flex flex-col h-full">
      {/* Card header */}
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-semibold text-slate-200">
              Agent Activity
            </CardTitle>
            <LiveIndicator active={isAnalyzing} />
          </div>

          {hasEvents && (
            <Badge
              variant="secondary"
              className="text-xs bg-slate-700 text-slate-400 border-slate-600"
            >
              {agentEvents.length} {agentEvents.length === 1 ? 'event' : 'events'}
            </Badge>
          )}
        </div>
      </CardHeader>

      {/* Card body */}
      <CardContent className="flex-1 p-0 min-h-0">
        <ScrollArea className="h-full">
          {!hasEvents && isAnalyzing && <EmptyStateAnalyzing />}
          {!hasEvents && !isAnalyzing && <EmptyStateIdle />}

          {hasEvents && (
            <div className="py-1">
              {agentEvents.map((event, i) => (
                <AgentFeedEvent key={i} event={event} index={i} />
              ))}
              {/* Sentinel for auto-scroll */}
              <div ref={bottomRef} />
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
