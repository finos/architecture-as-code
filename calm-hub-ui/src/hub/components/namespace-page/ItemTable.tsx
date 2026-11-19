import { colors } from '../../../theme/colors.js';
import { redesignTokens } from '../../../theme/redesign-tokens.js';
import { type NamespaceItem } from './useNamespaceItems.js';

interface ItemTableProps {
    items: NamespaceItem[];
    /** Hide the Versions column for types without a version map (ADRs, Interfaces). */
    showVersions: boolean;
    onActivate: (item: NamespaceItem) => void;
}

/**
 * Compact list view of a namespace's items, used when a type has too many for tiles.
 */
export function ItemTable({ items, showVersions, onActivate }: ItemTableProps) {
    const headerStyle = { color: colors.redesign.faint };

    return (
        <div
            className="overflow-x-auto bg-base-100"
            style={{
                border: `1px solid ${colors.redesign.border}`,
                borderRadius: redesignTokens.radius.card,
                boxShadow: redesignTokens.shadow.card,
            }}
        >
            <table data-testid="item-table" className="table table-sm table-fixed w-full">
                <thead>
                    <tr className="text-[11px] uppercase tracking-wide">
                        <th className="w-[28%]" style={headerStyle}>Name</th>
                        <th style={headerStyle}>Description</th>
                        <th className="w-[20%]" style={headerStyle}>ID</th>
                        {showVersions && <th className="w-[90px] text-right" style={headerStyle}>Versions</th>}
                    </tr>
                </thead>
                <tbody>
                    {items.map((item) => (
                        // The row is the click target; the name button bubbles to it and gives keyboard access.
                        <tr
                            key={item.id}
                            data-testid="item-row"
                            onClick={() => onActivate(item)}
                            className="cursor-pointer hover:bg-base-200"
                            style={{ transition: redesignTokens.transition }}
                        >
                            <td className="truncate">
                                <button
                                    type="button"
                                    className="text-left text-[13px] font-semibold truncate max-w-full rounded-[2px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-interaction)]"
                                    style={{ color: colors.redesign.ink }}
                                >
                                    {item.name}
                                </button>
                            </td>
                            <td
                                className="truncate text-[12px]"
                                title={item.description}
                                style={{ color: colors.redesign.mutedAlt }}
                            >
                                {item.description}
                            </td>
                            <td className="truncate font-mono-jb text-[11px]" style={{ color: colors.redesign.mutedAlt }}>
                                {item.customId}
                            </td>
                            {showVersions && (
                                <td className="text-right font-mono-jb text-[11px]" style={{ color: colors.redesign.mutedAlt }}>
                                    {item.versionCount ?? ''}
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
