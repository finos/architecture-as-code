import { IoEyeOutline, IoCodeOutline } from 'react-icons/io5';
import type { ViewMode } from './ControlDetailSection.js';

interface ViewToggleProps {
    mode: ViewMode;
    onChange: (mode: ViewMode) => void;
}

/**
 * Readable / Raw icon toggle (eye = readable, code = raw), shared by the control
 * panel title bar and the control detail section so the role/name selectors and
 * styling stay identical. Accessible names are "Readable" / "Raw JSON".
 */
export function ViewToggle({ mode, onChange }: ViewToggleProps) {
    return (
        <div role="tablist" className="inline-flex rounded-lg bg-base-300 p-0.5">
            <button
                type="button"
                role="tab"
                aria-label="Readable"
                aria-selected={mode === 'readable'}
                title="Readable"
                className={`p-1.5 rounded-md transition-colors ${mode === 'readable' ? 'bg-primary text-primary-content' : 'text-base-content/50 hover:text-base-content'}`}
                onClick={() => onChange('readable')}
            >
                <IoEyeOutline size={14} />
            </button>
            <button
                type="button"
                role="tab"
                aria-label="Raw JSON"
                aria-selected={mode === 'raw'}
                title="Raw JSON"
                className={`p-1.5 rounded-md transition-colors ${mode === 'raw' ? 'bg-primary text-primary-content' : 'text-base-content/50 hover:text-base-content'}`}
                onClick={() => onChange('raw')}
            >
                <IoCodeOutline size={14} />
            </button>
        </div>
    );
}
