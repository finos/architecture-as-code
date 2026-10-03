// Minimal VS Code API mock for unit-testing the canvas extension's pure logic.
// Only the surface touched by the code under test is implemented; tests may
// reassign the mutable `workspace.*` members to control behaviour.

export class Uri {
    private constructor(public readonly fsPath: string) {}
    static file(p: string): Uri {
        return new Uri(p);
    }
    static joinPath(base: Uri, ...parts: string[]): Uri {
        return new Uri([base.fsPath.replace(/\/$/, ''), ...parts].join('/'));
    }
    toString(): string {
        return this.fsPath;
    }
}

export class Range {
    constructor(
        public readonly startLine: number,
        public readonly startCharacter: number,
        public readonly endLine: number,
        public readonly endCharacter: number
    ) {}
}

export interface Command {
    title: string;
    command: string;
    arguments?: unknown[];
}

export class CodeLens {
    constructor(
        public readonly range: Range,
        public readonly command?: Command
    ) {}
}

export class RelativePattern {
    constructor(
        public readonly base: unknown,
        public readonly pattern: string
    ) {}
}

interface WorkspaceFolder {
    uri: Uri;
}

export class WorkspaceEdit {
    private _edits: Array<{ uri: unknown; range: unknown; newText: string }> = [];
    replace(uri: unknown, range: unknown, newText: string): void {
        this._edits.push({ uri, range, newText });
    }
}

export const workspace: {
    workspaceFolders: WorkspaceFolder[] | undefined;
    fs: {
        readFile: (uri: Uri) => Promise<Uint8Array>;
        writeFile: (uri: Uri, content: Uint8Array) => Promise<void>;
    };
    getConfiguration: (section?: string) => {
        get: <T>(key: string) => T | undefined;
    };
    findFiles: (...args: unknown[]) => Promise<Uri[]>;
    applyEdit: (edit: WorkspaceEdit) => Promise<boolean>;
} = {
    workspaceFolders: [],
    fs: {
        readFile: async () => {
            throw new Error('ENOENT');
        },
        writeFile: async () => {},
    },
    getConfiguration: () => ({ get: () => undefined }),
    findFiles: async () => [],
    applyEdit: async () => true,
};

export const window: Record<string, (...args: unknown[]) => Promise<unknown>> = {
    showWarningMessage: async () => undefined,
    showErrorMessage: async () => undefined,
    showInformationMessage: async () => undefined,
    showOpenDialog: async () => undefined,
    showSaveDialog: async () => undefined,
};

export const commands = {
    executeCommand: async () => undefined,
};
