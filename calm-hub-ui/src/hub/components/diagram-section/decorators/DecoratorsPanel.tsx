import { useMemo } from 'react';
import { DecoratorCard, decoratorKeys, decoratorTypeLabel } from '../../../../decorator-renderer/index.js';
import type { ArchitectureDecoratorsState } from './useArchitectureDecorators.js';

interface DecoratorsPanelProps {
    state: ArchitectureDecoratorsState;
    /** Null shows every type. */
    typeFilter: string | null;
    onTypeFilterChange: (type: string | null) => void;
}

function Message({ children }: { children: string }) {
    return <p className="text-sm text-base-content/60 text-center py-8">{children}</p>;
}

export function DecoratorsPanel({ state, typeFilter, onTypeFilterChange }: DecoratorsPanelProps) {
    const decorators = useMemo(() => (state.status === 'loaded' ? state.decorators : []), [state]);
    const typeCounts = useMemo(() => {
        const counts = new Map<string, number>();
        for (const decorator of decorators) {
            const type = decoratorTypeLabel(decorator.type);
            counts.set(type, (counts.get(type) ?? 0) + 1);
        }
        // A type from a link stays selectable, so the filter shows what it hides.
        if (typeFilter !== null && !counts.has(typeFilter)) counts.set(typeFilter, 0);
        return [...counts].sort(([a], [b]) => a.localeCompare(b));
    }, [decorators, typeFilter]);
    const shown = typeFilter === null ? decorators : decorators.filter((decorator) => decoratorTypeLabel(decorator.type) === typeFilter);

    let body;
    if (state.status === 'loading') {
        body = <Message>Loading decorators…</Message>;
    } else if (state.status === 'error' && state.reason === 'unmapped') {
        body = <Message>CALM Hub has no id for this architecture, so it cannot find its decorators.</Message>;
    } else if (state.status === 'error') {
        body = <Message>Could not load decorators. CALM Hub did not answer; the page tries again.</Message>;
    } else if (decorators.length === 0) {
        body = <Message>No decorators for this architecture version.</Message>;
    } else if (shown.length === 0) {
        body = <Message>{`No decorators of type ${typeFilter}.`}</Message>;
    } else {
        const keys = decoratorKeys(shown);
        body = (
            <div className="flex flex-col gap-3">
                {shown.map((decorator, index) => (
                    <DecoratorCard key={keys[index]} decorator={decorator} />
                ))}
            </div>
        );
    }

    return (
        <div className="h-full bg-base-200 overflow-auto p-4 flex flex-col gap-3">
            {state.status === 'loaded' && decorators.length > 0 && (
                <label className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-base-content/70">Type</span>
                    <select
                        className="select select-sm w-full sm:w-auto"
                        value={typeFilter ?? ''}
                        onChange={(e) => onTypeFilterChange(e.target.value || null)}
                    >
                        <option value="">All types ({decorators.length})</option>
                        {typeCounts.map(([type, count]) => (
                            <option key={type} value={type}>
                                {type} ({count})
                            </option>
                        ))}
                    </select>
                </label>
            )}
            {body}
        </div>
    );
}
