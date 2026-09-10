import { NamespaceCounts, DomainControlCount } from '../../../model/counts.js';
import { useTheme } from '../../../theme/useTheme.js';
import { ThemeToggle } from '../../../components/navbar/ThemeToggle.js';
import { UserMenu } from '../../../components/user-menu/UserMenu.js';
import { isAuthServiceEnabled } from '../../../authService.js';
import { IntroSearchBar } from './IntroSearchBar.js';
import { IntroBrowse } from './IntroBrowse.js';

/** The navy lockup is unreadable on a dark base, so dark gets the white variant. */
const LOGO_SRC = {
    light: '/brand/Horizontal/2025_CALM_Horizontal.svg',
    dark: '/brand/Horizontal/2025_CALM_Horizontal_WHT.svg',
} as const;

interface IntroScreenProps {
    namespaceCounts: NamespaceCounts[];
    domainCounts: DomainControlCount[];
    /** Injected for tests; see the storage note in calm-hub-ui/AGENTS.md. */
    storage?: Storage;
}

/**
 * The search-first intro / front door shown on `/`. Deliberately chrome-free (no
 * navbar, no rail), so it mounts its own `useTheme` for the corner toggle — the
 * navbar, which normally owns theme state, is hidden here.
 */
export function IntroScreen({ namespaceCounts, domainCounts, storage }: IntroScreenProps) {
    const { theme, toggleTheme } = useTheme(storage);

    return (
        <div data-testid="intro-screen" className="relative h-screen overflow-auto bg-base-100">
            <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
                <ThemeToggle theme={theme} onToggle={toggleTheme} />
                {isAuthServiceEnabled() && <UserMenu />}
            </div>

            <div className="min-h-full flex flex-col items-center px-6 py-16 sm:py-24">
                {/* No `logo` navbar helper class here: its global `max-width: 100%`
                    rule loads after Tailwind and would override the cap below,
                    letting the lockup span the whole column. */}
                <img
                    src={LOGO_SRC[theme]}
                    alt="CALM"
                    className="h-auto w-[420px] sm:w-[520px] max-w-full"
                />

                <div className="w-full flex justify-center mt-10 sm:mt-12">
                    <IntroSearchBar />
                </div>

                <div className="w-full flex justify-center mt-14 sm:mt-16">
                    <IntroBrowse namespaceCounts={namespaceCounts} domainCounts={domainCounts} />
                </div>
            </div>
        </div>
    );
}
