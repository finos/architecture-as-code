import { Component, ReactNode } from 'react';

/** Bad data from an extension must not break the Hub page around it. */
export class ScreenErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    componentDidCatch(error: unknown) {
        console.error('%s', 'Extension screen failed to render:', error);
    }

    render() {
        if (this.state.failed) {
            return (
                <div role="alert" className="alert alert-error alert-soft">
                    <span>This extension sent content that CALM Hub cannot show.</span>
                </div>
            );
        }
        return this.props.children;
    }
}
