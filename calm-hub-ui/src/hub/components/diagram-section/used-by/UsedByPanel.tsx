import type { ImplementationsState } from './usePatternImplementations.js';
import { UsedByHeading, UsedByList } from './UsedByList.js';

function message(state: Exclude<ImplementationsState, { status: 'loaded' }>): string {
    switch (state.status) {
        case 'idle':
        case 'loading':
            return 'Loading…';
        case 'error':
            return 'Could not load the architectures that use this version.';
        case 'unavailable':
            return 'Not available for this pattern.';
    }
}

export function UsedByPanel({ state }: { state: ImplementationsState }) {
    if (state.status === 'loaded' && state.implementations.length > 0) {
        return <UsedByList implementations={state.implementations} />;
    }
    return (
        <div className="h-full bg-base-100">
            <div className="px-6 py-3 border-b border-base-300">
                <UsedByHeading />
            </div>
            {state.status === 'loaded' ? (
                <p className="px-6 py-4 text-base-content/70">
                    No architectures use this version. An architecture appears here when its <code>$schema</code> names this
                    pattern version.
                </p>
            ) : (
                <p className="px-6 py-4 text-base-content/70">{message(state)}</p>
            )}
        </div>
    );
}
