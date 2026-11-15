import type { LensControl } from '../../model/lens.js';

interface LensToolbarProps {
    controls: LensControl[];
    values: Record<string, string>;
    onChange: (param: string, value: string) => void;
}

/** The controls of a reply. Each sets one view parameter of the lens, and the lens then asks its route again. */
export function LensToolbar({ controls, values, onChange }: LensToolbarProps) {
    if (controls.length === 0) return null;
    return (
        <div className="flex flex-wrap items-center gap-3" role="toolbar" aria-label="Lens controls">
            {controls.map((control) => {
                const current = values[control.param];
                const label = control.label ?? control.param;
                switch (control.type) {
                    case 'segmented':
                        return (
                            <div key={control.param} className="join" role="group" aria-label={label}>
                                {control.items.map((item) => (
                                    <button key={item.value} type="button" aria-pressed={item.value === current}
                                        className={`btn btn-xs join-item ${item.value === current ? 'btn-primary' : 'btn-ghost border-base-300'}`}
                                        onClick={() => onChange(control.param, item.value)}>
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        );
                    case 'select':
                        return (
                            <label key={control.param} className="flex items-center gap-2 text-sm">
                                <span className="text-base-content/70">{label}</span>
                                <select className="select select-xs" value={current ?? ''} onChange={(event) => onChange(control.param, event.target.value)}>
                                    {current === undefined && <option value="" disabled>Choose…</option>}
                                    {control.items.map((item) => (
                                        <option key={item.value} value={item.value}>
                                            {item.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        );
                    case 'breadcrumb':
                        return (
                            <nav key={control.param} className="breadcrumbs py-0 text-sm" aria-label={label}>
                                <ul>
                                    {control.items.map((item, index) => {
                                        const last = index === control.items.length - 1;
                                        return (
                                            <li key={item.value}>
                                                {last ? (
                                                    <span aria-current="location" className="font-semibold">{item.label}</span>
                                                ) : (
                                                    <button type="button" className="link link-hover" onClick={() => onChange(control.param, item.value)}>
                                                        {item.label}
                                                    </button>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </nav>
                        );
                }
            })}
        </div>
    );
}
