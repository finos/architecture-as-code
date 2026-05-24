import { useEffect, useState } from 'react';
import { colors } from '../../../../theme/colors.js';
import type { TimelineMoment } from './TimelineBar.js';
import type { VersionChange } from './perVersionChanges.js';

interface VersionDetailProps {
    moment: TimelineMoment;
    /**
     * Async loader that returns the list of changes between this moment and
     * its predecessor. Returns [] for the very first moment (no predecessor).
     */
    loadChanges: () => Promise<VersionChange[]>;
}

const SIGN_PALETTE: Record<VersionChange['kind'], { bg: string; fg: string; sign: string }> = {
    add: { bg: colors.diffPalette.add.bg, fg: colors.diffPalette.add.fg, sign: colors.diffPalette.add.sign },
    mod: { bg: colors.diffPalette.mod.bg, fg: colors.diffPalette.mod.fg, sign: colors.diffPalette.mod.sign },
    del: { bg: colors.diffPalette.del.bg, fg: colors.diffPalette.del.fg, sign: colors.diffPalette.del.sign },
};

/**
 * Single-mode detail panel beneath the moment cards. Renders the moment's
 * title, valid-from date, summary (the moment's description) and a WHAT CHANGED
 * list derived from a diff against the predecessor version.
 */
export function VersionDetail({ moment, loadChanges }: VersionDetailProps) {
    const [changes, setChanges] = useState<VersionChange[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setChanges(null);
        setError(null);
        loadChanges()
            .then((list) => {
                if (!cancelled) setChanges(list);
            })
            .catch(() => {
                if (!cancelled) setError('Could not load changes for this version');
            });
        return () => {
            cancelled = true;
        };
    }, [loadChanges]);

    return (
        <div
            data-testid="timeline-version-detail"
            className="flex flex-col font-inter"
            style={{ padding: '14px 22px 18px', gap: 12 }}
        >
            <div className="flex items-center" style={{ gap: 12 }}>
                <div
                    className="font-inter"
                    style={{ fontSize: 15, fontWeight: 600, color: colors.ink[900] }}
                >
                    {moment.label}
                </div>
                {moment.validFrom && (
                    <div
                        className="font-mono-jb"
                        style={{ fontSize: 12, color: colors.ink[500] }}
                    >
                        {moment.validFrom}
                    </div>
                )}
            </div>

            {moment.description && (
                <p
                    className="font-inter"
                    style={{ fontSize: 13, lineHeight: 1.55, color: colors.ink[700], margin: 0 }}
                >
                    {moment.description}
                </p>
            )}

            <div>
                <div
                    className="font-inter"
                    style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        letterSpacing: 0.5,
                        color: colors.ink[500],
                        marginBottom: 6,
                        textTransform: 'uppercase',
                    }}
                >
                    What changed
                </div>
                {error ? (
                    <div style={{ fontSize: 12.5, color: colors.ink[500] }}>{error}</div>
                ) : changes === null ? (
                    <div
                        data-testid="timeline-changes-loading"
                        style={{ fontSize: 12.5, color: colors.ink[500] }}
                    >
                        Loading changes…
                    </div>
                ) : changes.length === 0 ? (
                    <div style={{ fontSize: 12.5, color: colors.ink[500] }}>
                        No changes from the previous version.
                    </div>
                ) : (
                    <ul
                        data-testid="timeline-changes-list"
                        className="flex flex-col"
                        style={{ gap: 6, listStyle: 'none', padding: 0, margin: 0 }}
                    >
                        {changes.map((change, i) => {
                            const palette = SIGN_PALETTE[change.kind];
                            return (
                                <li
                                    key={i}
                                    className="flex items-center"
                                    style={{ gap: 8 }}
                                >
                                    <span
                                        className="font-mono-jb inline-flex items-center justify-center"
                                        style={{
                                            width: 18,
                                            height: 18,
                                            background: palette.bg,
                                            color: palette.fg,
                                            fontWeight: 700,
                                            fontSize: 12,
                                            borderRadius: 4,
                                        }}
                                    >
                                        {palette.sign}
                                    </span>
                                    <span
                                        className="font-inter"
                                        style={{ fontSize: 12.5, color: colors.ink[700] }}
                                    >
                                        {change.text}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}
