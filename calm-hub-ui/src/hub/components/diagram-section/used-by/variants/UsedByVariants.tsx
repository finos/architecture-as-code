import { UsedByPanel } from '../UsedByPanel.js';
import type { ImplementationsState } from '../usePatternImplementations.js';
import { TableVariant } from './TableVariant.js';
import { NamespacesVariant } from './NamespacesVariant.js';
import { CardsVariant } from './CardsVariant.js';
import { SectionsVariant } from './SectionsVariant.js';

/** Design exploration only: picks a layout from `?variant=`. Remove before review. */
export function UsedByVariants({ state, variant }: { state: ImplementationsState; variant: string | null }) {
    if (state.status !== 'loaded' || state.implementations.length === 0) return <UsedByPanel state={state} />;
    const rows = state.implementations;
    switch (variant) {
        case 'table':
            return <TableVariant rows={rows} />;
        case 'namespaces':
            return <NamespacesVariant rows={rows} />;
        case 'cards':
            return <CardsVariant rows={rows} />;
        case 'sections':
            return <SectionsVariant rows={rows} />;
        case 'card':
            return <UsedByPanel state={state} />;
        default:
            return <NamespacesVariant rows={rows} />;
    }
}
