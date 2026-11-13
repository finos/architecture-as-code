import type { ReactNode } from 'react';
import { classifyValue, describeSize, formatDate, isPlainObject, type FlatObject, type Primitive } from './value-shape.js';

/** Branches at this depth and deeper start collapsed. */
const OPEN_DEPTH = 1;

const muted = 'text-base-content/50 italic';

function isBranch(value: unknown): boolean {
    return (Array.isArray(value) && value.length > 0) || (isPlainObject(value) && Object.keys(value).length > 0);
}

function Branch({ label, value, depth }: { label: ReactNode; value: unknown; depth: number }) {
    return (
        <details open={depth < OPEN_DEPTH} className="group">
            <summary className="cursor-pointer select-none text-xs font-medium text-base-content/70">
                {label} <span className="text-base-content/40 font-normal">· {describeSize(value)}</span>
            </summary>
            <div className="mt-1 ml-1 pl-3 border-l border-base-300">
                <DecoratorValue value={value} depth={depth + 1} />
            </div>
        </details>
    );
}

function Table({ columns, rows }: { columns: string[]; rows: FlatObject[] }) {
    return (
        <div className="overflow-x-auto">
            <table className="table table-xs">
                <thead>
                    <tr>
                        {columns.map((column) => (
                            <th key={column}>{column}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, index) => (
                        <tr key={index}>
                            {columns.map((column) => (
                                <td key={column}>
                                    {Object.hasOwn(row, column) ? <DecoratorValue value={row[column]} /> : null}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function List({ items }: { items: Primitive[] }) {
    return (
        <ul className="list-disc ml-4 flex flex-col gap-0.5">
            {items.map((item, index) => (
                <li key={index}>
                    <DecoratorValue value={item} />
                </li>
            ))}
        </ul>
    );
}

function Entries({ entries, depth }: { entries: [string, unknown][]; depth: number }) {
    return (
        <dl className="grid grid-cols-[minmax(4rem,max-content)_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-xs">
            {entries.map(([key, value]) =>
                isBranch(value) ? (
                    <div key={key} className="col-span-2">
                        <Branch label={key} value={value} depth={depth} />
                    </div>
                ) : (
                    <div key={key} className="contents">
                        <dt className="text-base-content/50 font-medium break-all">{key}</dt>
                        <dd className="min-w-0">
                            <DecoratorValue value={value} depth={depth + 1} />
                        </dd>
                    </div>
                )
            )}
        </dl>
    );
}

/** Renders any JSON value by its shape. Decorator `data` can hold any JSON at any depth. */
export function DecoratorValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
    const shape = classifyValue(value);
    switch (shape.kind) {
        case 'empty':
            return <span className={muted}>null</span>;
        case 'boolean':
            return <span className="badge badge-ghost badge-sm font-mono">{String(shape.value)}</span>;
        case 'number':
            return <span className="font-mono tabular-nums">{shape.value}</span>;
        case 'url':
            return (
                <a href={shape.value} target="_blank" rel="noopener noreferrer" className="link link-primary break-all">
                    {shape.value}
                </a>
            );
        case 'date':
            return (
                <time dateTime={shape.value} title={shape.value}>
                    {formatDate(shape.value, shape.dateOnly)}
                </time>
            );
        case 'text':
            return <span className="whitespace-pre-wrap break-words">{shape.value}</span>;
        case 'list':
            return <List items={shape.items} />;
        case 'table':
            return <Table columns={shape.columns} rows={shape.rows} />;
        case 'array':
            if (shape.items.length === 0) return <span className={muted}>Empty list</span>;
            return (
                <ol className="flex flex-col gap-1">
                    {shape.items.map((item, index) => (
                        <li key={index}>
                            {isBranch(item) ? (
                                <Branch label={`Item ${index + 1}`} value={item} depth={depth} />
                            ) : (
                                <DecoratorValue value={item} depth={depth + 1} />
                            )}
                        </li>
                    ))}
                </ol>
            );
        case 'object':
            if (shape.entries.length === 0) return <span className={muted}>No fields</span>;
            return <Entries entries={shape.entries} depth={depth} />;
    }
}
