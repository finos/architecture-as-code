import type { AgentEvent } from '@/lib/agents/types';

/**
 * AgentEventEmitter
 *
 * Edge Runtime compatible event emitter for agent SSE streaming.
 * Uses simple listener pattern instead of Node.js EventEmitter to work in Vercel serverless.
 */

declare global {
  var __agentEventEmitter: AgentEventEmitter | undefined;
}

class AgentEventEmitter {
  private listeners: Set<(event: AgentEvent) => void> = new Set();

  /**
   * Subscribe to agent events
   * @param listener - Callback invoked on each event
   * @returns Unsubscribe function
   */
  subscribe(listener: (event: AgentEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Emit an agent event to all subscribers
   * @param event - The agent event to emit
   */
  emit(event: AgentEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error('[AgentEventEmitter] Listener error:', error);
      }
    });
  }

  /**
   * Get current listener count (for debugging)
   */
  get listenerCount(): number {
    return this.listeners.size;
  }
}

/**
 * Global singleton event emitter
 * All agents use this to emit progress events during execution.
 * Uses globalThis pattern to survive Next.js webpack hot reloads in dev mode.
 */
export const agentEventEmitter: AgentEventEmitter =
  globalThis.__agentEventEmitter ??
  (globalThis.__agentEventEmitter = new AgentEventEmitter());

/**
 * Helper to emit agent event with auto-timestamping
 * @param event - Event without timestamp (will be added automatically)
 */
export function emitAgentEvent(event: Omit<AgentEvent, 'timestamp'>): void {
  agentEventEmitter.emit({
    ...event,
    timestamp: new Date().toISOString(),
  });
}
