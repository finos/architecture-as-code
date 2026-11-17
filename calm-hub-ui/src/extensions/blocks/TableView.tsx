import { ReactNode, Ref } from 'react';
import { CellValue } from '../../model/extensions.js';
import { ScreenLink } from '../ScreenLink.js';
import { badgeClass } from '../tone.js';

function Cell({ value }: { value: CellValue }) {
    if (typeof value === 'string' || typeof value === 'number') {
        return <>{value}</>;
    }
    if ('badge' in value) {
        return <span className={`badge badge-sm badge-soft h-auto ${badgeClass(value.tone)}`}>{value.badge}</span>;
    }
    return <ScreenLink link={value} className="link link-primary font-semibold no-underline" />;
}

interface TableViewProps {
    columns: string[];
    rows: CellValue[][];
    /** A filtered table: its id is what the tiles and the search control, and it can take focus. */
    id?: string;
    tableRef?: Ref<HTMLTableElement>;
    busy?: boolean;
    /** Shown in one row when there are no rows, such as "No rows match these filters." */
    empty?: ReactNode;
}

export function TableView({ columns, rows, id, tableRef, busy, empty }: TableViewProps) {
    return (
        <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
            <table
                id={id}
                ref={tableRef}
                tabIndex={id ? -1 : undefined}
                aria-busy={busy || undefined}
                className={`table table-sm focus:outline-none${busy ? ' opacity-60' : ''}`}
            >
                <thead>
                    <tr>
                        {columns.map((column, index) => (
                            <th key={index}>{column}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, r) => (
                        <tr key={r}>
                            {row.map((cell, c) => (
                                <td key={c}>
                                    <Cell value={cell} />
                                </td>
                            ))}
                        </tr>
                    ))}
                    {rows.length === 0 && empty && (
                        <tr>
                            <td colSpan={Math.max(columns.length, 1)} className="text-center text-base-content/60">
                                {empty}
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
