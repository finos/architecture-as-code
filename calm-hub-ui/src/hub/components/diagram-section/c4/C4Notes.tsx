import type { C4Model } from '@finos/calm-models/c4';

/** The conflicts of the projection, and why some elements show at another kind than their mapping. */
export function C4Notes({ model }: { model: C4Model }) {
    const name = (id: string) => model.elements.get(id)?.name ?? id;
    const notes = [...model.elements.values()].flatMap((e) => e.notes.map((text) => ({ id: e.id, text })));
    const total = model.conflicts.length + notes.length;
    if (total === 0) return null;
    const summary = [
        model.conflicts.length > 0 && `${model.conflicts.length} conflict${model.conflicts.length === 1 ? '' : 's'}`,
        notes.length > 0 && `${notes.length} note${notes.length === 1 ? '' : 's'}`,
    ]
        .filter(Boolean)
        .join(', ');
    return (
        <details className="absolute right-3 bottom-3 max-w-sm bg-base-100 border border-base-300 rounded-lg text-xs shadow" data-testid="c4-notes">
            <summary className="cursor-pointer px-3 py-2">{summary}</summary>
            <ul className="px-4 pb-3 list-disc space-y-1 max-h-48 overflow-auto">
                {model.conflicts.map((c, i) => (
                    <li key={`c${i}`} className="text-error">
                        <b>{name(c.element)}</b>: {c.message}
                    </li>
                ))}
                {notes.map((n, i) => (
                    <li key={`n${i}`}>
                        <b>{name(n.id)}</b>: {n.text}
                    </li>
                ))}
            </ul>
        </details>
    );
}
