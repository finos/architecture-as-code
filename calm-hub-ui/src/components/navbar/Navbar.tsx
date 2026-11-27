import './Navbar.css';
import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { IoCloseOutline, IoMenuOutline } from 'react-icons/io5';
import { GlobalSearchBar } from './GlobalSearchBar.js';
import { ThemeToggle } from './ThemeToggle.js';
import { useTheme } from '../../theme/useTheme.js';
import { UserMenu } from '../user-menu/UserMenu.js';
import { isAuthServiceEnabled } from '../../authService.js';
import { useUiConfig } from '../ui-config/UiConfigContext.js';
import { EnvironmentPill } from './EnvironmentPill.js';
import { BrandLockup } from '../branding/BrandLockup.js';
import { useProductName } from '../branding/brand-names.js';
import { NavigationMenu } from '../navigation/NavigationMenu.js';
import { usePersistentNavigation } from '../navigation/navigation-settings.js';

interface NavbarProps {
    /** Injected for tests; see the storage note in calm-hub-ui/AGENTS.md. */
    storage?: Storage;
}

export function Navbar({ storage }: NavbarProps = {}) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const { theme, toggleTheme } = useTheme(storage);
    const { environment } = useUiConfig();
    const productName = useProductName();
    // In the sidebar layout on a wide screen, AppLayout shows the menu, so the navbar has no drawer.
    const persistent = usePersistentNavigation();
    if (persistent && isMenuOpen) setIsMenuOpen(false);

    const closeMenu = () => setIsMenuOpen(false);

    // The drawer is a modal dialog, so the page and the rest of the navbar are inert while it is open: a click
    // outside it only closes it. It gives the focus to its close button, and back to the menu button when it closes.
    const menuButtonRef = useRef<HTMLButtonElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const drawerRef = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        const drawer = drawerRef.current;
        if (!drawer || drawer.open === isMenuOpen) return;
        // jsdom does not have showModal or close.
        if (isMenuOpen) {
            if (typeof drawer.showModal === 'function') drawer.showModal();
            else drawer.setAttribute('open', '');
            closeButtonRef.current?.focus();
        } else {
            if (typeof drawer.close === 'function') drawer.close();
            else drawer.removeAttribute('open');
            menuButtonRef.current?.focus();
        }
    }, [isMenuOpen]);

    function onDrawerKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
        if (event.key === 'Tab') {
            const controls = event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (document.activeElement === (event.shiftKey ? first : last)) {
                event.preventDefault();
                (event.shiftKey ? last : first).focus();
            }
        }
    }

    return (
        <div className="navbar bg-base-100 border-b-2 border-base-200 text-primary-content gap-1 lg:grid lg:grid-cols-[minmax(auto,1fr)_auto_minmax(auto,1fr)]">
            {/* The logo is never absolutely positioned, so it cannot be covered. Equal
                flexible sides keep it centred; a side that needs more room than half
                the bar pushes it aside. Below lg this is flex-1, from lg a grid
                (daisyUI's 50% side width and min-w-0 would let the sides overlap it). */}
            <div className="navbar-start flex items-center gap-1 w-auto max-lg:flex-1">
                {!persistent && (
                    <button
                        ref={menuButtonRef}
                        // Narrower on mobile with a pill, which must fit beside the centred logo.
                        className={`btn btn-ghost gap-2 text-primary shrink-0${environment ? ' px-2 lg:px-4' : ''}`}
                        onClick={() => setIsMenuOpen(true)}
                        aria-label="Open menu"
                        aria-expanded={isMenuOpen}
                    >
                        <IoMenuOutline className="h-5 w-5" />
                    </button>
                )}
                {environment && <EnvironmentPill environment={environment} />}
            </div>
            <div className="navbar-center min-w-0 max-lg:shrink">
                <Link to="/" className="btn btn-ghost min-w-0 max-w-full px-1 max-lg:shrink" aria-label={`${productName} home`}>
                    <BrandLockup theme={theme} size="navbar" />
                </Link>
            </div>
            <div className="navbar-end flex items-center gap-1 shrink-0 w-auto max-lg:flex-1">
                {/* Portal target for page-level actions (e.g. the diagram's
                    view-options menu), always visible across breakpoints. */}
                <div id="navbar-actions" className="flex items-center" />
                <ThemeToggle theme={theme} onToggle={toggleTheme} />
                <div className="hidden lg:flex items-center">
                    <GlobalSearchBar />
                </div>
                {isAuthServiceEnabled() && <UserMenu />}
            </div>

            {!persistent && (
                <dialog
                    ref={drawerRef}
                    aria-label="Menu"
                    className="navbar-drawer fixed left-0 top-16 bottom-0 m-0 h-auto max-h-none w-64 max-w-none border-0 p-0 bg-base-100 text-base-content shadow-xl"
                    // Escape. preventDefault keeps the state in charge; the browser can still close the dialog itself.
                    onCancel={(event) => {
                        event.preventDefault();
                        closeMenu();
                    }}
                    onClose={closeMenu}
                    // The content fills the dialog, so only a click on the backdrop has the dialog as its target.
                    onClick={(event) => event.target === event.currentTarget && closeMenu()}
                    onKeyDown={onDrawerKeyDown}
                >
                    <div className="flex h-full flex-col">
                        <div className="flex items-center gap-2 border-b border-base-200 py-2 pl-4 pr-2">
                            <h2 className="flex-1 font-semibold">Menu</h2>
                            <button ref={closeButtonRef} aria-label="Close menu" className="btn btn-ghost btn-sm btn-circle" onClick={closeMenu}>
                                <IoCloseOutline size={22} />
                            </button>
                        </div>
                        <NavigationMenu onNavigate={closeMenu} />
                    </div>
                </dialog>
            )}
        </div>
    );
}
