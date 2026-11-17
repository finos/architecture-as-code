import { TableBlockValue } from '../../model/extensions.js';
import { useBlockScope } from './BlockScope.js';
import { FilteredTable } from './FilteredTable.js';
import { hasFilters } from './tableFilters.js';
import { TableView } from './TableView.js';

export function TableBlock({ block }: { block: TableBlockValue }) {
    const scope = useBlockScope();
    if (scope && hasFilters(block, scope.blocks, scope.tables)) {
        return <FilteredTable block={block} scope={scope} />;
    }
    return <TableView columns={block.columns} rows={block.rows} />;
}
