import {describe, it, expect, vi, beforeEach} from 'vitest';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import Lab, {type LabProps} from './Lab';
import {QUICK_START} from '../test-support/quick-start-lesson';
import {fileText, markdownSection, nodes, validatedEditorFile} from '../lessons/checks';
import {HOME_DIR, type Lesson} from '../lessons/types';
import {workspaceKey} from './storage';

// ReactFlow needs a measured canvas; the diagram is not what these tests are about.
// It echoes its input so a test can see which file it was given.
vi.mock('./HubDiagram', () => ({default: ({jsonText}: {jsonText: string}) => <pre data-testid="diagram">{jsonText}</pre>}));

// shell.ts resolves `./engine` to the same module, so this one mock covers the
// terminal path and Lab's own recompute.
const engine = vi.hoisted(() => ({
    validateArchitecture: vi.fn(),
    validateOutcome: vi.fn(),
    okResult: () => ({
        ok: true,
        issues: [],
        errors: [],
        pretty: 'Summary\n- Errors: no (0)\n\nNo issues found.\n',
        doc: {nodes: [], relationships: []},
    }),
    okOutcome: () => ({
        jsonSchemaValidationOutputs: [],
        spectralSchemaValidationOutputs: [],
        hasErrors: false,
        hasWarnings: false,
    }),
}));

vi.mock('../engine', () => ({
    validateArchitecture: engine.validateArchitecture,
    validateOutcome: engine.validateOutcome,
    parseJson: vi.fn(),
    commandSupport: vi.fn(() => undefined),
    CLI_VERSION: '9.9.9-test',
    LabError: class LabError extends Error {},
}));

const VALIDATE_COMMAND = `calm validate -a ${QUICK_START.editorFile.slice(HOME_DIR.length + 1)}`;
const STEP_ONE = /Look around/;

function stepOneCompleted() {
    return screen.queryByRole('button', {name: /Look around \(completed\)/}) !== null;
}

async function runCommand(command: string) {
    const input = screen.getByLabelText('Terminal input');
    fireEvent.change(input, {target: {value: command}});
    await act(async () => {
        fireEvent.keyDown(input, {key: 'Enter'});
    });
}

async function saveEditor(text: string) {
    fireEvent.change(screen.getByLabelText(/^Edit /), {target: {value: text}});
    await act(async () => {
        fireEvent.click(screen.getByRole('button', {name: 'Save (⌘S)'}));
    });
}

function renderLab(props: Partial<LabProps> = {}) {
    render(<Lab lesson={QUICK_START} {...props} />);
}

beforeEach(() => {
    engine.validateArchitecture.mockReset();
    engine.validateArchitecture.mockImplementation(async () => engine.okResult());
    engine.validateOutcome.mockReset();
    engine.validateOutcome.mockImplementation(async () => engine.okOutcome());
});

