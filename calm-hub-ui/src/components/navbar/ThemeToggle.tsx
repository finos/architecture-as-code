import { IoMoonOutline, IoSunnyOutline } from 'react-icons/io5';
import type { Theme } from '../../theme/useTheme.js';

interface ThemeToggleProps {
    theme: Theme;
    onToggle: () => void;
}

/**
 * Flips the app between the light and dark themes. Presentational: the Navbar owns
 * the `useTheme` state, because the logo swaps with the theme too and two separate
 * `useTheme` calls would hold independent state and drift apart on toggle.
 *
 * Rendered at every breakpoint — it sits outside the `hidden lg:flex` cluster that
 * holds the search bar, so it stays reachable on mobile.
 */
export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';

    return (
        <button
            className="btn btn-ghost btn-square shrink-0"
            onClick={onToggle}
            aria-label={`Switch to ${nextTheme} theme`}
            title={`Switch to ${nextTheme} theme`}
        >
            {theme === 'dark' ? (
                <IoSunnyOutline className="h-5 w-5" aria-hidden="true" />
            ) : (
                <IoMoonOutline className="h-5 w-5" aria-hidden="true" />
            )}
        </button>
    );
}
