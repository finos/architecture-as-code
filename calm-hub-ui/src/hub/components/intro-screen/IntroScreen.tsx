import { useResolvedTheme, useTheme } from '../../../theme/useTheme.js';
import { ThemeToggle } from '../../../components/navbar/ThemeToggle.js';
import { UserMenu } from '../../../components/user-menu/UserMenu.js';
import { isAuthServiceEnabled } from '../../../authService.js';
import { EnvironmentPill } from '../../../components/navbar/EnvironmentPill.js';
import { useUiConfig } from '../../../components/ui-config/UiConfigContext.js';
import { IntroBody, IntroBodyProps } from './IntroBody.js';

interface IntroScreenProps extends IntroBodyProps {
    /** Inside the app layout, which has the navbar, so the page has no controls of its own. */
    embedded?: boolean;
    /** Injected for tests; see the storage note in calm-hub-ui/AGENTS.md. */
    storage?: Storage;
}

/**
 * The search-first intro / front door shown on `/`. Without `embedded` it is chrome-free (no navbar, no rail), so it
 * mounts its own `useTheme` for the corner toggle — the navbar, which normally owns theme state, is hidden here.
 */
export function IntroScreen({ embedded, storage, ...body }: IntroScreenProps) {
    return embedded ? <EmbeddedIntro {...body} /> : <StandaloneIntro storage={storage} {...body} />;
}

/** The navbar owns the theme here, so this only reads it: a second `useTheme` would drift from the toggle. */
function EmbeddedIntro(body: IntroBodyProps) {
    const theme = useResolvedTheme();
    return (
        <div data-testid="intro-screen" className="h-full overflow-auto bg-base-100">
            <IntroBody {...body} theme={theme} />
        </div>
    );
}

function StandaloneIntro({ storage, ...body }: IntroBodyProps & { storage?: Storage }) {
    const { theme, toggleTheme } = useTheme(storage);
    const { environment } = useUiConfig();

    return (
        <div data-testid="intro-screen" className="relative h-screen overflow-auto bg-base-100">
            {environment && (
                <div className="absolute top-4 left-4 z-10 flex items-center h-8">
                    <EnvironmentPill environment={environment} />
                </div>
            )}
            <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
                <ThemeToggle theme={theme} onToggle={toggleTheme} />
                {isAuthServiceEnabled() && <UserMenu />}
            </div>

            <IntroBody {...body} theme={theme} />
        </div>
    );
}
