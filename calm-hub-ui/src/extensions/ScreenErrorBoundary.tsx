import { Component, ReactNode } from 'react';

interface ScreenErrorBoundaryProps {
    children: ReactNode;
    frame?: (content: ReactNode) => ReactNode;
    /** A new value clears a failure, so that content for another context can show. */
    resetKey?: string;
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
            const alert = (
                <div role="alert" className="alert alert-error alert-soft">
                    <span>This extension sent content that CALM Hub cannot show.</span>
                </div>
            );
            return this.props.frame ? this.props.frame(alert) : alert;
        }
        return this.props.children;
    }
}
