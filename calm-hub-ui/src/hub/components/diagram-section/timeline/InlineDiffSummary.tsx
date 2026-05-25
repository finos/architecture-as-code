import { useState, type ReactNode } from 'react';
import { IoTriangleSharp } from 'react-icons/io5';
import type { DiffResult } from '@finos/calm-models/diff';
import type { CalmNodeSchema, CalmRelationshipSchema } from '@finos/calm-models/types';
import { colors } from '../../../../theme/colors.js';

interface InlineDiffSummaryProps {
    diffResult: DiffResult | null;
}

// Exit-comparison is implicit: selecting (left-clicking) any moment navigates
// the diagram to that version, which clears the compare state upstream.

type Palette = typeof colors.diffPalette.add;

const PALETTES: Record<'add' | 'mod' | 'del', Palette> = {
    add: colors.diffPalette.add,
    mod: colors.diffPalette.mod,
    del: colors.diffPalette.del,
};

function nodeName(n: CalmNodeSchema): string {
    return (n.name as string) || (n['unique-id'] as string) || 'node';
}

function nodeType(n: CalmNodeSchema): string {
    return (n['node-type'] as string) || 'node';
}

function relationshipName(e: CalmRelationshipSchema): string {
    return (e['unique-id'] as string) || 'relationship';
}

function relationshipType(e: CalmRelationshipSchema): string {
    const rt = (e as { 'relationship-type'?: Record<string, unknown> })['relationship-type'];
    if (rt && typeof rt === 'object') {
        const keys = Object.keys(rt);
        if (keys.length > 0) return keys[0];
    }
    return 'relationship';
}

/**
 * Replaces the old right-side DiffPanel for compare mode. Lives inside the
 * expanded timeline panel: stat row + ADDED / MODIFIED / REMOVED grids for
 * nodes and relationships + a collapsible UNCHANGED list + Exit comparison.
 */
