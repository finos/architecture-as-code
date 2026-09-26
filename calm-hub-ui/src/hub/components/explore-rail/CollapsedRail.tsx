import { useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { IoChevronForwardOutline } from 'react-icons/io5';
import { NamespaceCounts } from '../../../model/counts.js';
import { colors } from '../../../theme/colors.js';
import { redesignTokens } from '../../../theme/redesign-tokens.js';
import { CountBadge } from './CountBadge.js';
import { buildNamespaceTree, flattenNamespaceTree, indentFor, isNamespace, type NamespaceTreeNode } from './namespace-tree.js';

interface CollapsedRailProps {
    namespaceCounts: NamespaceCounts[];
    onExpand: () => void;
}

function isWithin(container: HTMLElement, target: EventTarget | null): boolean {
    return target instanceof Node && container.contains(target);
}

function FlyoutRow({ node, depth, active }: { node: NamespaceTreeNode; depth: number; active: boolean }) {
    const namespaceRow = isNamespace(node);
    const style = active ? { color: colors.redesign.activeText } : { color: colors.redesign.bodyAlt };

    const content = (
        <>
            <span className="min-w-0 flex-1 truncate">{node.segment}</span>
            {node.total !== null && <CountBadge count={node.total} active={active} />}
        </>
    );

    return (
        <div
            className="flex items-center gap-1 px-2 py-1 rounded-[7px] text-[13px]"
            style={{
                paddingLeft: 8 + indentFor(depth),
                backgroundColor: active ? colors.redesign.tintBg : undefined,
                boxShadow: active ? redesignTokens.shadow.railAccent : undefined,
            }}
        >
            {namespaceRow ? (
                <Link to={`/namespace/${encodeURIComponent(node.path)}`} className="flex items-center gap-1 min-w-0 flex-1 no-underline" style={style}>
                    {content}
                </Link>
            ) : (
                <span className="flex items-center gap-1 min-w-0 flex-1 italic" style={{ color: colors.redesign.muted }}>
                    {content}
                </span>
            )}
        </div>
    );
}

interface RootInitialProps {
    root: NamespaceTreeNode;
    isActive: boolean;
    isOpen: boolean;
    activeNamespace?: string;
    onOpen: () => void;
    onClose: () => void;
}

function RootInitial({ root, isActive, isOpen, activeNamespace, onOpen, onClose }: RootInitialProps) {
    const rows = useMemo(() => flattenNamespaceTree([root], { collapsed: new Set(), filtering: false, visible: new Set() }), [root]);
    const triggerRef = useRef<HTMLButtonElement>(null);
    // Escape returns focus to the trigger, which would re-fire onFocus and reopen what it just closed.
    const dismissedRef = useRef(false);

    return (
        <div
            className="relative"
            onMouseEnter={() => {
                dismissedRef.current = false;
                onOpen();
            }}
            onMouseLeave={(e) => {
                if (!isWithin(e.currentTarget, document.activeElement)) onClose();
            }}
            onFocus={() => {
                if (!dismissedRef.current) onOpen();
            }}
            onBlur={(e) => {
                if (isWithin(e.currentTarget, e.relatedTarget)) return;
                dismissedRef.current = false;
                onClose();
            }}
            onKeyDown={(e) => {
                if (e.key !== 'Escape') return;
                dismissedRef.current = true;
                onClose();
                // Escape unmounts the row that had focus, which would otherwise drop it to <body>.
                triggerRef.current?.focus();
            }}
        >
            <button
                ref={triggerRef}
                type="button"
                aria-label={root.path}
                aria-haspopup="true"
                aria-expanded={isOpen}
                className="flex items-center justify-center font-semibold text-[13px] rounded-[7px] border-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-interaction)]"
                style={{
                    width: 32,
                    height: 24,
                    backgroundColor: isActive ? colors.redesign.tintBg : 'transparent',
                    boxShadow: isActive ? redesignTokens.shadow.railAccent : undefined,
                    color: isActive ? colors.redesign.activeText : colors.redesign.bodyAlt,
                    transition: redesignTokens.transition,
                }}
            >
                {root.segment.charAt(0).toUpperCase()}
            </button>

            {isOpen && (
                <div
                    className="absolute top-0 left-full ml-1 flex flex-col gap-0.5 p-1.5 rounded-[12px] z-50"
                    style={{
                        width: 220,
                        maxHeight: '60vh',
                        overflowY: 'auto',
                        backgroundColor: colors.redesign.surface,
                        border: `1px solid ${colors.redesign.border}`,
                        boxShadow: redesignTokens.shadow.floating,
                    }}
                >
                    {rows.map((row) => (
                        <FlyoutRow key={row.node.path} node={row.node} depth={row.depth} active={row.node.path === activeNamespace} />
                    ))}
                </div>
            )}
        </div>
    );
}

/**
 * The rail collapsed to a 24px strip of per-root initials. Each initial opens a
 * fully-flattened fly-out of its subtree on hover or focus — there is no collapse
 * state in the fly-out, it is transient. The panel scrolls, because it ignores
 * the main rail's collapsed set and so always renders the whole subtree.
 */
export function CollapsedRail({ namespaceCounts, onExpand }: CollapsedRailProps) {
    // Matches ExploreRail: on the detail route the param is `namespace`, so the accent
    // survives a detail session just as the expanded rail's highlight does.
    const { ns, namespace } = useParams<{ ns?: string; namespace?: string }>();
    const activeNamespace = ns ?? namespace;
    const [openPath, setOpenPath] = useState<string | null>(null);
    const tree = useMemo(() => buildNamespaceTree(namespaceCounts), [namespaceCounts]);

    return (
        <div
            className="h-full w-full flex flex-col items-center"
            style={{ backgroundColor: colors.redesign.surfaceAlt, borderRight: `1px solid ${colors.redesign.border}` }}
        >
            <div className="flex items-center justify-center pt-3 pb-2">
                <button aria-label="Expand sidebar" className="btn btn-ghost btn-xs btn-circle" onClick={onExpand}>
                    <IoChevronForwardOutline />
                </button>
            </div>

            <div className="flex flex-col items-center gap-1.5">
                {tree.map((root) => (
                    <RootInitial
                        key={root.path}
                        root={root}
                        isActive={activeNamespace === root.path || activeNamespace?.startsWith(`${root.path}.`) === true}
                        isOpen={openPath === root.path}
                        activeNamespace={activeNamespace}
                        onOpen={() => setOpenPath(root.path)}
                        onClose={() => setOpenPath((prev) => (prev === root.path ? null : prev))}
                    />
                ))}
            </div>
        </div>
    );
}
