import { ReactNode, useId, useState } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Navbar } from '../navbar/Navbar.js';
import { NavigationMenu } from './NavigationMenu.js';
import { usePersistentNavigation } from './navigation-settings.js';

interface AppLayoutProps {
    children: ReactNode;
    /** Injected for tests; see the storage note in calm-hub-ui/AGENTS.md. */
    storage?: Storage;
}

/** Reading the `localStorage` global itself throws when site data is blocked. */
function defaultStorage(): Storage | undefined {
    try {
        return localStorage;
    } catch {
        return undefined;
    }
}

/**
 * The navbar above the page. In the `sidebar` layout on a wide screen, the menu shows beside the page instead of in
 * the navbar's drawer. The page fills the rest of the screen and scrolls itself.
 */
export function AppLayout({ children, storage = defaultStorage() }: AppLayoutProps) {
    const persistent = usePersistentNavigation();
    const menuId = useId();
    const [collapsed, setCollapsed] = useState(() => {
        try {
            return storage?.getItem('calm-navigation-collapsed') === 'true';
        } catch {
            return false;
        }
    });
    const toggleSidebar = () => {
        const next = !collapsed;
        setCollapsed(next);
        try {
            storage?.setItem('calm-navigation-collapsed', String(next));
        } catch {
            // The menu remains usable when the browser blocks storage.
        }
    };
    return (
        <div className="flex flex-col h-screen overflow-hidden">
            <Navbar storage={storage} />
            <div className="flex flex-1 min-h-0">
                {persistent && (
                    <nav
                        aria-label="Main"
                        className={`${collapsed ? 'w-12' : 'w-60'} shrink-0 flex flex-col bg-base-100 text-base-content border-r-2 border-base-200`}
                        data-testid="navigation-sidebar"
                    >
                        <div className={`flex p-1 ${collapsed ? 'justify-center' : 'justify-end'}`}>
                            <button
                                type="button"
                                className="btn btn-ghost btn-sm btn-square"
                                aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
                                title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
                                aria-expanded={!collapsed}
                                aria-controls={menuId}
                                onClick={toggleSidebar}
                            >
                                {collapsed ? (
                                    <PanelLeftOpen className="h-5 w-5" aria-hidden="true" />
                                ) : (
                                    <PanelLeftClose className="h-5 w-5" aria-hidden="true" />
                                )}
                            </button>
                        </div>
                        <div id={menuId} hidden={collapsed} className={collapsed ? '' : 'flex flex-col flex-1 min-h-0'}>
                            <NavigationMenu />
                        </div>
                    </nav>
                )}
                {/* Its own stacking context, so the page's layers, such as Hub's mobile Explore panel, stay under
                    the navbar's open drawer and popovers. */}
                <div className="flex-1 min-w-0 flex flex-col overflow-hidden isolate">{children}</div>
            </div>
        </div>
    );
}
