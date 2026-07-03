'use client';

import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAnalysisStore } from '@/store/analysis-store';
import { useLearningStore } from '@/lib/learning/store';

/**
 * Stream status for the SSE fetch-based hook.
 * idle -> running -> complete | error
 * User can also abort() to return to idle.
 */
export type StreamStatus = 'idle' | 'running' | 'complete' | 'error';

/**
 * useAgentStream — client-side hook for consuming POST-based SSE from /api/analyze.
 *
 * Because /api/analyze is a POST endpoint (sends CALM JSON in the body),
 * the native EventSource API cannot be used (EventSource only supports GET).
 * This hook uses fetch() + ReadableStream reader instead.
 *
 * Features:
 * - Reads SSE stream with buffer-based `\n\n` frame splitting
 * - Dispatches AgentEvents to Zustand store via addAgentEvent
 * - Dispatches done results via setAnalysisResult
 * - Supports user-initiated abort via AbortController
 * - Auto-reconnects on network errors (NOT on HTTP errors or AbortError)
 *   with exponential backoff, max 3 attempts
 */
export function useAgentStream() {
  const [streamStatus, setStreamStatus] = useState<StreamStatus>('idle');

  const abortRef = useRef<AbortController | null>(null);
  const retryCountRef = useRef<number>(0);

  const { addAgentEvent, setAnalysisResult, startAnalysis, setStatus } =
    useAnalysisStore();

  const startStream = useCallback(
    async (calmData: unknown, selectedFrameworks?: string[], demoMode?: boolean): Promise<void> => {
      // Create a new abort controller for this stream session
      const controller = new AbortController();
      abortRef.current = controller;

      // Reset store state and set local status to running
      startAnalysis();
      setStreamStatus('running');

      // Read learning store state for deterministic pre-checks and prompt enrichment
      const learningState = useLearningStore.getState();
      const deterministicRules = learningState.deterministicRules;
      const learningContext = learningState.getLearningContext();

      try {
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            calm: calmData,
            frameworks: selectedFrameworks,
            demoMode,
            deterministicRules,
            learningContext,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          // HTTP error — read body for debug info, then fail without retry
          const errorBody = await response.text().catch(() => '');
          const errorMessage = `HTTP ${response.status}: ${errorBody || 'Analysis failed'}`;
          console.error(`[useAgentStream] ${errorMessage}`);
          setStreamStatus('error');
          setStatus('error');
          toast.error('Analysis failed', { description: errorMessage });
          return;
        }

        // Successful connection — reset retry counter
        retryCountRef.current = 0;

        if (!response.body) {
          const errorMessage = 'Response body is null — stream unavailable';
          console.error(`[useAgentStream] ${errorMessage}`);
          setStreamStatus('error');
          setStatus('error');
          toast.error('Analysis failed', { description: errorMessage });
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8'); // stream mode applied in decode() calls
        let buffer = '';

        // Read loop — processes the SSE stream chunk by chunk
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Split on SSE frame boundary (\n\n)
          const frames = buffer.split('\n\n');

          // Last element may be an incomplete frame — put it back in buffer
          buffer = frames.pop() ?? '';

          for (const frame of frames) {
            const trimmed = frame.trim();
            if (!trimmed.startsWith('data: ')) continue;

            const jsonString = trimmed.slice('data: '.length);
            try {
              const parsed = JSON.parse(jsonString) as Record<string, unknown>;

              if (parsed.type === 'done') {
                // Final event — contains AnalysisResult
                const result = parsed.result as Parameters<typeof setAnalysisResult>[0];
                setAnalysisResult(result);
                setStreamStatus('complete');

                // ── Oracle Post-Analysis Learning ──────────────────
                // Record analysis in learning store and emit visible
                // agent events so Oracle's learning appears in the feed.
                const currentInput = useAnalysisStore.getState().analysisInput;
                if (currentInput) {
                  const oracleAgent = {
                    name: 'learning-engine',
                    displayName: 'Learning Engine',
                    icon: 'brain',
                    color: 'cyan',
                  };

                  // Snapshot metrics before learning
                  const metricsBefore = useLearningStore.getState().getMetrics();

                  const oracleEvent = (e: Omit<Parameters<typeof addAgentEvent>[0], 'timestamp'>) =>
                    addAgentEvent({ ...e, timestamp: new Date().toISOString() });

                  oracleEvent({
                    type: 'started',
                    agent: oracleAgent,
                    message: 'Oracle analyzing results — extracting compliance patterns...',
                  });

                  // Small delay so judges see Oracle appear in the feed
                  await new Promise<void>((r) => setTimeout(r, 1200));

                  // Actually record the analysis (extracts patterns, auto-promotes)
                  useLearningStore.getState().recordAnalysis(
                    result,
                    currentInput,
                    deterministicRules.length,
                  );

                  // Snapshot metrics after learning
                  const metricsAfter = useLearningStore.getState().getMetrics();
                  const newPatterns = metricsAfter.totalPatterns - metricsBefore.totalPatterns;
                  const newRules = metricsAfter.promotedCount - metricsBefore.promotedCount;

                  // Emit thinking event with what was learned
                  oracleEvent({
                    type: 'thinking',
                    agent: oracleAgent,
                    message: newPatterns > 0
                      ? `Extracted ${newPatterns} new pattern${newPatterns === 1 ? '' : 's'} from analysis results`
                      : `Reinforced ${metricsAfter.totalPatterns} existing patterns — confidence updated`,
                  });

                  await new Promise<void>((r) => setTimeout(r, 800));

                  // Emit promotion event if rules were auto-promoted
                  if (newRules > 0) {
                    oracleEvent({
                      type: 'finding',
                      agent: oracleAgent,
                      message: `Auto-promoted ${newRules} pattern${newRules === 1 ? '' : 's'} to deterministic rule${newRules === 1 ? '' : 's'} (75%+ confidence, 3+ observations)`,
                      severity: 'info',
                    });
                    await new Promise<void>((r) => setTimeout(r, 600));
                  }

                  // Emit completed event
                  oracleEvent({
                    type: 'completed',
                    agent: oracleAgent,
                    message: `Learning complete — ${metricsAfter.totalPatterns} patterns, ${metricsAfter.promotedCount} rules, intelligence ${metricsAfter.intelligenceScore}/100`,
                  });
                }
              } else if (parsed.type === 'error') {
                // Agent-level error event from the server
                setStatus('error');
                setStreamStatus('error');
              } else {
                // Regular AgentEvent (started, thinking, finding, completed)
                // Cast through unknown because JSON.parse returns Record<string, unknown>
                // but the server guarantees the shape matches AgentEvent
                addAgentEvent(
                  parsed as unknown as Parameters<typeof addAgentEvent>[0],
                );
              }
            } catch (parseErr) {
              console.warn('[useAgentStream] Failed to parse SSE frame:', jsonString, parseErr);
            }
          }
        }

        // Flush any remaining decoder bytes
        const remaining = decoder.decode();
        if (remaining.trim().startsWith('data: ')) {
          try {
            const jsonString = remaining.trim().slice('data: '.length);
            const parsed = JSON.parse(jsonString) as Record<string, unknown>;
            if (parsed.type === 'done') {
              setAnalysisResult(
                parsed.result as Parameters<typeof setAnalysisResult>[0],
              );
              setStreamStatus('complete');
            }
          } catch {
            // Ignore malformed trailing frame
          }
        }

        // Stream ended cleanly — mark complete if still in running state
        setStreamStatus((prev) => (prev === 'running' ? 'complete' : prev));
      } catch (err) {
        const error = err as Error;

        // AbortError = user-initiated abort — never retry, just reset to idle
        if (error.name === 'AbortError') {
          return; // abort() already set streamStatus to 'idle'
        }

        // Network/fetch failure — eligible for auto-reconnect
        if (retryCountRef.current < 3) {
          retryCountRef.current += 1;
          const backoffMs = 1000 * 2 ** retryCountRef.current;
          console.warn(
            '[useAgentStream] Network error, retrying in %dms (attempt %d/3)',
            backoffMs,
            retryCountRef.current,
            error,
          );
          await new Promise<void>((resolve) => setTimeout(resolve, backoffMs));
          // Recurse — each retry creates a new AbortController inside startStream
          await startStream(calmData, selectedFrameworks, demoMode);
          return;
        }

        // Exhausted retries
        const errorMessage = error.message || 'Network error after 3 retries';
        console.error('[useAgentStream] Max retries reached. Giving up.', error);
        setStreamStatus('error');
        setStatus('error');
        toast.error('Analysis failed', { description: errorMessage });
      }
    },
    // Stable deps: store actions are stable references from Zustand
    [addAgentEvent, setAnalysisResult, startAnalysis, setStatus],
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
    retryCountRef.current = 0;
    setStreamStatus('idle');
  }, []);

  return { startStream, abort, streamStatus };
}
