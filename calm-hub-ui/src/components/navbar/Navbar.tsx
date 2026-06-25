import './Navbar.css';
import { useContext, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { IoMenuOutline } from 'react-icons/io5';
import { GlobalSearchBar } from './GlobalSearchBar.js';
import { UserAccessContext } from '../../admin/context/UserAccessContext.js';

function menuNavClass({ isActive }: { isActive: boolean }) {
    return `w-full flex items-center px-4 py-3 text-left hover:bg-base-200 active:bg-base-200${isActive ? ' bg-base-200 font-semibold' : ''}`;
}

export function Navbar() {
    const { loading, isGlobalAdmin, grants } = useContext(UserAccessContext);
    const showAdminLink = !loading && (isGlobalAdmin || grants.some((g) => g.permission === 'admin'));
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const closeMenu = () => setIsMenuOpen(false);

    return (
        <div className="navbar relative bg-base-100 border-b-2 border-base-200 text-primary-content gap-1">
            <div className="navbar-start flex items-center gap-1 min-w-0">
                <button
                    className="btn btn-ghost gap-2 text-primary shrink-0"
                    onClick={() => setIsMenuOpen((v) => !v)}
                    aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
                >
                    <IoMenuOutline className="h-5 w-5" />
                </button>
            </div>
            <div className="navbar-center absolute left-1/2 -translate-x-1/2">
                <Link to="/" className="btn btn-ghost min-w-0 px-1" aria-label="CALM Hub home">
                    <img
                        src="/brand/Horizontal/2025_CALM_Horizontal_Navbar_Logo.svg"
                        alt="CALM Logo"
                        className="h-10 logo"
                    />
                </Link>
            </div>
            <div className="navbar-end flex items-center gap-1 min-w-0 shrink-0">
                {/* Portal target for page-level actions (e.g. the diagram's
                    view-options menu), always visible across breakpoints. */}
                <div id="navbar-actions" className="flex items-center" />
                <div className="hidden lg:flex items-center">
                    <GlobalSearchBar />
                </div>
            </div>

            {/* Backdrop — dims the page behind the drawer; tap to close */}
            <div
                className={`fixed inset-x-0 bottom-0 top-16 z-40 bg-black/30 transition-opacity duration-300 ${isMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                aria-hidden="true"
                onClick={closeMenu}
            />

            {/* Destinations drawer — slides in from the left */}
            <div
                className={`fixed left-0 bottom-0 top-16 z-40 w-64 bg-base-100 text-base-content flex flex-col shadow-xl transition-transform duration-300 ${isMenuOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'}`}
                role="dialog"
                aria-modal={isMenuOpen}
                aria-hidden={!isMenuOpen}
                inert={!isMenuOpen}
            >
                <ul className="flex-1 overflow-auto divide-y divide-base-200">
                    <li>
                        <NavLink to="/" className={menuNavClass} onClick={closeMenu} end>
                            Hub
                        </NavLink>
                    </li>
                    <li>
                        <NavLink to="/visualizer" className={menuNavClass} onClick={closeMenu}>
                            Visualizer
                        </NavLink>
                    </li>
                    {showAdminLink && (
                        <li>
                            <NavLink to="/admin" className={menuNavClass} onClick={closeMenu}>
                                Admin
                            </NavLink>
                        </li>
                    )}
                </ul>
            </div>
        </div>
    );
}
