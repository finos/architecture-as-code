import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { THEME } from './theme';
import { useIsMobile } from '../../../hooks/useMediaQuery.js';

interface SearchBarProps {
    searchTerm: string;
    onSearchChange: (term: string) => void;
    typeFilter: string;
    onTypeFilterChange: (type: string) => void;
    nodeTypes: string[];
}

const iconButtonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: THEME.colors.card,
    border: `1px solid ${THEME.colors.border}`,
    borderRadius: '8px',
    boxShadow: THEME.shadows.md,
    width: '34px',
    height: '34px',
    cursor: 'pointer',
    color: THEME.colors.muted,
};

export function SearchBar({
    searchTerm,
    onSearchChange,
    typeFilter,
    onTypeFilterChange,
    nodeTypes,
}: SearchBarProps) {
    const isMobile = useIsMobile();
    const [expanded, setExpanded] = useState(false);

    // On small screens the full search/filter bar steals too much canvas, so it
    // collapses to a single icon button until tapped. An active search/filter
    // keeps it expanded so the user can see and clear what's applied.
    const showCompact = isMobile && !expanded && !searchTerm && !typeFilter;

    if (showCompact) {
        return (
            <button
                type="button"
                aria-label="Search nodes"
                onClick={() => setExpanded(true)}
                style={iconButtonStyle}
            >
                <Search style={{ width: '16px', height: '16px' }} />
            </button>
        );
    }

    return (
        <div
            style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                background: THEME.colors.card,
                border: `1px solid ${THEME.colors.border}`,
                borderRadius: '8px',
                padding: '6px 10px',
                boxShadow: THEME.shadows.md,
            }}
        >
            <Search style={{ width: '14px', height: '14px', color: THEME.colors.muted, flexShrink: 0 }} />
            <input
                type="text"
                placeholder="Search nodes..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                autoFocus={isMobile && expanded}
                style={{
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    color: THEME.colors.foreground,
                    fontSize: '12px',
                    width: isMobile ? '110px' : '140px',
                }}
            />
            {searchTerm && (
                <button
                    onClick={() => onSearchChange('')}
                    aria-label="Clear search"
                    style={{
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        padding: '2px',
                        display: 'flex',
                        alignItems: 'center',
                        color: THEME.colors.muted,
                    }}
                >
                    <X style={{ width: '12px', height: '12px' }} />
                </button>
            )}
            {nodeTypes.length > 0 && (
                <select
                    value={typeFilter}
                    onChange={(e) => onTypeFilterChange(e.target.value)}
                    aria-label="Filter by node type"
                    style={{
                        border: `1px solid ${THEME.colors.border}`,
                        borderRadius: '4px',
                        background: THEME.colors.backgroundSecondary,
                        color: THEME.colors.foreground,
                        fontSize: '11px',
                        padding: '2px 4px',
                        outline: 'none',
                    }}
                >
                    <option value="">All types</option>
                    {nodeTypes.map((type) => (
                        <option key={type} value={type}>
                            {type}
                        </option>
                    ))}
                </select>
            )}
            {isMobile && (
                <button
                    type="button"
                    onClick={() => {
                        onSearchChange('');
                        onTypeFilterChange('');
                        setExpanded(false);
                    }}
                    aria-label="Collapse search"
                    style={{
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        padding: '2px',
                        display: 'flex',
                        alignItems: 'center',
                        color: THEME.colors.muted,
                    }}
                >
                    <X style={{ width: '14px', height: '14px' }} />
                </button>
            )}
        </div>
    );
}
