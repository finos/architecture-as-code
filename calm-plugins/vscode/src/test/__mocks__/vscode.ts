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

export const workspace: {
    workspaceFolders: WorkspaceFolder[] | undefined;
    fs: { readFile: (uri: Uri) => Promise<Uint8Array> };
    getConfiguration: (section?: string) => {
        get: <T>(key: string) => T | undefined;
    };
    findFiles: (...args: unknown[]) => Promise<Uri[]>;
} = {
    workspaceFolders: [],
    fs: {
        readFile: async () => {
            throw new Error('ENOENT');
        },
    },
    getConfiguration: () => ({ get: () => undefined }),
    findFiles: async () => [],
};

export const window = {
    showWarningMessage: () => Promise.resolve(undefined),
    showErrorMessage: () => Promise.resolve(undefined),
    showInformationMessage: () => Promise.resolve(undefined),
};
