import { Search, X } from 'lucide-react';
import { THEME } from './theme';

interface SearchBarProps {
    searchTerm: string;
    onSearchChange: (term: string) => void;
    typeFilter: string;
    onTypeFilterChange: (type: string) => void;
    nodeTypes: string[];
}

export function SearchBar({
    searchTerm,
    onSearchChange,
    typeFilter,
    onTypeFilterChange,
    nodeTypes,
}: SearchBarProps) {
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
                style={{
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    color: THEME.colors.foreground,
                    fontSize: '12px',
                    width: '140px',
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
        </div>
    );
}
