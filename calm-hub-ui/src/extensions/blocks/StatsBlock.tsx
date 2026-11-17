import { StatFilter, StatItem } from '../../model/extensions.js';
import { BlockScope, useBlockScope } from './BlockScope.js';
import { activeFilter, NO_FILTERS, usableFilter } from './tableFilters.js';

const tileClass = 'min-w-0 rounded-box border border-base-300 bg-base-100 px-4 py-3';

function Figure({ item }: { item: StatItem }) {
    return (
        <>
            <div className="text-2xl font-bold wrap-anywhere">{item.value}</div>
            <div className="text-sm text-base-content/60 wrap-anywhere">{item.label}</div>
        </>
    );
}

/** A tile that filters its table. Without a filter `id`, it shows all rows, and it is selected while no tile filters. */
function FilterTile({ item, filter, scope }: { item: StatItem; filter: StatFilter; scope: BlockScope }) {
    const state = scope.state.get(filter.table);
    const selected = filter.id === activeFilter(scope.blocks, scope.tables, filter.table, state)?.id;
    const choose = () =>
        // A second press on a selected filter shows all rows again. The search text stays; the page starts again.
        scope.state.update(filter.table, (current) => ({
            ...current,
            filter: filter.id === activeFilter(scope.blocks, scope.tables, filter.table, current)?.id ? undefined : filter.id,
            page: NO_FILTERS.page,
        }));
    return (
        <button
            type="button"
            aria-pressed={selected}
            aria-controls={`${scope.domId}-${filter.table}`}
            onClick={choose}
            className={`${tileClass} text-left cursor-pointer transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                selected ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary [&_div]:text-primary' : ''
            }`}
        >
            <Figure item={item} />
        </button>
    );
}

export function StatsBlock({ items }: { items: StatItem[] }) {
    const scope = useBlockScope();
    return (
        <div className="grid grid-cols-1 @3xs:grid-cols-2 @sm:grid-cols-3 gap-3">
            {items.map((item, index) => {
                const filter = scope ? usableFilter(item.filter, scope.tables) : undefined;
                return filter && scope ? (
                    <FilterTile key={index} item={item} filter={filter} scope={scope} />
                ) : (
                    <div key={index} className={tileClass}>
                        <Figure item={item} />
                    </div>
                );
            })}
        </div>
    );
}
