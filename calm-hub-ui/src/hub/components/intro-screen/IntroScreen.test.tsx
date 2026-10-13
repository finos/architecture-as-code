import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, afterEach } from 'vitest';
import { IntroScreen } from './IntroScreen.js';
import { createMemoryStorage } from '../../../test-support/memory-storage.js';
import { THEME_STORAGE_KEY } from '../../../theme/useTheme.js';
import { NamespaceCounts, DomainControlCount } from '../../../model/counts.js';
import { UiConfigContext } from '../../../components/ui-config/UiConfigContext.js';
import { UiConfig } from '../../../model/ui-config.js';

const namespaceCounts: NamespaceCounts[] = [
    { namespace: 'finos', architectures: 2, patterns: 1, flows: 0, standards: 0, adrs: 0, interfaces: 0, total: 3 },
];
const domainCounts: DomainControlCount[] = [{ domain: 'security', controlCount: 3 }];

const LIGHT_LOGO = '/brand/Horizontal/2025_CALM_Horizontal.svg';
const DARK_LOGO = '/brand/Horizontal/2025_CALM_Horizontal_WHT.svg';

function renderIntro(storage: Storage, uiConfig: UiConfig = {}) {
    return render(
        <UiConfigContext.Provider value={uiConfig}>
            <MemoryRouter>
                <IntroScreen namespaceCounts={namespaceCounts} domainCounts={domainCounts} storage={storage} />
            </MemoryRouter>
        </UiConfigContext.Provider>
    );
}

/** Deterministic light theme regardless of the jsdom matchMedia default. */
function lightStorage() {
    const s = createMemoryStorage();
    s.setItem(THEME_STORAGE_KEY, 'light');
    return s;
}

function darkStorage() {
    const s = createMemoryStorage();
    s.setItem(THEME_STORAGE_KEY, 'dark');
    return s;
}

describe('IntroScreen', () => {
    afterEach(() => {
        // useTheme writes data-theme onto <html>; reset it between tests.
        document.documentElement.removeAttribute('data-theme');
    });

    it('renders the large horizontal logo, the search bar and the browse grid', () => {
        renderIntro(lightStorage());

        expect(screen.getByAltText('CALM')).toHaveAttribute('src', LIGHT_LOGO);
        expect(screen.getByLabelText('Search the architecture catalogue')).toBeInTheDocument();
        // The browse grid renders a tile per namespace.
        expect(screen.getByText('finos')).toBeInTheDocument();
    });

    it('shows the white logo on the dark theme', () => {
        renderIntro(darkStorage());
        expect(screen.getByAltText('CALM')).toHaveAttribute('src', DARK_LOGO);
    });

    it('swaps the logo when the corner theme toggle is pressed', () => {
        renderIntro(lightStorage());
        expect(screen.getByAltText('CALM')).toHaveAttribute('src', LIGHT_LOGO);

        fireEvent.click(screen.getByLabelText('Switch to dark theme'));

        expect(screen.getByAltText('CALM')).toHaveAttribute('src', DARK_LOGO);
    });

    it('renders at a mobile viewport (responsive, no layout branch)', () => {
        // IntroScreen has no isMobile branch — it lays out responsively — but per
        // AGENTS.md the change is verified at a mobile width too. Seeded light so the
        // mobile matchMedia default cannot flip the theme.
        const original = window.matchMedia;
        window.matchMedia = ((query: string) => ({
            matches: true,
            media: query,
            onchange: null,
            addEventListener: () => {},
            removeEventListener: () => {},
            addListener: () => {},
            removeListener: () => {},
            dispatchEvent: () => false,
        })) as unknown as typeof window.matchMedia;
        try {
            renderIntro(lightStorage());
            expect(screen.getByAltText('CALM')).toHaveAttribute('src', LIGHT_LOGO);
            expect(screen.getByLabelText('Search the architecture catalogue')).toBeInTheDocument();
            expect(screen.getByText('finos')).toBeInTheDocument();
        } finally {
            window.matchMedia = original;
        }
    });
});

describe('IntroScreen environment pill', () => {
    it('shows no pill when no environment is configured', () => {
        renderIntro(createMemoryStorage());
        expect(screen.queryByTestId('environment-pill')).not.toBeInTheDocument();
    });

    it('shows the pill when an environment is configured', () => {
        renderIntro(createMemoryStorage(), { environment: { name: 'PROD', colour: 'error' } });
        expect(screen.getByTestId('environment-pill')).toHaveTextContent('PROD');
    });
});
