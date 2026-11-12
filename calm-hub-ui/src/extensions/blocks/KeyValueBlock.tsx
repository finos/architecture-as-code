export function KeyValueBlock({ items }: { items: { label: string; value: string | number }[] }) {
    return (
        // Each item draws its top and left line, moved 1px under the box edge: a line shows between every two rows
        // and columns, also when a row is not full, and never at the outer edge.
        <dl className="grid grid-cols-1 @md:grid-cols-3 overflow-hidden rounded-box border border-base-300 bg-base-100">
            {items.map((item, index) => (
                <div key={index} data-testid="key-value-item" className="-mt-px -ml-px border-t border-l border-base-300 px-4 py-3">
                    <dt className="text-xs text-base-content/60 wrap-anywhere">{item.label}</dt>
                    <dd className="mt-0.5 font-semibold wrap-anywhere">{item.value}</dd>
                </div>
            ))}
        </dl>
    );
}
