import { useEffect, useId, useRef, useState } from 'react';
import { IoCheckmarkOutline, IoChevronDownOutline } from 'react-icons/io5';
import { lensGroups, type DiagramLens } from './diagramTabRegistry.js';

interface LensMenuProps {
    lenses: readonly DiagramLens[];
    activeLensId: string;
    labelOf: (lens: DiagramLens) => string;
    onSelect: (lens: DiagramLens) => void;
    /** The look of the chevron, so that it joins the tab that holds it. */
    buttonClassName: string;
}

/** The chevron of the Diagram tab: a list of the lenses, with a text filter. */
export function LensMenu({ lenses, activeLensId, labelOf, onSelect, buttonClassName }: LensMenuProps) {
    const [open, setOpen] = useState(false);
    const [filter, setFilter] = useState('');
    const rootRef = useRef<HTMLDivElement>(null);
    const listId = useId();

    useEffect(() => {
        if (!open) return;
        const close = (event: MouseEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [open]);

    const needle = filter.trim().toLowerCase();
    const { builtIn, extension } = lensGroups(
        lenses.filter((lens) => !needle || `${labelOf(lens)} ${lens.title ?? ''} ${lens.extension?.name ?? ''}`.toLowerCase().includes(needle))
    );
    const shown = [...builtIn, ...extension];
    const choose = (lens: DiagramLens) => {
        setOpen(false);
        setFilter('');
        onSelect(lens);
    };

    const row = (lens: DiagramLens) => {
        const LensIcon = lens.icon;
        const active = lens.id === activeLensId;
        return (
            <li key={lens.id}>
                <button
                    type="button"
                    aria-current={active || undefined}
                    title={lens.title}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-base-200 ${
                        active ? 'text-[var(--color-interaction)] font-semibold' : ''
                    }`}
                    onClick={() => choose(lens)}
                >
                    <LensIcon />
                    <span className="flex-1 min-w-0 truncate">{labelOf(lens)}</span>
                    {lens.extension && <span className="text-xs font-normal text-base-content/50 truncate max-w-[45%]">{lens.extension.name}</span>}
                    {active && <IoCheckmarkOutline className="shrink-0" />}
                </button>
            </li>
        );
    };

    return (
        <div ref={rootRef} className="relative flex">
            <button
                type="button"
                aria-label="Choose a lens"
                aria-haspopup="true"
                aria-expanded={open}
                aria-controls={open ? listId : undefined}
                className={buttonClassName}
                onClick={() => setOpen(!open)}
            >
                <IoChevronDownOutline size={12} />
            </button>
            {open && (
                <div
                    className="absolute right-0 top-full mt-2 z-50 w-64 rounded-lg border border-base-300 bg-base-100 shadow-lg text-base-content"
                    onKeyDown={(event) => {
                        if (event.key === 'Escape') setOpen(false);
                    }}
                >
                    <div className="p-2">
                        <input
                            autoFocus
                            type="search"
                            className="input input-sm input-bordered w-full"
                            placeholder="Filter lenses"
                            aria-label="Filter lenses"
                            value={filter}
                            onChange={(event) => setFilter(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' && shown[0]) choose(shown[0]);
                            }}
                        />
                    </div>
                    <div id={listId} className="pb-1 max-h-72 overflow-auto">
                        {builtIn.length > 0 && (
                            <ul aria-label="Lenses">{builtIn.map(row)}</ul>
                        )}
                        {extension.length > 0 && (
                            <>
                                {builtIn.length > 0 && <hr className="my-1 border-base-300" />}
                                <div id={`${listId}-extensions`} className="px-3 pt-1 pb-0.5 text-xs font-semibold uppercase tracking-wide text-base-content/50">
                                    Extensions
                                </div>
                                <ul aria-labelledby={`${listId}-extensions`}>{extension.map(row)}</ul>
                            </>
                        )}
                        {shown.length === 0 && <p className="px-3 py-1.5 text-sm text-base-content/60">No lens matches the filter.</p>}
                    </div>
                </div>
            )}
        </div>
    );
}
