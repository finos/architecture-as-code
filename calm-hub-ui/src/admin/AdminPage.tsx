import { NavLink, Outlet } from 'react-router-dom';
import { Navbar } from '../components/navbar/Navbar.js';

function navClass({ isActive }: { isActive: boolean }) {
    return isActive ? 'active' : '';
}

export function AdminPage() {
    return (
        <div className="flex flex-col h-screen overflow-hidden">
            <Navbar />
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
        </div>
    );
}
