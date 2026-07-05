import { useMemo } from 'react';
import { NamespaceCounts, DomainControlCount } from '../../../model/counts.js';
import { StatTile } from './StatTile.js';

interface LandingStatTilesProps {
    namespaceCounts: NamespaceCounts[];
    domainCounts: DomainControlCount[];
    /** When false the tiles show a placeholder instead of an all-zero flash. */
    loaded?: boolean;
}

/**
 * The 4-up catalogue stat tiles. Every value is derived from the counts Hub
 * already fetched — no extra request:
 *  - Namespaces  = number of namespaces
 *  - Architectures / Patterns = summed across namespaces
 *  - Controls    = summed across control domains
 */
export function LandingStatTiles({ namespaceCounts, domainCounts, loaded = true }: LandingStatTilesProps) {
    const totals = useMemo(() => {
        const architectures = namespaceCounts.reduce((sum, c) => sum + c.architectures, 0);
        const patterns = namespaceCounts.reduce((sum, c) => sum + c.patterns, 0);
        const controls = domainCounts.reduce((sum, d) => sum + d.controlCount, 0);
        return { namespaces: namespaceCounts.length, architectures, patterns, controls };
    }, [namespaceCounts, domainCounts]);

    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-[14px] max-w-[640px]">
            <StatTile value={totals.namespaces} label="Namespaces" accent loaded={loaded} />
            <StatTile value={totals.architectures} label="Architectures" loaded={loaded} />
            <StatTile value={totals.patterns} label="Patterns" loaded={loaded} />
            <StatTile value={totals.controls} label="Controls" loaded={loaded} />
        </div>
    );
}
