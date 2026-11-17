import { useId, useState } from 'react';
import { useExtensions } from '../ExtensionsContext.js';
import { ExtensionContext } from '../../model/extensions.js';
import { resourceExtensions } from '../contributions.js';
import { ExtensionSlot, SlotFrame } from '../ExtensionSlot.js';
import { ExtensionSections } from './ExtensionSections.js';

export const EXTENSIONS_TAB_SECTIONS_KEY = 'calm-hub-extension-tab-sections';
/** Above this many extensions, the tab offers a filter. */
export const EXTENSION_FILTER_THRESHOLD = 5;

interface ExtensionsTabPanelProps {
    context: ExtensionContext;
    /** The extension that a link names (`?extension=`). Its section opens. */
    linkedExtension?: string;
    storage?: Storage;
}

/** The Extensions tab of an architecture or pattern: per extension, its actions and then its designer tabs. */
export function ExtensionsTabPanel({ context, linkedExtension, storage }: ExtensionsTabPanelProps) {
    const entries = resourceExtensions(useExtensions(), context);
    const [filter, setFilter] = useState('');
    const baseId = useId();
    const filterShown = entries.length > EXTENSION_FILTER_THRESHOLD;
    // A filter whose input is hidden would hide extensions with no way to clear it.
    const needle = filterShown ? filter.trim().toLowerCase() : '';
    const shown = needle
        ? entries.filter(({ extension }) =>
              [extension.name, extension.id, extension.provider ?? ''].some((text) => text.toLowerCase().includes(needle))
          )
        : entries;

    return (
        <div className="h-full overflow-auto p-4 flex flex-col gap-3" data-testid="extensions-tab">
            {filterShown && (
                <input
                    type="search"
                    className="input input-sm input-bordered w-full max-w-xs"
                    placeholder="Filter extensions"
                    aria-label="Filter extensions"
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                />
            )}
            {shown.length === 0 ? (
                <p className="text-sm text-base-content/60">No extension matches the filter.</p>
            ) : (
                <ExtensionSections
                    storageKey={EXTENSIONS_TAB_SECTIONS_KEY}
                    defaultOpenId={entries[0]?.extension.id}
                    linkedId={linkedExtension}
                    storage={storage}
                    sections={shown.map(({ extension, actions, needsSelection, tabs, tabsNeedSelection }, index) => ({
                        id: extension.id,
                        title: extension.name,
                        subtitle: extension.provider,
                        logo: extension.logo,
                        content: () => (
                            <>
                                {actions.length + needsSelection.length > 0 && (
                                    <div className="flex flex-wrap gap-2" role="group" aria-label={`${extension.name} actions`}>
                                        {actions.map((contribution) => (
                                            <ExtensionSlot
                                                key={contribution.id}
                                                extension={extension}
                                                contribution={contribution}
                                                context={context}
                                                action
                                                placement="extensions-tab"
                                            />
                                        ))}
                                        {needsSelection.map((contribution) => (
                                            // aria-disabled, not disabled: a disabled button cannot take focus, so a keyboard user could not reach the hint.
                                            <button
                                                key={contribution.id}
                                                type="button"
                                                className="btn btn-sm btn-disabled"
                                                aria-disabled="true"
                                                aria-describedby={`${baseId}-${index}`}
                                            >
                                                {contribution.title}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {needsSelection.length > 0 && (
                                    <p id={`${baseId}-${index}`} className="text-xs text-base-content/60">
                                        {context.selectedElement === undefined
                                            ? 'Some actions need a selected node. Open this tab from a link that names a node.'
                                            : 'Some actions cannot run for the selected node.'}
                                    </p>
                                )}
                                {tabs.map((contribution) => (
                                    <ExtensionSlot
                                        key={contribution.id}
                                        extension={extension}
                                        contribution={contribution}
                                        context={context}
                                        headingLevel={4}
                                    />
                                ))}
                                {tabsNeedSelection.map((contribution) => (
                                    <SlotFrame key={contribution.id} title={contribution.title} level={4}>
                                        <p className="text-xs text-base-content/60">
                                            {context.selectedElement === undefined
                                                ? 'This tab needs a selected node. Open this tab from a link that names a node.'
                                                : 'This tab cannot show for the selected node.'}
                                        </p>
                                    </SlotFrame>
                                ))}
                            </>
                        ),
                    }))}
                />
            )}
        </div>
    );
}
