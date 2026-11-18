import { Component, ReactNode } from 'react';
import { RetryAlert } from './RetryAlert.js';

const CANNOT_SHOW = 'This extension sent content that CALM Hub cannot show.';

interface ScreenErrorBoundaryProps {
    children: ReactNode;
    frame?: (content: ReactNode) => ReactNode;
    /** A new value clears a failure, so that content for another context can show. */
    resetKey?: string;
    /** Show Try again, which clears the failure. Use it only where the children load their content again on mount. */
    retry?: boolean;
}

/** Bad data from an extension must not break the Hub page around it. */
export class ScreenErrorBoundary extends Component<ScreenErrorBoundaryProps, { failed: boolean; resetKey?: string }> {
    state = { failed: false, resetKey: this.props.resetKey };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    static getDerivedStateFromProps(props: ScreenErrorBoundaryProps, state: { failed: boolean; resetKey?: string }) {
        return props.resetKey === state.resetKey ? null : { failed: false, resetKey: props.resetKey };
    }

    componentDidCatch(error: unknown) {
        console.error('%s', 'Extension screen failed to render:', error);
    }

    render() {
        if (this.state.failed) {
            const alert = this.props.retry ? (
                <RetryAlert message={CANNOT_SHOW} retrying={false} onRetry={() => this.setState({ failed: false })} />
            ) : (
                <div role="alert" className="alert alert-error alert-soft">
                    <span>{CANNOT_SHOW}</span>
                </div>
            );
            return this.props.frame ? this.props.frame(alert) : alert;
        }
        return this.props.children;
    }
}
