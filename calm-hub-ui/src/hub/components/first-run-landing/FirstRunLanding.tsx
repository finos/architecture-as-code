import { colors } from '../../../theme/colors.js';
import { NamespaceCounts, DomainControlCount } from '../../../model/counts.js';
import { LandingStatTiles } from './LandingStatTiles.js';
import { CatalogueHighlights } from './CatalogueHighlights.js';
import { useCatalogueHighlights } from './useCatalogueHighlights.js';

interface FirstRunLandingProps {
    namespaceCounts: NamespaceCounts[];
    domainCounts: DomainControlCount[];
    /**
     * Whether the namespace counts fetch has settled. While `false` the stat
     * tiles show a placeholder rather than a misleading all-zero flash before the
     * real catalogue totals arrive.
     */
    countsLoaded?: boolean;
}

/**
 * First-run / empty landing (redesign problem #7) — replaces the ~75% blank grey
 * canvas shown on `/` when nothing is loaded. Heading + sub-paragraph, the 4-up
 * catalogue stat tiles (values from the counts Hub already holds), and a small
 * honest sample of real catalogue items (NOT "recently updated" — see
 * {@link useCatalogueHighlights}).
 *
 * Desktop-first per Frame 01, but lays out responsively (tiles + cards stack on
 * narrow widths). On mobile the drill-down overlay covers `/`; this sits behind it
 * and shows when that drawer is closed, so it must not break at small widths.
 */
export function FirstRunLanding({
    namespaceCounts,
    domainCounts,
    countsLoaded = true,
}: FirstRunLandingProps) {
    const { highlights, loading } = useCatalogueHighlights(namespaceCounts);

    return (
        <div
            data-testid="first-run-landing"
            className="h-full overflow-auto bg-base-100"
            style={{ padding: '44px 48px' }}
        >
            <div className="flex flex-col gap-8">
                <header>
                    <h1 className="text-[32px] font-bold" style={{ color: colors.redesign.ink }}>
                        Explore the architecture catalogue
                    </h1>
                    <p
                        className="text-[15px] mt-3 max-w-[520px]"
                        style={{ color: colors.redesign.muted }}
                    >
                        Browse versioned CALM artefacts across your namespaces, or pick up where you
                        left off — every architecture, pattern and control is one click away.
                    </p>
                </header>

                <LandingStatTiles
                    namespaceCounts={namespaceCounts}
                    domainCounts={domainCounts}
                    loaded={countsLoaded}
                />

                <CatalogueHighlights highlights={highlights} loading={loading} />
            </div>
        </div>
    );
}
