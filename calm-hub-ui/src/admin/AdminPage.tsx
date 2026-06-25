import { NavLink, Outlet } from 'react-router-dom';
import { Navbar } from '../components/navbar/Navbar.js';
import { useUserAccess } from './context/UserAccessContext.js';
import { useIsMobile } from '../hooks/useMediaQuery.js';
import { colors } from '../theme/colors.js';

// One active-state system (redesign problem #8): both Admin nav surfaces use the
// redesign blue (`colors.redesign.primary`) inline — the same accent the browse
// rail and view tabs use. DaisyUI's `text-primary`/`menu-active` resolve to the
// global navy brand (`--color-primary` = #000063) / a neutral pill, so they are
// NOT used for the active accent here.
const ACTIVE = colors.redesign.primary;
const ACTIVE_TINT = colors.redesign.tintBg;

function sidebarNavClass({ isActive }: { isActive: boolean }) {
    return isActive ? 'font-semibold' : '';
}

function sidebarNavStyle({ isActive }: { isActive: boolean }) {
    return isActive ? { backgroundColor: ACTIVE_TINT, color: ACTIVE } : undefined;
}

function mobileTabClass({ isActive }: { isActive: boolean }) {
    return `flex-1 text-center py-2 text-sm border-b-2 transition-colors ${isActive ? 'font-semibold' : 'border-transparent hover:border-base-content/20'}`;
}

function mobileTabStyle({ isActive }: { isActive: boolean }) {
    return isActive ? { borderBottomColor: ACTIVE, color: ACTIVE } : undefined;
}

export function AdminPage() {
    const { loading, isGlobalAdmin, grants } = useUserAccess();
    const hasAdminAccess = isGlobalAdmin || grants.some((g) => g.permission === 'admin');
    const isMobile = useIsMobile();

    return (
        <div className="flex flex-col h-screen overflow-hidden">
            <Navbar />
            {loading ? (
                <div className="flex justify-center py-12">
                    <span className="loading loading-spinner loading-lg" aria-label="Loading" />
                </div>
            ) : !hasAdminAccess ? (
                <div className="flex flex-1 items-center justify-center p-6">
                    <div className="alert alert-error max-w-md" role="alert">
                        <span>You do not have permission to access the admin area.</span>
                    </div>
                </div>
            ) : (
                <>
                    {/* Mobile: tab bar for section navigation */}
                    {isMobile && (
                        <nav className="flex border-b border-base-300 bg-base-200" aria-label="Admin sections">
                            <NavLink to="namespaces" className={mobileTabClass} style={mobileTabStyle}>Namespaces</NavLink>
                            {isGlobalAdmin && <NavLink to="domains" className={mobileTabClass} style={mobileTabStyle}>Domains</NavLink>}
                            <NavLink to="entitlements" className={mobileTabClass} style={mobileTabStyle}>Entitlements</NavLink>
                        </nav>
                    )}

                    <div className="flex flex-1 overflow-hidden">
                        {/* Desktop: inline sidebar, always visible */}
                        {!isMobile && (
                            <aside className="w-52 bg-base-200 flex-shrink-0 border-r border-base-300">
                                <ul className="menu p-4 gap-1">
                                    <li><NavLink to="namespaces" className={sidebarNavClass} style={sidebarNavStyle}>Namespaces</NavLink></li>
                                    {isGlobalAdmin && <li><NavLink to="domains" className={sidebarNavClass} style={sidebarNavStyle}>Domains</NavLink></li>}
                                    <li><NavLink to="entitlements" className={sidebarNavClass} style={sidebarNavStyle}>Entitlements</NavLink></li>
                                </ul>
                            </aside>
                        )}
                        <main className="flex-1 overflow-auto bg-base-300 p-6">
                            <Outlet />
                        </main>
                    </div>
                </>
            )}
        </div>
    );
}
