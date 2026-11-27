import { useContext } from 'react';
import { NavLink } from 'react-router-dom';
import { UserAccessContext } from '../../admin/context/UserAccessContext.js';
import { useUiConfig } from '../ui-config/UiConfigContext.js';
import { ExtensionMenuGroup } from '../navbar/ExtensionMenuGroup.js';
import { MenuInfo } from '../navbar/MenuInfo.js';
import { extensionsHeading, useNavigationSettings } from './navigation-settings.js';

function menuNavClass({ isActive }: { isActive: boolean }) {
    // The active item uses the rail's tint and text tokens, which a brand colour replaces.
    return `w-full flex items-center px-4 py-3 text-left hover:bg-base-200 active:bg-base-200${isActive ? ' bg-[var(--calm-redesign-tint-bg)] text-[var(--calm-redesign-active-text)] font-semibold' : ''}`;
}

interface NavigationMenuProps {
    /** Closes the drawer after a link is chosen. */
    onNavigate?: () => void;
}

/** The destinations of the menu, in the drawer or in the persistent sidebar, with the operator's information below. */
export function NavigationMenu({ onNavigate }: NavigationMenuProps) {
    const { loading, isGlobalAdmin, grants } = useContext(UserAccessContext);
    const showAdminLink = !loading && (isGlobalAdmin || grants.some((g) => g.permission === 'admin'));
    const { identity, items } = useUiConfig();
    const navigation = useNavigationSettings();

    return (
        <>
            <ul className="flex-1 overflow-auto divide-y divide-base-200">
                <li>
                    <NavLink to="/" className={menuNavClass} onClick={onNavigate} end>
                        Home
                    </NavLink>
                </li>
                {showAdminLink && (
                    <li>
                        <NavLink to="/admin" className={menuNavClass} onClick={onNavigate}>
                            Admin
                        </NavLink>
                    </li>
                )}
                <ExtensionMenuGroup heading={extensionsHeading(navigation)} linkClassName={menuNavClass} onNavigate={onNavigate} />
            </ul>
            <MenuInfo identity={identity} items={items} />
        </>
    );
}
