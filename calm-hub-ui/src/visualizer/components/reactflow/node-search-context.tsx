import { createContext, useContext, useState } from 'react';

/**
 * Shared node ("component") search state for a diagram. By default each graph
 * owns its own state and renders the in-canvas search bar. When a parent
 * provides this context (e.g. the mobile diagram, which surfaces the search
 * inside its view-options menu), the graph uses the external state instead and
 * hides its in-canvas search bar.
 */
export interface NodeSearchState {
    searchTerm: string;
    setSearchTerm: (value: string) => void;
    typeFilter: string;
    setTypeFilter: (value: string) => void;
    availableNodeTypes: string[];
    setAvailableNodeTypes: (value: string[]) => void;
    /** True when the search UI is rendered outside the canvas (hide the in-canvas bar). */
    external: boolean;
}

const NodeSearchContext = createContext<NodeSearchState | null>(null);

export const NodeSearchProvider = NodeSearchContext.Provider;

/**
 * Returns the externally-provided node-search state when a {@link NodeSearchProvider}
 * is present, otherwise falls back to graph-local state.
 */
export function useNodeSearch(): NodeSearchState {
    const ctx = useContext(NodeSearchContext);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [availableNodeTypes, setAvailableNodeTypes] = useState<string[]>([]);

    if (ctx) return ctx;
    return {
        searchTerm,
        setSearchTerm,
        typeFilter,
        setTypeFilter,
        availableNodeTypes,
        setAvailableNodeTypes,
        external: false,
    };
}
