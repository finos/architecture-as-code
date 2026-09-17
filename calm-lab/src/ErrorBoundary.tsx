/**
 * The lab renders the learner's editor buffer live — a half-typed document can
 * reach a third-party renderer (ReactFlow) and throw during its own state
 * update, outside any try/catch of ours. A boundary is the only way to keep the
 * rest of the lab, and the learner's work, on screen when that happens.
 *
 * Remount the boundary (a `key` that changes with the input) to retry.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps { fallback: ReactNode; children: ReactNode }
interface ErrorBoundaryState { hasError: boolean }

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = { hasError: false };

    static getDerivedStateFromError(): ErrorBoundaryState {
        return { hasError: true };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        console.error('CALM lab: render error', error, info.componentStack);
    }

    render(): ReactNode {
        return this.state.hasError ? this.props.fallback : this.props.children;
    }
}
