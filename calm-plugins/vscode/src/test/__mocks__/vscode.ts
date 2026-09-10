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

export class ThemeColor {
    constructor(public readonly id: string) {}
}

export enum StatusBarAlignment {
    Left = 1,
    Right = 2,
}

export enum ConfigurationTarget {
    Global = 1,
    Workspace = 2,
    WorkspaceFolder = 3,
}

interface WorkspaceFolder {
    uri: Uri;
}

export const workspace: {
    workspaceFolders: WorkspaceFolder[] | undefined;
    fs: { readFile: (uri: Uri) => Promise<Uint8Array> };
    getConfiguration: (section?: string) => {
        get: <T>(key: string, defaultValue?: T) => T | undefined;
        update: (key: string, value: unknown, target?: ConfigurationTarget) => Promise<void>;
    };
    findFiles: (...args: unknown[]) => Promise<Uri[]>;
} = {
    workspaceFolders: [],
    fs: {
        readFile: async () => {
            throw new Error('ENOENT');
        },
    },
    getConfiguration: () => ({
        get: () => undefined,
        update: async () => {},
    }),
    findFiles: async () => [],
};

export interface StatusBarItem {
    text: string;
    tooltip: string | undefined;
    command: string | undefined;
    backgroundColor: ThemeColor | undefined;
    show: () => void;
    hide: () => void;
    dispose: () => void;
}

function createMockStatusBarItem(): StatusBarItem {
    return {
        text: '',
        tooltip: undefined,
        command: undefined,
        backgroundColor: undefined,
        show: () => {},
        hide: () => {},
        dispose: () => {},
    };
}

export const window = {
    showWarningMessage: () => Promise.resolve(undefined),
    showErrorMessage: () => Promise.resolve(undefined),
    showInformationMessage: () => Promise.resolve(undefined),
    showInputBox: () => Promise.resolve(undefined),
    createStatusBarItem: (_alignment?: StatusBarAlignment, _priority?: number): StatusBarItem =>
        createMockStatusBarItem(),
    createOutputChannel: (_name: string) => ({
        appendLine: () => {},
        append: () => {},
        clear: () => {},
        show: () => {},
        hide: () => {},
        dispose: () => {},
    }),
};

export const commands = {
    registerCommand: (_command: string, _callback: (...args: unknown[]) => unknown) => ({
        dispose: () => {},
    }),
};

export const languages = {
    registerCodeLensProvider: (_selector: unknown, _provider: unknown) => ({
        dispose: () => {},
    }),
};
