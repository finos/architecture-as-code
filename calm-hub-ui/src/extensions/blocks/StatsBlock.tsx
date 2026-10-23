export function StatsBlock({ items }: { items: { label: string; value: string | number }[] }) {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {items.map((item) => (
                <div key={item.label} className="rounded-box border border-base-300 bg-base-100 px-4 py-3">
                    <div className="text-2xl font-bold">{item.value}</div>
                    <div className="text-sm text-base-content/60">{item.label}</div>
                </div>
            ))}
        </div>
    );
}
