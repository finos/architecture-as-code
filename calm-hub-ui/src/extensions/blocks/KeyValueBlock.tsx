export function KeyValueBlock({ items }: { items: { label: string; value: string | number }[] }) {
    return (
        <dl className="grid grid-cols-1 sm:grid-cols-3 rounded-box border border-base-300 bg-base-100 divide-y sm:divide-y-0 sm:divide-x divide-base-300">
            {items.map((item) => (
                <div key={item.label} className="px-4 py-3">
                    <dt className="text-xs text-base-content/60">{item.label}</dt>
                    <dd className="mt-0.5 font-semibold">{item.value}</dd>
                </div>
            ))}
        </dl>
    );
}
