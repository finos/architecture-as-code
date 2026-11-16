import * as vscode from 'vscode';

const ID_PATTERN = /[A-Za-z0-9_.:-]+/;

type IdEntry = { kind: string; detail?: string };

function text(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value : undefined;
}

/** Maps each `unique-id` declared in a CALM architecture to what it identifies. */
export function indexCalmIds(document: unknown): Map<string, IdEntry> {
    const ids = new Map<string, IdEntry>();
    if (!document || typeof document !== 'object' || Array.isArray(document)) return ids;
    const doc = document as Record<string, unknown>;

    const each = (items: unknown, visit: (item: Record<string, unknown>, id: string) => void) => {
        if (!Array.isArray(items)) return;
        for (const item of items) {
            if (item && typeof item === 'object' && typeof (item as Record<string, unknown>)['unique-id'] === 'string') {
                const record = item as Record<string, unknown>;
                visit(record, record['unique-id'] as string);
            }
        }
    };

    each(doc.nodes, (node, id) => {
        const name = text(node.name);
        const nodeType = text(node['node-type']);
        ids.set(id, { kind: 'Node', detail: name && nodeType ? `${name} (${nodeType})` : name ?? nodeType });
        each(node.interfaces, (_iface, ifaceId) => ids.set(ifaceId, { kind: 'Interface', detail: `of node \`${id}\`` }));
    });
    each(doc.relationships, (relationship, id) => {
        const type = relationship['relationship-type'];
        const kind = type && typeof type === 'object' ? Object.keys(type)[0] : undefined;
        ids.set(id, { kind: 'Relationship', detail: text(relationship.description) ?? kind });
    });
    each(doc.flows, (flow, id) => ids.set(id, { kind: 'Flow', detail: text(flow.name) }));
    return ids;
}

/**
 * Shows what a CALM `unique-id` identifies when the cursor is on it, where it is declared or
 * referenced (for example in a relationship), as CALM Tools 0.6.x did.
 */
export class CalmIdHoverProvider implements vscode.HoverProvider {
    provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | undefined {
        const range = document.getWordRangeAtPosition(position, ID_PATTERN);
        if (!range) return undefined;

        const line = document.lineAt(position.line).text;
        if (line[range.start.character - 1] !== '"' || line[range.end.character] !== '"') return undefined;

        let parsed: unknown;
        try {
            parsed = JSON.parse(document.getText());
        } catch {
            return undefined;
        }
        const id = document.getText(range);
        const entry = indexCalmIds(parsed).get(id);
        if (!entry) return undefined;

        const summary = entry.detail ? `${entry.kind}: ${entry.detail}` : entry.kind;
        return new vscode.Hover(new vscode.MarkdownString(`**CALM id** \`${id}\`\n\n${summary}`), range);
    }
}
