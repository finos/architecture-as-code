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
    if (lookup.key !== key) {
        setLookup({ key, state: IDLE });
    }
    const start = requested && patternName !== undefined && lookup.key === key && lookup.state === IDLE;

    useEffect(() => {
        if (!start || patternName === undefined) return;
        setLookup({ key, state: LOADING });
        service
            .fetchImplementations(namespace, patternName, version)
            .then((implementations): ImplementationsState =>
                implementations ? { status: 'loaded', implementations } : { status: 'unavailable' }
            )
            .catch((): ImplementationsState => ({ status: 'error' }))
            .then((state) => setLookup((current) => (current.key === key ? { key, state } : current)));
    }, [start, service, namespace, patternName, version, key]);

    if (patternName === undefined) return { status: 'unavailable' };
    return start ? LOADING : lookup.state;
}
