import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { IoChevronForwardOutline } from 'react-icons/io5';
import { colors } from '../../../theme/colors.js';
import { redesignTokens } from '../../../theme/redesign-tokens.js';
import { CountBadge } from './CountBadge.js';
import { NestedCountBadge } from './NestedCountBadge.js';
import { INDENT_STEP, isNamespace, splitOnMatch, type NamespaceTreeNode } from './namespace-tree.js';

interface NamespaceRailItemProps {
    node: NamespaceTreeNode;
    depth: number;
    hasChildren: boolean;
    collapsed: boolean;
    descendantTotal: number;
    active: boolean;
    /** Filter mode swaps the label to the full path and suppresses the ghost pill. */
    filtering: boolean;
    /** Lower-cased filter text, used to highlight the match in the label. */
    needle: string;
    onToggleCollapsed: (path: string) => void;
}

function highlight(label: string, needle: string): ReactNode {
    const match = splitOnMatch(label, needle);
    if (!match) return label;
    return (
        <>
            {match.prefix}
            <mark style={{ backgroundColor: colors.redesign.tintBg, color: colors.redesign.primaryText }}>{match.match}</mark>
            {match.suffix}
        </>
    );
}

/**
 * One row of the namespace tree: indent guides, a disclosure chevron and a
 * link-or-plain label. The chevron is a sibling of the link rather than a
 * descendant — a `<button>` inside an `<a>` is invalid, and the two are
 * independent hit targets.
 *
 * Filter mode hides the chevron: filtering ignores the collapsed set, so the
 * toggle would rewrite persisted state with no visible effect until cleared.
 */
export function NamespaceRailItem({
    node,
    depth,
    hasChildren,
    collapsed,
    descendantTotal,
    active,
    filtering,
    needle,
    onToggleCollapsed,
}: NamespaceRailItemProps) {
    const namespaceRow = isNamespace(node);
    const label = filtering ? node.path : node.segment;
    const labelContent = filtering ? highlight(label, needle) : label;

    const rowStyle = active
        ? { backgroundColor: colors.redesign.tintBg, boxShadow: redesignTokens.shadow.railAccent, transition: redesignTokens.transition }
        : { transition: redesignTokens.transition };

    const labelStyle = active ? { color: colors.redesign.activeText } : { color: colors.redesign.bodyAlt };

    return (
        <div className={`flex items-center gap-1 pr-1.5 py-1 rounded-[7px] text-[13px] ${active ? 'font-semibold' : ''}`} style={rowStyle}>
            <div className="flex items-center shrink-0" aria-hidden="true">
                {Array.from({ length: depth }).map((_, i) => (
                    <span key={i} style={{ display: 'inline-block', width: INDENT_STEP, height: 20, borderLeft: `1px solid ${colors.redesign.border}` }} />
                ))}
            </div>

            {hasChildren && !filtering ? (
                <button
                    type="button"
                    aria-expanded={!collapsed}
                    aria-label={collapsed ? `Expand ${node.path}` : `Collapse ${node.path}`}
                    onClick={() => onToggleCollapsed(node.path)}
                    className="flex items-center justify-center shrink-0 bg-transparent border-0 p-0 cursor-pointer"
                    style={{ width: 24, height: 24 }}
                >
                    <IoChevronForwardOutline
                        size={12}
                        style={{
                            color: colors.redesign.mutedAlt,
                            transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)',
                            transition: redesignTokens.transition,
                        }}
                    />
                </button>
            ) : (
                <span className="shrink-0" style={{ width: 24, height: 24 }} aria-hidden="true" />
            )}

            {namespaceRow ? (
                <Link
                    to={`/namespace/${encodeURIComponent(node.path)}`}
                    aria-current={active ? 'page' : undefined}
                    aria-label={node.path}
                    title={node.path}
                    className="min-w-0 flex-1 truncate no-underline hover:bg-base-200 rounded-[7px] px-1"
                    style={labelStyle}
                >
                    {labelContent}
                </Link>
            ) : (
                <span className="min-w-0 flex-1 truncate px-1 italic" title={node.path} style={{ color: colors.redesign.muted }}>
                    {labelContent}
                </span>
            )}

            <div className="flex items-center gap-1 shrink-0">
                {node.total !== null && <CountBadge count={node.total} active={active} />}
                {!filtering && collapsed && hasChildren && <NestedCountBadge count={descendantTotal} />}
            </div>
        </div>
    );
}
