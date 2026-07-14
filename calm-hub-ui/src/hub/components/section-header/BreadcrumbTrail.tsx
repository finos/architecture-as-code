import { useEffect, useRef, useState } from 'react';
import { BreadcrumbItem } from '../../../model/calm.js';

interface BreadcrumbTrailProps {
    breadcrumbs: BreadcrumbItem[];
    onBreadcrumbClick?: (crumb: BreadcrumbItem, index: number) => void;
}

function CrumbButton({
    crumb,
    onClick,
    // The immediate parent (last crumb) is the primary "go back" target, so it
    // gets a wider cap than the first/middle crumbs to avoid collapsing a long
    // name into a bare, ambiguous ellipsis.
    maxWidthClass = 'max-w-[8rem]',
}: {
    crumb: BreadcrumbItem;
    onClick: () => void;
    maxWidthClass?: string;
}) {
    return (
        <button
            onClick={onClick}
            className={`text-accent hover:underline ${maxWidthClass} truncate shrink-0`}
            title={crumb.name || crumb.id}
        >
            {crumb.name || crumb.id}
        </button>
    );
}

function Separator() {
    return (
        <>
            {' '}
            <span className="text-base-content/40">/</span>{' '}
        </>
    );
}

/**
 * Parent-architecture trail rendered before the current resource's own
 * namespace/id trail in the SectionHeader heading. More than two crumbs
 * collapse to `first / … / last`, with the hidden middle reachable through the
 * ellipsis dropdown (outside click or Escape closes it; Escape returns focus to
 * the trigger).
 */
export function BreadcrumbTrail({ breadcrumbs, onBreadcrumbClick }: BreadcrumbTrailProps) {
    const [ellipsisOpen, setEllipsisOpen] = useState(false);
    const ellipsisRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!ellipsisOpen) return;
        function handleClickOutside(e: MouseEvent) {
            if (ellipsisRef.current && !ellipsisRef.current.contains(e.target as Node)) {
                setEllipsisOpen(false);
            }
        }
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape') {
                setEllipsisOpen(false);
                triggerRef.current?.focus();
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [ellipsisOpen]);

    if (breadcrumbs.length === 0) return null;

    const first = breadcrumbs[0];
    const last = breadcrumbs[breadcrumbs.length - 1];
    const lastIndex = breadcrumbs.length - 1;
    const hasEllipsis = breadcrumbs.length > 2;
    const hiddenCrumbs = breadcrumbs.slice(1, -1);

    return (
        <>
            <CrumbButton crumb={first} onClick={() => onBreadcrumbClick?.(first, 0)} />
            <Separator />
            {hasEllipsis && (
                <>
                    <div className="relative shrink-0" ref={ellipsisRef}>
                        <button
                            ref={triggerRef}
                            onClick={() => setEllipsisOpen((o) => !o)}
                            className="text-base-content/40 hover:text-base-content px-1 rounded hover:bg-base-300 transition-colors"
                            aria-label="Show hidden breadcrumbs"
                            aria-expanded={ellipsisOpen}
                            aria-haspopup="true"
                        >
                            …
                        </button>
                        {ellipsisOpen && (
                            <div className="absolute top-full left-0 mt-1 z-50 bg-base-100 border border-base-300 rounded-lg shadow-lg py-1 min-w-[10rem]">
                                {hiddenCrumbs.map((crumb, i) => (
                                    <button
                                        key={i}
                                        onClick={() => {
                                            onBreadcrumbClick?.(crumb, i + 1);
                                            setEllipsisOpen(false);
                                        }}
                                        className="w-full text-left px-3 py-1.5 text-sm text-accent hover:bg-base-200 truncate block"
                                        title={crumb.name || crumb.id}
                                    >
                                        {crumb.name || crumb.id}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <Separator />
                </>
            )}
            {breadcrumbs.length > 1 && (
                <>
                    <CrumbButton crumb={last} onClick={() => onBreadcrumbClick?.(last, lastIndex)} maxWidthClass="max-w-[12rem]" />
                    <Separator />
                </>
            )}
        </>
    );
}
