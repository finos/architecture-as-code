import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { IoCloseOutline } from 'react-icons/io5';
import { Navbar } from '../components/navbar/Navbar.js';
import { useUserAccess } from './context/UserAccessContext.js';
import { useIsMobile } from '../hooks/useMediaQuery.js';

function sidebarNavClass({ isActive }: { isActive: boolean }) {
    return isActive ? 'active' : '';
}

function mobileNavClass({ isActive }: { isActive: boolean }) {
    return `w-full flex items-center px-4 py-3 text-left hover:bg-base-200 active:bg-base-200${isActive ? ' bg-base-200 font-semibold' : ''}`;
}

export function AdminPage() {
    const { loading, isGlobalAdmin, grants } = useUserAccess();
    const hasAdminAccess = isGlobalAdmin || grants.some((g) => g.permission === 'admin');
    const isMobile = useIsMobile();
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

    const closeMobileNav = () => setIsMobileNavOpen(false);

    return (
        <div className="flex flex-col h-screen overflow-hidden">
            <Navbar onExploreClick={isMobile ? () => setIsMobileNavOpen(true) : undefined} />
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
                    {/* Mobile: full-screen overlay that slides in from the left */}
                    {isMobile && (
                        <div
                            className={`fixed inset-0 z-40 bg-base-100 flex flex-col transition-transform duration-300 ${isMobileNavOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'}`}
                            role="dialog"
                            aria-modal={isMobileNavOpen}
                            aria-hidden={!isMobileNavOpen}
                            inert={!isMobileNavOpen}
                        >
                            <div className="bg-base-200 px-3 py-3 border-b border-base-300 flex items-center gap-2">
                                <h2 className="text-lg font-semibold flex-1 min-w-0 truncate">Admin</h2>
                                <button
                                    aria-label="Close navigation"
                                    className="btn btn-ghost btn-sm btn-circle"
                                    onClick={closeMobileNav}
                                >
                                    <IoCloseOutline size={22} />
                                </button>
                            </div>
                            <ul className="flex-1 overflow-auto divide-y divide-base-200">
                                <li>
                                    <NavLink to="namespaces" className={mobileNavClass} onClick={closeMobileNav}>
                                        Namespaces
                                    </NavLink>
                                </li>
                                {isGlobalAdmin && (
                                    <li>
                                        <NavLink to="domains" className={mobileNavClass} onClick={closeMobileNav}>
                                            Domains
                                        </NavLink>
                                    </li>
                                )}
                                <li>
                                    <NavLink to="entitlements" className={mobileNavClass} onClick={closeMobileNav}>
                                        Entitlements
                                    </NavLink>
                                </li>
                            </ul>
                        </div>
                    )}

                    <div className="flex flex-1 overflow-hidden">
                        {/* Desktop: inline sidebar, always visible */}
                        {!isMobile && (
                            <aside className="w-52 bg-base-200 flex-shrink-0 border-r border-base-300">
                                <ul className="menu p-4 gap-1">
                                    <li><NavLink to="namespaces" className={sidebarNavClass}>Namespaces</NavLink></li>
                                    {isGlobalAdmin && <li><NavLink to="domains" className={sidebarNavClass}>Domains</NavLink></li>}
                                    <li><NavLink to="entitlements" className={sidebarNavClass}>Entitlements</NavLink></li>
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
