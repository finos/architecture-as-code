import { useCallback, useEffect, useState } from 'react';

export interface RefreshingRequest<T> {
    /** The last value loaded for this view, also while it loads again. */
    value?: T;
    /** A request for this view is in flight: the first load, a refresh or a retry. */
    loading: boolean;
    /** The last request for this view failed. With a `value`, the value is from before. */
    failed: boolean;
    /** The user asked to try again after a failure, and that request is in flight. */
    retrying: boolean;
    retry: () => void;
}

/**
 * Loads a value for a view, such as the context of a slot or the filters of a table, and loads it again when the
 * revision changes or the user tries again. A value shows only for the view that it was loaded for, so data of an
 * earlier target never shows under a new one. A reply that comes after a newer request is dropped. There is no fetch
 * while `load` is undefined, and no second fetch for a request that loaded or failed.
 */
export function useRefreshingRequest<T>(
    view: string,
    revision: number,
    load: ((signal: AbortSignal) => Promise<T>) | undefined
): RefreshingRequest<T> {
    const [retries, setRetries] = useState(0);
    const [loaded, setLoaded] = useState<{ view: string; request: string; value: T }>();
    const [failedRequest, setFailedRequest] = useState<string>();
    // The request that Try again started. Only that request is a retry: a later view or revision is a new request.
    const [retryRequest, setRetryRequest] = useState<string>();
    const request = JSON.stringify([view, revision, retries]);
    const done = loaded?.request === request || failedRequest === request;

    useEffect(() => {
        if (!load || done) return;
        const controller = new AbortController();
        // The effect runs again when its request is done; only a request still in flight is cancelled.
        let settled = false;
        load(controller.signal)
            .then((value) => {
                settled = true;
                if (!controller.signal.aborted) setLoaded({ view, request, value });
            })
            .catch(() => {
                settled = true;
                if (!controller.signal.aborted) setFailedRequest(request);
            });
        return () => {
            if (!settled) controller.abort();
        };
    }, [load, done, view, request]);

    const retry = useCallback(() => {
        setRetryRequest(JSON.stringify([view, revision, retries + 1]));
        setRetries(retries + 1);
    }, [view, revision, retries]);

    const failed = failedRequest === request;
    const loading = !!load && !done;
    return {
        value: loaded?.view === view ? loaded.value : undefined,
        loading,
        failed,
        retrying: loading && retryRequest === request,
        retry,
    };
}
