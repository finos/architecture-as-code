import { ItemCard } from '../namespace-page/ItemCard.js';
import type { CatalogueHighlight } from './useCatalogueHighlights.js';

interface CatalogueCardProps {
    item: CatalogueHighlight;
}

/**
 * A catalogue-highlight card for the landing's "Browse the catalogue" strip. Reuses
 * {@link ItemCard} (compact thumbnail, the namespace as the mono meta chip) rather
 * than duplicating the card shell.
 *
 * It links to the item's namespace page (not its detail route): the detail route
 * needs the latest version, which is only resolvable via a per-item fetch — an
 * N+1 the landing must avoid. The namespace page resolves the version on click.
 */
export function CatalogueCard({ item }: CatalogueCardProps) {
    const tabParam = item.type === 'Patterns' ? 'patterns' : 'architectures';
    return (
        <ItemCard
            name={item.name}
            type={item.type}
            meta={item.namespace}
            thumbnailHeight={64}
            testId="catalogue-card"
            href={`/namespace/${item.namespace}?type=${tabParam}`}
        />
    );
}
