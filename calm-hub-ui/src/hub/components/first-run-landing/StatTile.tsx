import { colors } from '../../../theme/colors.js';
import { redesignTokens } from '../../../theme/redesign-tokens.js';

interface StatTileProps {
    /** The metric value (rendered mono, per the metadata convention). */
    value: number;
    /** Short lower-case-ish label, e.g. "Namespaces". */
    label: string;
    /** When true the number is brand blue (used for the Namespaces tile). */
    accent?: boolean;
    /** When false, shows a dash placeholder instead of a (likely-zero) value. */
    loaded?: boolean;
}

/**
 * One catalogue stat tile: a big mono number over a small muted label. The
 * Namespaces tile renders its number in the redesign blue ({@link accent}); the
 * rest render in ink. Pure presentational — totals are computed by the parent.
 * Until {@link loaded}, shows a faint dash so the landing doesn't flash zeros
 * before the counts fetch settles.
 */
export function StatTile({ value, label, accent = false, loaded = true }: StatTileProps) {
    return (
        <div
            data-testid="stat-tile"
            className="rounded-[11px] p-4"
            style={{
                border: `1px solid ${colors.redesign.border}`,
                boxShadow: redesignTokens.shadow.card,
            }}
        >
            <div
                className="font-mono-jb text-[28px] font-bold leading-none"
                style={{
                    color: !loaded
                        ? colors.redesign.disabled
                        : accent
                          ? colors.redesign.primary
                          : colors.redesign.ink,
                }}
            >
                {loaded ? value : '—'}
            </div>
            <div className="text-[12px] mt-2" style={{ color: colors.redesign.mutedAlt }}>
                {label}
            </div>
        </div>
    );
}