export function InlineDiffSummary({ diffResult }: InlineDiffSummaryProps) {
    const [unchangedOpen, setUnchangedOpen] = useState(false);

    if (!diffResult) {
        return (
            <div
                data-testid="timeline-inline-diff-loading"
                className="font-inter"
                style={{ padding: '14px 22px 18px', fontSize: 12.5, color: colors.ink[500] }}
            >
                Loading diff…
            </div>
        );
    }

    const nodeAdds = diffResult.nodesAdded.length;
    const nodeMods = diffResult.nodesModified.length + diffResult.nodesRenamed.length;
    const nodeDels = diffResult.nodesRemoved.length;
    const edgeAdds = diffResult.edgesAdded.length;
    const edgeMods = diffResult.edgesModified.length + diffResult.edgesRenamed.length;
    const edgeDels = diffResult.edgesRemoved.length;
    const totalNodes = nodeAdds + nodeMods + nodeDels;
    const totalEdges = edgeAdds + edgeMods + edgeDels;
    const total = totalNodes + totalEdges;
    const unchanged = diffResult.nodesSame.length + diffResult.edgesSame.length;

    return (
        <div
            data-testid="timeline-inline-diff-summary"
            className="flex flex-col font-inter"
            style={{ padding: '14px 22px 18px', gap: 14 }}
        >
            <div className="flex items-center" style={{ gap: 22 }}>
                <Stat n={total} label="Total Changes" />
                <Stat n={totalNodes} label="Node Changes" />
                <Stat n={totalEdges} label="Relationship Changes" />
            </div>

            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                {diffResult.nodesAdded.length > 0 && (
                    <Section label={`NODES ADDED (${diffResult.nodesAdded.length})`}>
                        {diffResult.nodesAdded.map((n) => (
                            <Pill
                                key={n['unique-id']}
                                kind="add"
                                name={nodeName(n)}
                                type={nodeType(n)}
                            />
                        ))}
                    </Section>
                )}
                {diffResult.edgesAdded.length > 0 && (
                    <Section label={`RELATIONSHIPS ADDED (${diffResult.edgesAdded.length})`}>
                        {diffResult.edgesAdded.map((e) => (
                            <Pill
                                key={e['unique-id']}
                                kind="add"
                                name={relationshipName(e)}
                                type={relationshipType(e)}
                            />
                        ))}
                    </Section>
                )}
                {diffResult.nodesModified.length + diffResult.nodesRenamed.length > 0 && (
                    <Section label={`NODES MODIFIED (${diffResult.nodesModified.length + diffResult.nodesRenamed.length})`}>
                        {diffResult.nodesModified.map((m) => (
                            <Pill
                                key={m.original['unique-id']}
                                kind="mod"
                                name={nodeName(m.original)}
                                type={nodeType(m.original)}
                            />
                        ))}
                        {diffResult.nodesRenamed.map((r) => (
                            <Pill
                                key={`${r.oldId}->${r.newId}`}
                                kind="mod"
                                name={`${r.oldId} → ${r.newId}`}
                                type="renamed"
                            />
                        ))}
                    </Section>
                )}
                {diffResult.edgesModified.length + diffResult.edgesRenamed.length > 0 && (
                    <Section label={`RELATIONSHIPS MODIFIED (${diffResult.edgesModified.length + diffResult.edgesRenamed.length})`}>
                        {diffResult.edgesModified.map((m) => (
                            <Pill
                                key={m.original['unique-id']}
                                kind="mod"
                                name={relationshipName(m.original)}
                                type={relationshipType(m.original)}
                            />
                        ))}
                        {diffResult.edgesRenamed.map((r) => (
                            <Pill
                                key={`${r.oldId}->${r.newId}`}
                                kind="mod"
                                name={`${r.oldId} → ${r.newId}`}
                                type="renamed"
                            />
                        ))}
                    </Section>
                )}
                {diffResult.nodesRemoved.length > 0 && (
                    <Section label={`NODES REMOVED (${diffResult.nodesRemoved.length})`}>
                        {diffResult.nodesRemoved.map((n) => (
                            <Pill
                                key={n['unique-id']}
                                kind="del"
                                name={nodeName(n)}
                                type={nodeType(n)}
                            />
                        ))}
                    </Section>
                )}
                {diffResult.edgesRemoved.length > 0 && (
                    <Section label={`RELATIONSHIPS REMOVED (${diffResult.edgesRemoved.length})`}>
                        {diffResult.edgesRemoved.map((e) => (
                            <Pill
                                key={e['unique-id']}
                                kind="del"
                                name={relationshipName(e)}
                                type={relationshipType(e)}
                            />
                        ))}
                    </Section>
                )}
            </div>

            {unchanged > 0 && (
                <div>
                    <button
                        type="button"
                        onClick={() => setUnchangedOpen((o) => !o)}
                        className="font-inter flex items-center bg-transparent border-0 p-0 cursor-pointer"
                        style={{
                            gap: 6,
                            color: colors.ink[500],
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: 0.5,
                            textTransform: 'uppercase',
                        }}
                        aria-expanded={unchangedOpen}
                        data-testid="timeline-unchanged-toggle"
                    >
                        <IoTriangleSharp
                            size={10}
                            style={{
                                transform: unchangedOpen ? 'rotate(180deg)' : 'rotate(90deg)',
                                transition: 'transform 150ms ease',
                            }}
                        />
                        Unchanged items ({unchanged})
                    </button>
                    {unchangedOpen && (
                        <ul
                            className="mt-2 flex flex-wrap"
                            style={{ gap: 6, listStyle: 'none', padding: 0 }}
                            data-testid="timeline-unchanged-list"
                        >
                            {diffResult.nodesSame.map((n) => (
                                <UnchangedPill key={`n-${n['unique-id']}`} label={nodeName(n)} />
                            ))}
                            {diffResult.edgesSame.map((e) => (
                                <UnchangedPill key={`e-${e['unique-id']}`} label={relationshipName(e)} />
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}

function Stat({ n, label }: { n: number; label: string }) {
    return (
        <div className="flex items-baseline" style={{ gap: 8 }}>
            <span
                className="font-mono-jb"
                style={{ fontSize: 20, fontWeight: 700, color: colors.ink[900] }}
            >
                {n}
            </span>
            <span style={{ fontSize: 13, color: colors.ink[700] }}>{label}</span>
        </div>
    );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div>
            <div
                className="font-inter"
                style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    color: colors.ink[500],
                    marginBottom: 8,
                    textTransform: 'uppercase',
                }}
            >
                {label}
            </div>
            <ul className="flex flex-col" style={{ gap: 6, listStyle: 'none', padding: 0, margin: 0 }}>
                {children}
            </ul>
        </div>
    );
}

function Pill({ kind, name, type }: { kind: 'add' | 'mod' | 'del'; name: string; type: string }) {
    const palette = PALETTES[kind];
    return (
        <li
            className="flex items-center"
            style={{
                gap: 8,
                padding: '8px 12px',
                background: palette.bg,
                border: `1px solid ${palette.border}`,
                borderRadius: 8,
                fontSize: 13,
            }}
        >
            <span
                className="font-mono-jb inline-flex items-center justify-center shrink-0"
                style={{
                    width: 18,
                    height: 18,
                    background: '#ffffff',
                    color: palette.fg,
                    fontWeight: 700,
                    fontSize: 12,
                    borderRadius: 4,
                }}
            >
                {palette.sign}
            </span>
            <span style={{ fontSize: 13, fontWeight: 500, color: colors.ink[900] }}>{name}</span>
            <span style={{ fontSize: 11.5, fontWeight: 500, color: palette.fg }}>({type})</span>
        </li>
    );
}

function UnchangedPill({ label }: { label: string }) {
    return (
        <li
            className="font-inter"
            style={{
                background: colors.ink[100],
                color: colors.ink[500],
                padding: '4px 9px',
                borderRadius: 999,
                fontSize: 11.5,
            }}
        >
            {label}
        </li>
    );
}
