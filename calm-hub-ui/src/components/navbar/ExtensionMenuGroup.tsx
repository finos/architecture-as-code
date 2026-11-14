import { NavLink } from 'react-router-dom';
import { useExtensions } from '../../extensions/ExtensionsContext.js';
import { screenPath } from '../../extensions/contributions.js';
import { ExtensionMarker } from '../../extensions/ExtensionMarker.js';

interface ExtensionMenuGroupProps {
    linkClassName: (state: { isActive: boolean }) => string;
    onNavigate?: () => void;
}

/** The Extensions group of the side menu: one entry per extension screen. Nothing when no extension has a screen. */
export function ExtensionMenuGroup({ linkClassName, onNavigate }: ExtensionMenuGroupProps) {
    const screens = useExtensions().flatMap((extension) =>
        (extension.contributes.screen ?? []).map((contribution) => ({ extension, contribution }))
    );
    if (screens.length === 0) return null;
    return (
        <li>
            <div
                id="menu-extensions-heading"
                className="px-4 pt-3 pb-1 text-[11px] font-mono-jb uppercase tracking-[0.1em] text-base-content/60"
            >
                Extensions
            </div>
            <ul aria-labelledby="menu-extensions-heading">
                {screens.map(({ extension, contribution }) => (
                    <li key={`${extension.id}/${contribution.id}`}>
                        <NavLink to={screenPath(extension, contribution)} className={linkClassName} onClick={onNavigate}>
                            <span className="flex items-center gap-2 min-w-0">
                                <ExtensionMarker extensionId={extension.id} />
                                <span className="flex flex-col min-w-0">
                                    <span className="truncate">{contribution.title}</span>
                                    {contribution.title !== extension.name && (
                                        <span className="text-xs text-base-content/60 truncate">{extension.name}</span>
                                    )}
                                </span>
                            </span>
                        </NavLink>
                    </li>
                ))}
            </ul>
        </li>
    );
}
