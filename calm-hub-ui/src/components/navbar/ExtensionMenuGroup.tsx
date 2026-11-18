import { useId } from 'react';
import { NavLink } from 'react-router-dom';
import { useExtensions } from '../../extensions/ExtensionsContext.js';
import { extensionNavLinks } from '../../extensions/contributions.js';
import { ExtensionLogo } from '../../extensions/ExtensionLogo.js';

interface ExtensionMenuGroupProps {
    linkClassName: (state: { isActive: boolean }) => string;
    onNavigate?: () => void;
    /** The label above the groups. Without it, the extension names alone label the groups. */
    heading?: string;
}

/**
 * The extensions part of the side menu: a group for each extension with a top-level page, named by the extension,
 * with a link to each page. Nothing when no extension has one.
 */
export function ExtensionMenuGroup({ linkClassName, onNavigate, heading }: ExtensionMenuGroupProps) {
    const id = useId();
    const groups = useExtensions()
        .map((extension) => ({ extension, links: extensionNavLinks(extension) }))
        .filter(({ links }) => links.length > 0);
    if (groups.length === 0) return null;
    return (
        <li>
            {heading && (
                <div
                    id={`${id}heading`}
                    className="px-4 pt-3 pb-1 text-[11px] font-mono-jb uppercase tracking-[0.1em] text-base-content/60"
                >
                    {heading}
                </div>
            )}
            <ul aria-labelledby={heading ? `${id}heading` : undefined}>
                {groups.map(({ extension, links }) => (
                    <li key={extension.id}>
                        <div className="flex items-center gap-2 min-w-0 px-4 pt-3 pb-1 font-semibold">
                            <ExtensionLogo extension={extension} size={16} />
                            {/* A separate prefix from the heading's, so that an extension id such as "heading" cannot collide with it. */}
                            <span id={`${id}extension-${extension.id}`} className="min-w-0 line-clamp-2 wrap-anywhere" title={extension.name}>
                                {extension.name}
                            </span>
                        </div>
                        <ul aria-labelledby={`${id}extension-${extension.id}`}>
                            {links.map((link) => (
                                <li key={link.key}>
                                    <NavLink to={link.to} className={linkClassName} onClick={onNavigate}>
                                        {/* Indented under the extension name. Not clamped: two titles can differ only at the end. */}
                                        <span className="pl-4 min-w-0 wrap-anywhere">{link.title}</span>
                                    </NavLink>
                                </li>
                            ))}
                        </ul>
                    </li>
                ))}
            </ul>
        </li>
    );
}