describe('Lab', () => {
    it('completes the first step once `calm validate` succeeds', async () => {
        await act(async () => {
            renderLab();
        });
        expect(screen.getByRole('button', {name: STEP_ONE})).toBeInTheDocument();
        expect(stepOneCompleted()).toBe(false);

        await runCommand(VALIDATE_COMMAND);

        await waitFor(() => expect(stepOneCompleted()).toBe(true));
    });

    it('shows the CLI version in the status bar, as `calm --version` prints it', async () => {
        await act(async () => {
            renderLab();
        });

        expect(screen.getByText('CALM 1.2 · CALM CLI 9.9.9-test')).toBeInTheDocument();
    });

    it('lists a parse error without claiming the list was truncated', async () => {
        engine.validateArchitecture.mockImplementation(async () => ({
            ok: false,
            parseError: 'This file is not valid JSON — Unexpected end of JSON input',
            issues: [],
            errors: [],
            issueCount: 1,
            errorCount: 1,
            pretty: '',
        }));
        await act(async () => {
            renderLab();
        });

        fireEvent.click(screen.getByRole('tab', {name: /Problems/}));

        expect(screen.getByText(/not valid JSON/)).toBeInTheDocument();
        expect(screen.queryByText(/showing first/)).not.toBeInTheDocument();
    });

    it('says how many problems it is not showing when the list is capped', async () => {
        const issues = Array.from({length: 20}, (_, i) => ({
            severity: 'error',
            path: `/nodes/${i}`,
            message: 'is invalid',
        }));
        engine.validateArchitecture.mockImplementation(async () => ({
            ok: false,
            issues,
            errors: issues,
            issueCount: 45,
            errorCount: 45,
            pretty: '',
            doc: {nodes: [], relationships: []},
        }));
        await act(async () => {
            renderLab();
        });

        fireEvent.click(screen.getByRole('tab', {name: /Problems/}));

        expect(screen.getByText(/showing first 20 of 45 problems/)).toBeInTheDocument();
        // The badge reports the real total, not the 20 the panel can list.
        expect(screen.getByRole('button', {name: /✗ 45 problems/})).toBeInTheDocument();
    });

    it('does not complete a step from a validate the learner reset away', async () => {
        await act(async () => {
            renderLab();
        });

        const inFlight: {resolve: (() => void) | null} = {resolve: null};
        engine.validateOutcome.mockImplementationOnce(
            () => new Promise((resolve) => {
                inFlight.resolve = () => resolve(engine.okOutcome());
            }),
        );

        const input = screen.getByLabelText('Terminal input');
        fireEvent.change(input, {target: {value: VALIDATE_COMMAND}});
        fireEvent.keyDown(input, {key: 'Enter'});
        expect(inFlight.resolve).not.toBeNull();

        await act(async () => {
            fireEvent.click(screen.getByRole('button', {name: 'Reset lesson'}));
        });

        await act(async () => {
            inFlight.resolve!();
        });

        await waitFor(() => expect(screen.getByLabelText('Terminal input')).not.toBeDisabled());
        expect(stepOneCompleted()).toBe(false);
    });

    it('drops an in-flight validate when the lab unmounts', async () => {
        const inFlight: {resolve: (() => void) | null} = {resolve: null};
        engine.validateOutcome.mockImplementationOnce(() => new Promise((resolve) => {
            inFlight.resolve = () => resolve(engine.okOutcome());
        }));
        const other = {...QUICK_START, id: 'other'};
        const {rerender} = render(<Lab key="quick-start" lesson={QUICK_START} />);
        const input = screen.getByLabelText('Terminal input');
        fireEvent.change(input, {target: {value: VALIDATE_COMMAND}});
        fireEvent.keyDown(input, {key: 'Enter'});
        rerender(<Lab key="other" lesson={other} />);
        await act(async () => { inFlight.resolve!(); });
        // The learner left quick-start: the run must not tick either lesson.
        expect(localStorage.getItem('calm-lab-progress-v2:other')).toBeNull();
        expect(localStorage.getItem('calm-lab-progress-v2:quick-start')).toBeNull();
    });

    it('needs a validate after the last save when a step asks for one', async () => {
        // Parse the text the engine is given, so state.doc follows the saved file.
        engine.validateArchitecture.mockImplementation(async (text: string) => ({...engine.okResult(), doc: JSON.parse(text)}));
        const lesson: Lesson = {
            ...QUICK_START,
            id: 'fresh',
            steps: [{
                id: 'validated-x',
                title: 'Add x and validate',
                body: '',
                hint: {kind: 'commands', commands: []},
                check: (state) => nodes(state.doc).some((node) => node['unique-id'] === 'x') && validatedEditorFile(state),
            }],
        };
        await act(async () => { renderLab({lesson}); });
        await runCommand(VALIDATE_COMMAND);                     // fresh, but the file has no x
        await saveEditor('{"nodes": [{"unique-id": "x"}], "relationships": []}');   // the earlier run is now stale
        // Wait for the save's own recompute (mount, the run above, then this save) before asserting.
        await waitFor(() => expect(engine.validateArchitecture).toHaveBeenCalledTimes(3));
        await act(async () => {});
        expect(screen.queryByRole('button', {name: /Add x and validate \(completed\)/})).toBeNull();
        await runCommand(VALIDATE_COMMAND);                     // fresh run on the saved file
        await waitFor(() => expect(screen.getByRole('button', {name: /Add x and validate \(completed\)/})).toBeInTheDocument());
    });

    it('has no lesson picker: a lesson opens from its link', async () => {
        await act(async () => { renderLab(); });
        expect(screen.queryByRole('combobox', {name: 'Lesson'})).toBeNull();
    });

    it('links the tutorial a lesson follows at the top of the guide, in a new tab', async () => {
        const lesson = {...QUICK_START, tutorial: {title: 'Create Your First Node', url: 'https://calm.finos.org/tutorials/beginner/02-first-node'}};
        await act(async () => { renderLab({lesson}); });
        const link = screen.getByRole('link', {name: /Create Your First Node/});
        expect(link).toHaveAttribute('href', 'https://calm.finos.org/tutorials/beginner/02-first-node');
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('shows no tutorial link for a lesson with no tutorial', async () => {
        await act(async () => { renderLab(); });
        expect(screen.getByRole('navigation', {name: 'Lesson guide'}).querySelector('a')).toBeNull();
    });

    it('copies a commands hint with a final newline, so a paste runs every command', async () => {
        const writeText = vi.fn(async () => undefined);
        Object.defineProperty(navigator, 'clipboard', {value: {writeText}, configurable: true});
        await act(async () => {
            renderLab();
        });
        fireEvent.click(screen.getAllByRole('button', {name: 'Show hint'})[0]);
        await act(async () => {
            fireEvent.click(screen.getByRole('button', {name: 'Copy'}));
        });

        const copied = (writeText.mock.calls[0] as unknown as [string])[0];
        expect(copied.endsWith('-f pretty\n')).toBe(true);
        expect(copied.split('\n').filter(Boolean)).toHaveLength(3);
    });

    it('resets only the current lesson', async () => {
        localStorage.setItem('calm-lab-progress-v2:other', '["x"]');
        await act(async () => { renderLab(); });
        await runCommand(VALIDATE_COMMAND);
        await waitFor(() => expect(localStorage.getItem('calm-lab-progress-v2:quick-start')).not.toBeNull());
        await act(async () => { fireEvent.click(screen.getByRole('button', {name: 'Reset lesson'})); });
        expect(localStorage.getItem('calm-lab-progress-v2:other')).toBe('["x"]');
        expect(localStorage.getItem('calm-lab-progress-v2:quick-start')).toBeNull();
    });
});

describe('Lab with more than one editable file', () => {
    const ADR = `${HOME_DIR}/docs/adr.md`;
    const SECOND = `${HOME_DIR}/architecture/second.json`;
    const SECOND_TEXT = '{"nodes": [{"unique-id": "second"}], "relationships": []}';
    const multi: Lesson = {
        ...QUICK_START,
        id: 'multi',
        editableFiles: [QUICK_START.editorFile, ADR, SECOND, `${HOME_DIR}/not-seeded.md`],
        seedFiles: {...QUICK_START.seedFiles, [ADR]: '# ADR\n\n## Decision\n', [SECOND]: SECOND_TEXT},
        steps: [{
            id: 'decided',
            title: 'Write the decision',
            body: '',
            hint: {kind: 'file', path: ADR, content: '# ADR\n\n## Decision\nUse a queue.\n'},
            check: (state) => markdownSection(fileText(state, ADR), 'Decision') !== '',
        }],
    };
    const fileSelect = () => screen.getByRole('combobox', {name: 'File'});
    const openFile = (path: string) => fireEvent.change(fileSelect(), {target: {value: path}});

    it('lists the editable files that exist, and opens the chosen one', async () => {
        await act(async () => { renderLab({lesson: multi}); });
        expect(screen.getAllByRole('option', {name: /^(architecture|docs)\//}).map((option) => option.textContent)).toEqual([
            QUICK_START.editorFile.slice(HOME_DIR.length + 1), 'docs/adr.md', 'architecture/second.json',
        ]);
        openFile(ADR);
        expect(screen.getByLabelText('Edit docs/adr.md')).toHaveValue('# ADR\n\n## Decision\n');
        expect(screen.getByRole('tab', {name: /docs\/adr\.md/})).toBeInTheDocument();
    });

    it('locks the file switcher while the open file has unsaved changes', async () => {
        await act(async () => { renderLab({lesson: multi}); });
        expect(fileSelect()).not.toBeDisabled();
        fireEvent.change(screen.getByLabelText(/^Edit /), {target: {value: 'edited'}});
        expect(fileSelect()).toBeDisabled();
        expect(fileSelect().closest('[title]')).toHaveAttribute('title', expect.stringMatching(/save/i));
        await act(async () => { fireEvent.click(screen.getByRole('button', {name: 'Save (⌘S)'})); });
        expect(fileSelect()).not.toBeDisabled();
    });

    it('saves only the open file, still validates the editor file, and gives checks every saved file', async () => {
        await act(async () => { renderLab({lesson: multi}); });
        const editorText = (screen.getByLabelText(/^Edit /) as HTMLTextAreaElement).value;
        openFile(ADR);
        engine.validateArchitecture.mockClear();
        await saveEditor('# ADR\n\n## Decision\nUse a queue.\n');
        await waitFor(() => expect(screen.getByRole('button', {name: /Write the decision \(completed\)/})).toBeInTheDocument());
        expect(engine.validateArchitecture).toHaveBeenLastCalledWith(editorText);
        const saved = JSON.parse(localStorage.getItem(workspaceKey('multi')) ?? '{}');
        expect(saved.files[ADR]).toBe('# ADR\n\n## Decision\nUse a queue.\n');
        expect(saved.files[QUICK_START.editorFile]).toBe(editorText);
    });

    it('names the file the status badge checks, apart from the open file', async () => {
        await act(async () => { renderLab({lesson: multi}); });
        openFile(ADR);
        expect(screen.getByText(new RegExp(`✓ ${QUICK_START.editorFile.slice(HOME_DIR.length + 1)} schema-valid`))).toBeInTheDocument();
        expect(screen.getByText(/docs\/adr\.md · 4 lines/)).toBeInTheDocument();
    });

    it('names the editor file in the Problems panel, apart from the open file', async () => {
        await act(async () => { renderLab({lesson: multi}); });
        openFile(ADR);
        fireEvent.click(screen.getByRole('tab', {name: /Problems/}));
        const label = QUICK_START.editorFile.slice(HOME_DIR.length + 1);
        expect(screen.getByText(`Problems in ${label}`)).toBeInTheDocument();
        expect(screen.getByText(`no problems — ${label} is schema-valid`)).toBeInTheDocument();
    });

    it('draws the open file when it is an architecture, else the editor file', async () => {
        await act(async () => { renderLab({lesson: multi}); });
        const editorText = (screen.getByLabelText(/^Edit /) as HTMLTextAreaElement).value;
        openFile(ADR);
        fireEvent.click(screen.getByRole('tab', {name: /Diagram/}));
        expect(screen.getByTestId('diagram').textContent).toBe(editorText);
        openFile(SECOND);
        expect(screen.getByTestId('diagram').textContent).toBe(SECOND_TEXT);
    });

    it('returns to the editor file on reset', async () => {
        await act(async () => { renderLab({lesson: multi}); });
        openFile(ADR);
        await act(async () => { fireEvent.click(screen.getByRole('button', {name: 'Reset lesson'})); });
        expect(fileSelect()).toHaveValue(QUICK_START.editorFile);
        expect(screen.getByLabelText(`Edit ${QUICK_START.editorFile.slice(HOME_DIR.length + 1)}`)).toBeInTheDocument();
    });

    it('shows no file switcher when the lesson has one editable file', async () => {
        await act(async () => { renderLab(); });
        expect(screen.queryByRole('combobox', {name: 'File'})).toBeNull();
        expect(screen.getByText('✓ schema-valid')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('tab', {name: /Problems/}));
        expect(screen.queryByText(/^Problems in /)).toBeNull();
        expect(screen.getByText('no problems — the saved file is schema-valid')).toBeInTheDocument();
    });

    it('colours the open architecture file as JSON, but not a markdown ADR', async () => {
        await act(async () => { renderLab({lesson: multi}); });
        expect(document.body.querySelector('[class*="tokKey"]')).not.toBeNull();
        openFile(ADR);
        expect(document.body.querySelector('[class*="tok"]')).toBeNull();
    });
});
