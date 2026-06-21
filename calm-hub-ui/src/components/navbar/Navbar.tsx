import './Navbar.css';
import { Link, NavLink } from 'react-router-dom';
import { IoMenuOutline } from 'react-icons/io5';
import { GlobalSearchBar } from './GlobalSearchBar.js';

interface NavbarProps {
    /**
     * When provided, renders an "Explore" button in the navbar that toggles the
     * navigation/explorer (the desktop sidebar, or the mobile drill-down panel).
     * Pages without an explorer (e.g. the Visualizer) omit this.
     */
    onExploreClick?: () => void;
}

export function Navbar({ onExploreClick }: NavbarProps) {
    return (
        <div className="navbar relative bg-base-100 border-b-2 border-base-200 text-primary-content gap-1">
            <div className="navbar-start flex items-center gap-1 min-w-0">
                {onExploreClick && (
                    <button
                        className="btn btn-ghost gap-2 text-primary shrink-0"
                        onClick={onExploreClick}
                        aria-label="Toggle explorer"
                    >
                        <IoMenuOutline className="h-5 w-5" />
                        <span className="hidden sm:inline">Explore</span>
                    </button>
                )}
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
                {/* Desktop keeps the Visualizer link and search in the navbar; on
                    mobile both live inside the explorer panel instead, so they are
                    hidden here below the lg breakpoint. */}
                <div className="hidden lg:flex items-center gap-1">
                    <NavLink className="btn btn-ghost text-primary" to="/visualizer">
                        Visualizer
                    </NavLink>
                    <GlobalSearchBar />
                </div>
            </div>
        </div>
    );
}
