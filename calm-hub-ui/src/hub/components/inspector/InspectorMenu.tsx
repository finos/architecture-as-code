import { useEffect, useId, useRef, useState, type Ref } from 'react';
import { IoCheckmarkOutline, IoChevronDownOutline } from 'react-icons/io5';
import type { ResourceExtension } from '../../../extensions/contributions.js';
import { ExtensionLogo } from '../../../extensions/ExtensionLogo.js';
import { inspectorViews, type InspectorView } from '../../../extensions/inspector/inspectorViews.js';
import type { InspectorTab } from './inspectorIds.js';

interface InspectorMenuProps {
    entries: readonly ResourceExtension[];
    tab: InspectorTab;
    active?: ResourceExtension;
    view?: InspectorView;
    selectedRef: Ref<HTMLButtonElement>;
    onSelect: (tab: InspectorTab, extensionId?: string, viewId?: string) => void;
}

/** Details first, then each extension's views under its identity. */
export function InspectorMenu({ entries, tab, active, view, selectedRef, onSelect }: InspectorMenuProps) {
    const [open, setOpen] = useState(false);
    const [filter, setFilter] = useState('');
    const rootRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const id = useId();
    const groups = entries.map((entry) => {
        const views = inspectorViews(entry);
        return { extension: entry.extension, views: views.length ? views : [{ id: undefined, title: 'Actions' }] };
    });
    const filterShown = groups.reduce((count, group) => count + group.views.length, 0) > 5;
    const needle = filter.trim().toLowerCase();
    const shown = groups
        .map(({ extension, views }) => ({
            extension,
            views: [extension.name, extension.id, extension.provider ?? ''].some((text) => text.toLowerCase().includes(needle))
                ? views
                : views.filter((item) => item.title.toLowerCase().includes(needle)),
        }))
        .filter((group) => group.views.length > 0);
    const title = tab === 'details' ? 'Details' : (view?.title ?? (active ? 'Actions' : 'Extensions'));
    const label = tab === 'extensions' && active ? `${active.extension.name} — ${title}` : title;
    const close = () => {
        setOpen(false);
        setFilter('');
        rootRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    };
    const choose = (next: InspectorTab, extensionId?: string, viewId?: string) => {
        onSelect(next, extensionId, viewId);
        close();
    };

    useEffect(() => {
        if (!open) return;
        const dismiss = (event: MouseEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) {
                setOpen(false);
                setFilter('');
            }
        };
        document.addEventListener('mousedown', dismiss);
        return () => document.removeEventListener('mousedown', dismiss);
    }, [open]);

    useEffect(() => {
        if (!open || filterShown) return;
        const menu = menuRef.current;
        (
            menu?.querySelector<HTMLButtonElement>('[aria-checked="true"]') ??
            menu?.querySelector<HTMLButtonElement>('[role="menuitemradio"]')
        )?.focus();
    }, [open, filterShown]);

    const itemClass =
        'w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-base-200 focus-visible:bg-base-200 focus-visible:outline-2 focus-visible:outline-primary aria-checked:text-[var(--calm-interaction-text)] aria-checked:font-semibold';
    return (
        <div
            ref={rootRef}
            className="relative flex-1 min-w-0"
            onBlur={(event) => {
                if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) {
                    setOpen(false);
                    setFilter('');
                }
            }}
        >
            <button
                ref={selectedRef}
                type="button"
                aria-label={`Inspector view: ${label}`}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? id : undefined}
                className="btn btn-ghost w-full h-auto min-h-10 py-1.5 justify-between text-left gap-2"
                onClick={() => (open ? close() : setOpen(true))}
                onKeyDown={(event) => {
                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                        event.preventDefault();
                        setOpen(true);
                    }
                }}
            >
                {tab === 'extensions' && active && <ExtensionLogo extension={active.extension} size={20} />}
                <span className="flex-1 min-w-0">
                    {tab === 'extensions' && active && (
                        <span className="block text-xs font-normal text-base-content/60 truncate">{active.extension.name}</span>
                    )}
                    <span className="block truncate">{title}</span>
                </span>
                <IoChevronDownOutline size={16} className="shrink-0" aria-hidden="true" />
            </button>
            {open && (
                <div
                    className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border border-base-300 bg-base-100 shadow-lg text-base-content"
                    onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                            event.preventDefault();
                            event.stopPropagation();
                            close();
                        } else if (event.key === 'Tab') {
                            close();
                        } else {
                            const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [])];
                            const index = items.indexOf(document.activeElement as HTMLButtonElement);
                            const next =
                                event.key === 'ArrowDown'
                                    ? (index + 1) % items.length
                                    : event.key === 'ArrowUp'
                                      ? index <= 0
                                          ? items.length - 1
                                          : index - 1
                                      : index >= 0 && event.key === 'Home'
                                        ? 0
                                        : index >= 0 && event.key === 'End'
                                          ? items.length - 1
                                          : undefined;
                            if (next !== undefined) {
                                event.preventDefault();
                                items[next]?.focus();
                            }
                        }
                    }}
                >
                    {filterShown && (
                        <div className="p-2 border-b border-base-300">
                            <input
                                autoFocus
                                type="search"
                                className="input input-sm input-bordered w-full"
                                aria-label="Filter inspector views"
                                placeholder="Filter views"
                                value={filter}
                                onChange={(event) => setFilter(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' && shown[0]) {
                                        event.preventDefault();
                                        choose('extensions', shown[0].extension.id, shown[0].views[0].id);
                                    }
                                }}
                            />
                        </div>
                    )}
                    <div
                        ref={menuRef}
                        id={id}
                        role="menu"
                        aria-label="Inspector views"
                        className="py-1 max-h-[min(60vh,28rem)] overflow-auto"
                    >
                        <button
                            type="button"
                            role="menuitemradio"
                            aria-checked={tab === 'details'}
                            tabIndex={-1}
                            className={itemClass}
                            onClick={() => choose('details')}
                        >
                            <span className="flex-1">Details</span>
                            {tab === 'details' && <IoCheckmarkOutline aria-hidden="true" />}
                        </button>
                        {shown.map(({ extension, views }) => (
                            <div key={extension.id} role="group" aria-label={extension.name} className="border-t border-base-300 mt-1 pt-1">
                                <div className="flex gap-2 px-3 py-2 items-start" role="presentation">
                                    <ExtensionLogo extension={extension} size={18} />
                                    <div className="min-w-0 text-xs [overflow-wrap:anywhere]">
                                        <div className="font-semibold">{extension.name}</div>
                                        {extension.provider && <div className="text-base-content/60">{extension.provider}</div>}
                                    </div>
                                </div>
                                {views.map((item) => {
                                    const checked = tab === 'extensions' && active?.extension.id === extension.id && view?.id === item.id;
                                    return (
                                        <button
                                            key={item.id ?? 'actions'}
                                            type="button"
                                            role="menuitemradio"
                                            aria-checked={checked}
                                            tabIndex={-1}
                                            className={`${itemClass} pl-10`}
                                            onClick={() => choose('extensions', extension.id, item.id)}
                                        >
                                            <span className="flex-1 min-w-0 [overflow-wrap:anywhere]">{item.title}</span>
                                            {checked && <IoCheckmarkOutline className="shrink-0" aria-hidden="true" />}
                                        </button>
                                    );
                                })}
                            </div>
                        ))}
                        {shown.length === 0 && needle && (
                            <p role="presentation" className="px-3 py-2 text-sm text-base-content/60">
                                No extension view matches the filter.
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
