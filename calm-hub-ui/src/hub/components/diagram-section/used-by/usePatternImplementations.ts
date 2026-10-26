import { useEffect, useState } from 'react';
import type { PatternImplementation } from '../../../../model/pattern-implementation.js';
import type { PatternImplementationService } from '../../../../service/pattern-implementation-service.js';

/**
 * `idle` means nobody has asked yet. `unavailable` covers a pattern with no name to ask by
 * (written through the numeric API) and a hub that does not support the lookup (GitHub storage mode).
 */
export type ImplementationsState =
    | { status: 'idle' }
    | { status: 'unavailable' }
    | { status: 'loading' }
    | { status: 'error' }
    | { status: 'loaded'; implementations: PatternImplementation[] };

const IDLE: ImplementationsState = { status: 'idle' };
const LOADING: ImplementationsState = { status: 'loading' };

/**
 * The lookup scans every architecture version the caller can read, so it waits until `requested`.
 * The response stays until the pattern or version changes, and a return to a version asks again.
 * An error does not stay, so the next time the tab opens it asks again.
 */
export function usePatternImplementations(
    service: PatternImplementationService,
    namespace: string,
    patternName: string | undefined,
    version: string,
    requested: boolean
): ImplementationsState {
    const key = `${namespace}/${patternName}/${version}`;
    const [lookup, setLookup] = useState<{ key: string; state: ImplementationsState }>({ key, state: IDLE });
    let current = lookup;
    if (lookup.key !== key || (!requested && lookup.state.status === 'error')) {
        current = { key, state: IDLE };
    }
    if (requested && patternName !== undefined && current.state === IDLE) {
        current = { key, state: LOADING };
    }
    if (current !== lookup) setLookup(current);
    const loading = current.state === LOADING;

    useEffect(() => {
        if (!loading || patternName === undefined) return;
        service
            .fetchImplementations(namespace, patternName, version)
            .then((implementations): ImplementationsState =>
                implementations ? { status: 'loaded', implementations } : { status: 'unavailable' }
            )
            .catch((): ImplementationsState => ({ status: 'error' }))
            .then((state) => setLookup((latest) => (latest.key === key ? { key, state } : latest)));
    }, [loading, service, namespace, patternName, version, key]);

    if (patternName === undefined) return { status: 'unavailable' };
    return current.state;
}
