import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export type ViewMode = 'tiles' | 'list';

/** Above this many items of one type, the namespace page defaults to the list view. */
export const LIST_VIEW_THRESHOLD = 12;

const isViewMode = (value: string | null): value is ViewMode => value === 'tiles' || value === 'list';

/**
 * Resolves the `?view=` param, falling back to a size-based default per type.
 */
export function useViewMode(itemCount: number): { view: ViewMode; setView: (view: ViewMode) => void } {
    const [searchParams, setSearchParams] = useSearchParams();

    const param = searchParams.get('view');
    const view: ViewMode = isViewMode(param) ? param : itemCount > LIST_VIEW_THRESHOLD ? 'list' : 'tiles';

    const setView = useCallback(
        (next: ViewMode) => {
            const params = new URLSearchParams(searchParams);
            params.set('view', next);
            setSearchParams(params, { replace: true });
        },
        [searchParams, setSearchParams]
    );

    return { view, setView };
}
