import { IoChevronForwardOutline } from 'react-icons/io5';
import { colors } from '../../../theme/colors.js';
import { redesignTokens } from '../../../theme/redesign-tokens.js';
import { CountBadge } from '../explore-rail/CountBadge.js';
import { NestedCountBadge } from '../explore-rail/NestedCountBadge.js';
import { type NamespaceRow } from '../explore-rail/namespace-tree.js';

const INDENT_PER_DEPTH = 16;

interface MobileNamespaceRowProps {
    row: NamespaceRow;
    active: boolean;
    onToggleCollapsed: (path: string) => void;
    onOpen: (namespace: string) => void;
}

/**
 * One row of the mobile drill-down's namespace tree level. The chevron
 * (collapse/expand in place) and the label (drill into the namespace's
 * types) are separate 44px-tall tap targets, split by a hairline divider —
 * a `<button>` inside a `<button>` is invalid, and the two do different things.
 */
export function MobileNamespaceRow({ row, active, onToggleCollapsed, onOpen }: MobileNamespaceRowProps) {
    const { node, hasChildren, collapsed, depth, descendantTotal } = row;
    const isNamespace = node.total !== null;

    return (
        <div className="flex items-stretch" style={{ paddingLeft: depth * INDENT_PER_DEPTH }}>
            {hasChildren ? (
                <button
                    type="button"
                    aria-expanded={!collapsed}
                    aria-label={collapsed ? `Expand ${node.path}` : `Collapse ${node.path}`}
                    onClick={() => onToggleCollapsed(node.path)}
                    className="flex items-center justify-center shrink-0 bg-transparent"
                    style={{ width: 40, minHeight: 44, borderRight: `1px solid ${colors.redesign.border}` }}
                >
                    <IoChevronForwardOutline
                        size={16}
                        style={{
                            color: colors.redesign.mutedAlt,
                            transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)',
                            transition: redesignTokens.transition,
                        }}
                    />
                </button>
            ) : (
                <span className="shrink-0" style={{ width: 40, minHeight: 44 }} aria-hidden="true" />
            )}

            {isNamespace ? (
                <button
                    type="button"
                    className="flex-1 min-w-0 flex items-center gap-2 px-4 text-left hover:bg-base-200 active:bg-base-200"
                    style={{
                        minHeight: 44,
                        ...(active
                            ? { backgroundColor: colors.redesign.tintBg, boxShadow: redesignTokens.shadow.railAccent }
                            : undefined),
                    }}
                    onClick={() => onOpen(node.path)}
                >
                    <span
                        className={`flex-1 min-w-0 truncate ${active ? 'font-semibold' : ''}`}
                        style={active ? { color: colors.redesign.activeText } : undefined}
                    >
                        {node.segment}
                    </span>
                    {collapsed && hasChildren && <NestedCountBadge count={descendantTotal} />}
                    {node.total !== null && <CountBadge count={node.total} active={active} />}
                    <IoChevronForwardOutline className="text-base-content/40 shrink-0" size={18} />
                </button>
            ) : (
                <span
                    className="flex-1 min-w-0 flex items-center gap-2 px-4 italic"
                    style={{ minHeight: 44, color: colors.redesign.muted }}
                >
                    <span className="flex-1 min-w-0 truncate">{node.segment}</span>
                    {collapsed && hasChildren && <NestedCountBadge count={descendantTotal} />}
                </span>
            )}
        </div>
    );
}
