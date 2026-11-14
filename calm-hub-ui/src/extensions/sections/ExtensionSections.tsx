import { ReactNode, useId } from 'react';
import { IoChevronDownOutline, IoChevronForwardOutline } from 'react-icons/io5';
import { ExtensionMarker } from '../ExtensionMarker.js';
import { Heading, HeadingLevel } from '../Heading.js';
import { useOpenSections } from './useOpenSections.js';

export interface ExtensionSectionItem {
    /** The extension id: the open state is kept per extension. */
    id: string;
    title: string;
    subtitle?: string;
    /** Called only while the section is open, so a closed section sends no extension request. */
    content: () => ReactNode;
}

interface ExtensionSectionsProps {
    sections: readonly ExtensionSectionItem[];
    storageKey: string;
    /** Injected for tests; see the storage note in calm-hub-ui/AGENTS.md. */
    storage?: Storage;
    compact?: boolean;
    /** The section open by default: the first of the full list. Without it, the first of `sections`. */
    defaultOpenId?: string;
    /** The level of each section title. */
    headingLevel?: HeadingLevel;
}

/** One collapsible section per extension. The default section is open until the user chooses. */
export function ExtensionSections({ sections, storageKey, storage, compact, headingLevel = 3, defaultOpenId }: ExtensionSectionsProps) {
    const { isOpen, setSectionOpen } = useOpenSections(storageKey, storage);
    const baseId = useId();
    return (
        <div className="flex flex-col divide-y divide-base-300 rounded-box border border-base-300">
            {sections.map((section, index) => {
                const open = isOpen(section.id, defaultOpenId ?? sections[0]?.id);
                const bodyId = `${baseId}-${index}`;
                const Chevron = open ? IoChevronDownOutline : IoChevronForwardOutline;
                return (
                    <section key={section.id} data-testid="extension-section" data-extension={section.id}>
                        <Heading level={headingLevel} className="m-0">
                            <button
                                type="button"
                                className={`w-full flex items-center gap-2 text-left hover:bg-base-200 ${compact ? 'px-3 py-2 text-sm' : 'px-4 py-3'}`}
                                aria-expanded={open}
                                aria-controls={bodyId}
                                onClick={() => setSectionOpen(section.id, !open)}
                            >
                                <Chevron aria-hidden="true" className="shrink-0" />
                                <ExtensionMarker extensionId={section.id} />
                                <span className="font-semibold truncate">{section.title}</span>
                                {section.subtitle && (
                                    <span className="text-xs text-base-content/60 truncate">{section.subtitle}</span>
                                )}
                            </button>
                        </Heading>
                        {open && (
                            <div id={bodyId} className={`flex flex-col gap-4 min-w-0 ${compact ? 'px-3 pb-3' : 'px-4 pb-4'}`}>
                                {section.content()}
                            </div>
                        )}
                    </section>
                );
            })}
        </div>
    );
}
