import { colors } from '../../../theme/colors.js';

/**
 * Mono, uppercase section label used in the rail (e.g. `NAMESPACES`,
 * `CONTROL DOMAINS`). 10px, wide tracking, faint colour.
 */
export function RailSectionLabel({ children }: { children: string }) {
    return (
        <div
            className="font-mono-jb text-[10px] uppercase tracking-[0.1em] px-3 mt-4 mb-1"
            style={{ color: colors.redesign.faintAlt }}
        >
            {children}
        </div>
    );
}
