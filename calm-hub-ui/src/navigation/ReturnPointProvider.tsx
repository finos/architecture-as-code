import { ReactNode, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { boundLabel, readReturnPoints, ReturnPage, ReturnPointContext } from './returnPoints.js';

interface ReturnPointProviderProps {
    /** The page that links inside record as their return point. Without it, links record none. */
    page?: ReturnPage;
    /** Shown as "Back to <label>", shortened to 200 characters. */
    label: string;
    /** The query to return to. The default is the current query. */
    search?: string;
    children: ReactNode;
}

/** Declares the current page as the return point of the links inside it (`ScreenLink`, `DestinationLink`). */
export function ReturnPointProvider({ page, label, search, children }: ReturnPointProviderProps) {
    const location = useLocation();
    // The page is usually a new object on each render; its value decides.
    const pageKey = page ? JSON.stringify(page) : undefined;
    const value = useMemo(
        () =>
            pageKey === undefined
                ? null
                : {
                      point: { page: JSON.parse(pageKey) as ReturnPage, search: search ?? location.search, label: boundLabel(label) },
                      earlier: readReturnPoints(location.state),
                  },
        [pageKey, search, location.search, location.state, label]
    );
    return <ReturnPointContext.Provider value={value}>{children}</ReturnPointContext.Provider>;
}
