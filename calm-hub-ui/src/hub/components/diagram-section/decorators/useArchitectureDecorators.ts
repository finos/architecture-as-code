import { useEffect, useRef, useState } from 'react';
import type { Data } from '../../../../model/calm.js';
import type { CalmService } from '../../../../service/calm-service.js';
import type { Decorator } from '../../../../visualizer/contracts/contracts.js';

/** `unmapped`: Hub answered, but its mappings do not list the slug, so there is no target to look up. */
export type DecoratorsErrorReason = 'unavailable' | 'unmapped';

export type ArchitectureDecoratorsState =
    | { status: 'loading' }
    | { status: 'error'; reason: DecoratorsErrorReason }
    | { status: 'loaded'; decorators: Decorator[] };

export const DECORATOR_REFRESH_MS = 5000;
/** After this many failed refreshes in a row, refresh every DECORATOR_BACKOFF_MS until one succeeds. */
const DECORATOR_FAILURES_BEFORE_BACKOFF = 3;
const DECORATOR_BACKOFF_MS = 30000;

const LOADING: ArchitectureDecoratorsState = { status: 'loading' };
const UNAVAILABLE: ArchitectureDecoratorsState = { status: 'error', reason: 'unavailable' };
const UNMAPPED: ArchitectureDecoratorsState = { status: 'error', reason: 'unmapped' };

class UnmappedArchitectureError extends Error {}
const NONE: ArchitectureDecoratorsState = { status: 'loaded', decorators: [] };

/**
 * All decorators of one architecture version, of every type. A pattern has none. This is the one source for the
 * diagram overlays, the Decorators tab and the details drawer, so they always show the same list.
 *
 * They change while the diagram is open (a merge gateway records each decision), so they are re-read every few
 * seconds while `active` (something on screen shows them). State changes only when the list does, so an unchanged refresh
 * does not re-render the diagram. A failed refresh keeps what was last shown; a hidden browser tab is not polled, nor is
 * an inactive one, which loads at once when it becomes active again unless it is backing off. The result is kept with
 * the `data` it was fetched for, so another resource or version never shows it.
 */
export function useArchitectureDecorators(
    service: CalmService,
    data: Data,
    isArchitecture: boolean,
    active = true,
): ArchitectureDecoratorsState {
    const [loaded, setLoaded] = useState<{ source: Data; state: ArchitectureDecoratorsState } | null>(null);
    // Kept out of the polling effect, so a change of tab keeps the resolved slug and the backoff.
    const activeRef = useRef(active);
    const loadNow = useRef<(() => void) | null>(null);
    useEffect(() => {
        activeRef.current = active;
        if (active) loadNow.current?.();
    }, [active]);

    useEffect(() => {
        if (!isArchitecture) return;
        const { name, id, version } = data;
        let cancelled = false;
        // Polls can overlap on a slow network; a response older than one already applied is dropped.
        let requested = 0;
        let applied = 0;
        // A slug is resolved to the version's target once, not on every poll. A failed or unresolved lookup is retried.
        let target: Promise<string | undefined> | undefined;
        let failures = 0;
        let ticksToSkip = 0;

        const update = (seq: number, decorators: Decorator[]) => {
            if (cancelled || seq < applied) return;
            applied = seq;
            failures = 0;
            ticksToSkip = 0;
            setLoaded((prev) =>
                prev?.source === data && prev.state.status === 'loaded'
                    && JSON.stringify(prev.state.decorators) === JSON.stringify(decorators)
                    ? prev
                    : { source: data, state: { status: 'loaded', decorators } }
            );
        };
        const fail = (seq: number, error: unknown) => {
            if (cancelled || seq < applied) return;
            failures += 1;
            if (failures === 1) {
                console.error('%s', `Could not refresh decorators for ${name}/${id}/${version}:`, error);
            }
            if (failures >= DECORATOR_FAILURES_BEFORE_BACKOFF) {
                ticksToSkip = DECORATOR_BACKOFF_MS / DECORATOR_REFRESH_MS - 1;
            }
            const state = error instanceof UnmappedArchitectureError ? UNMAPPED : UNAVAILABLE;
            setLoaded((prev) => (prev?.source === data && (prev.state.status === 'loaded' || prev.state === state) ? prev : { source: data, state }));
        };
        const resolveTarget = async () => {
            const lookup = (target ??= service.resolveArchitectureVersionTarget(name, id, version));
            const forget = () => {
                if (target === lookup) target = undefined;
            };
            const resolved = await lookup.catch((error: unknown) => {
                forget();
                throw error;
            });
            if (!resolved) {
                forget();
                throw new UnmappedArchitectureError(`Hub has no mapping for architecture ${id}`);
            }
            return resolved;
        };
        const load = () => {
            if (document.visibilityState === 'hidden' || !activeRef.current) return;
            const seq = ++requested;
            resolveTarget()
                .then((resolved) => service.fetchDecoratorsForTarget(name, resolved))
                .then((decorators) => update(seq, decorators))
                .catch((error) => fail(seq, error));
        };
        const tick = () => {
            if (ticksToSkip > 0) {
                ticksToSkip -= 1;
                return;
            }
            load();
        };
        // A return to the tab or the view waits out a backoff, so each return does not send a request to a Hub that is down.
        const resume = () => {
            if (ticksToSkip === 0) load();
        };
        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') resume();
        };

        load();
        loadNow.current = resume;
        const timer = setInterval(tick, DECORATOR_REFRESH_MS);
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => {
            cancelled = true;
            loadNow.current = null;
            clearInterval(timer);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [service, data, isArchitecture]);

    if (!isArchitecture) return NONE;
    return loaded?.source === data ? loaded.state : LOADING;
}
