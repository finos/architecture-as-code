import { NavLink, Outlet } from 'react-router-dom';
import { Navbar } from '../components/navbar/Navbar.js';
import { useUserAccess } from './context/UserAccessContext.js';

function navClass({ isActive }: { isActive: boolean }) {
    return isActive ? 'active' : '';
}

export function AdminPage() {
    const { loading, isGlobalAdmin, grants } = useUserAccess();
    const hasAdminAccess = isGlobalAdmin || grants.some((g) => g.permission === 'admin');

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
                <div className="flex flex-1 overflow-hidden">
                    <aside className="w-52 bg-base-200 flex-shrink-0 border-r border-base-300">
                        <ul className="menu p-4 gap-1">
                            <li><NavLink to="namespaces" className={navClass}>Namespaces</NavLink></li>
                            <li><NavLink to="domains" className={navClass}>Domains</NavLink></li>
                            <li><NavLink to="entitlements" className={navClass}>Entitlements</NavLink></li>
                        </ul>
                    </aside>
                    <main className="flex-1 overflow-auto bg-base-300 p-6">
                        <Outlet />
                    </main>
                </div>
            )}
        </div>
    );
}
