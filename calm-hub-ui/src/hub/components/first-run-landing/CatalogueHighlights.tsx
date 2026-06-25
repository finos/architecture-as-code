import { colors } from '../../../theme/colors.js';
import { CatalogueCard } from './CatalogueCard.js';
import type { CatalogueHighlight } from './useCatalogueHighlights.js';

interface CatalogueHighlightsProps {
    highlights: CatalogueHighlight[];
    loading: boolean;
}

/**
 * The landing's "Browse the catalogue" section: a mono section label and up to
 * three real {@link CatalogueCard}s.
 *
 * Honesty note: deliberately labelled "Browse the catalogue" — NOT "Recently
 * updated". There is no recency signal in the API, so the items are a genuine
 * sample of real architectures, not an (un)ordered "recent" list. Renders nothing
 * when there are no items (a brand-new, empty hub).
 */
export function CatalogueHighlights({ highlights, loading }: CatalogueHighlightsProps) {
    if (loading) {
        return (
            <div className="flex items-center gap-2 py-2">
                <span className="loading loading-spinner loading-sm text-base-content/40" />
            </div>
        );
    }

    if (highlights.length === 0) return null;

    return (
        <section>
            <div
                className="font-mono-jb text-[11px] uppercase tracking-[0.1em] mb-3"
                style={{ color: colors.redesign.faintAlt }}
            >
                Browse the catalogue
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-[640px]">
                {highlights.map((item) => (
                    // Architectures and patterns carry independent per-namespace id
                    // sequences, so the type is part of the key to avoid a collision
                    // when both share a numeric id within one namespace.
                    <CatalogueCard key={`${item.type}/${item.namespace}/${item.id}`} item={item} />
                ))}
            </div>
        </section>
    );
}
