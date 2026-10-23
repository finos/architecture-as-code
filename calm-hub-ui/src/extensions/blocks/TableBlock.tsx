import { CellValue } from '../../model/extensions.js';
import { ScreenLink } from '../ScreenLink.js';
import { BADGE_CLASS } from '../tone.js';

function Cell({ value }: { value: CellValue }) {
    if (typeof value === 'string' || typeof value === 'number') {
        return <>{value}</>;
    }
    if ('badge' in value) {
        return <span className={`badge badge-sm badge-soft ${BADGE_CLASS[value.tone ?? 'neutral']}`}>{value.badge}</span>;
    }
    return <ScreenLink link={value} className="link link-primary font-semibold no-underline" />;
}

export function TableBlock({ columns, rows }: { columns: string[]; rows: CellValue[][] }) {
    return (
        <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
            <table className="table table-sm">
                <thead>
                    <tr>
                        {columns.map((column) => (
                            <th key={column}>{column}</th>
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
                </tbody>
            </table>
        </div>
    );
}
