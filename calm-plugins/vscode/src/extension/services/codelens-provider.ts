import * as vscode from 'vscode';

/**
 * Adds inline "View in CALM Canvas" CodeLens entries above CALM
 * documents (and above each node) so users can open the canvas without hunting
 * for the editor-title action. Mirrors the affordance provided by the Svelte
 * calm-canvas, adapted to the canvas' single command surface.
 */
export class CalmCanvasCodeLensProvider implements vscode.CodeLensProvider {
    provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
        const text = document.getText();

        let parsed: {
            nodes?: Array<Record<string, unknown>>;
            relationships?: unknown[];
        };
        try {
            parsed = JSON.parse(text);
        } catch {
            return [];
        }

        if (!parsed.nodes && !parsed.relationships) return [];

        const lenses: vscode.CodeLens[] = [];
        const topRange = new vscode.Range(0, 0, 0, 0);

        lenses.push(
            new vscode.CodeLens(topRange, {
                title: '$(symbol-structure) View in CALM Canvas',
                command: 'calm.openCanvas',
                arguments: [document.uri],
            })
        );

        if (parsed.nodes) {
            for (const node of parsed.nodes) {
                const uniqueId = node['unique-id'] as string | undefined;
                if (!uniqueId) continue;
                const match = text.indexOf(`"unique-id": "${uniqueId}"`);
                if (match < 0) continue;
                const pos = document.positionAt(match);
                const range = new vscode.Range(pos.line, 0, pos.line, 0);
                lenses.push(
                    new vscode.CodeLens(range, {
                        title: '$(symbol-structure) View in CALM Canvas',
                        command: 'calm.openCanvas',
                        arguments: [document.uri],
                    })
                );
            }
        }

        return lenses;
    }
}
