import {describe, it, expect, vi, beforeEach} from 'vitest';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import Lab, {type LabProps} from './Lab';
import {QUICK_START} from '../lessons/quick-start/lesson';
import {LESSONS} from '../lessons';
import {nodes, validatedEditorFile} from '../lessons/checks';
import {HOME_DIR, type Lesson} from '../lessons/types';

// ReactFlow needs a measured canvas; the diagram is not what these tests are about.
vi.mock('./HubDiagram', () => ({default: () => null}));

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
    const onSelectLesson = vi.fn();
    render(<Lab lesson={QUICK_START} lessons={LESSONS} onSelectLesson={onSelectLesson} {...props} />);
    return {onSelectLesson};
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
            render(<Lab />);
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

    it('drops an in-flight validate when the lesson is switched', async () => {
        const inFlight: {resolve: (() => void) | null} = {resolve: null};
        engine.validateOutcome.mockImplementationOnce(() => new Promise((resolve) => {
            inFlight.resolve = () => resolve(engine.okOutcome());
        }));
        const other = {...QUICK_START, id: 'other'};
        const {rerender} = render(<Lab key="quick-start" lesson={QUICK_START} lessons={[QUICK_START, other]} onSelectLesson={vi.fn()} />);
        const input = screen.getByLabelText('Terminal input');
        fireEvent.change(input, {target: {value: VALIDATE_COMMAND}});
        fireEvent.keyDown(input, {key: 'Enter'});
        rerender(<Lab key="other" lesson={other} lessons={[QUICK_START, other]} onSelectLesson={vi.fn()} />);
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
        await act(async () => { renderLab({lesson, lessons: [lesson]}); });
        await runCommand(VALIDATE_COMMAND);                     // fresh, but the file has no x
        await saveEditor('{"nodes": [{"unique-id": "x"}], "relationships": []}');   // the earlier run is now stale
        // Wait for the save's own recompute (mount, the run above, then this save) before asserting.
        await waitFor(() => expect(engine.validateArchitecture).toHaveBeenCalledTimes(3));
        await act(async () => {});
        expect(screen.queryByRole('button', {name: /Add x and validate \(completed\)/})).toBeNull();
        await runCommand(VALIDATE_COMMAND);                     // fresh run on the saved file
        await waitFor(() => expect(screen.getByRole('button', {name: /Add x and validate \(completed\)/})).toBeInTheDocument());
    });

    it('lists every lesson with its progress and asks to switch on change', async () => {
        const other = {...QUICK_START, id: 'other', title: 'Other lesson'};
        let onSelectLesson = vi.fn();
        await act(async () => { ({onSelectLesson} = renderLab({lessons: [QUICK_START, other]})); });
        const picker = screen.getByRole('combobox', {name: 'Lesson'});
        expect(screen.getByRole('option', {name: /Quick start: model a trading system — 0\/3/})).toBeInTheDocument();
        fireEvent.change(picker, {target: {value: 'other'}});
        expect(onSelectLesson).toHaveBeenCalledWith('other');
    });

    it('describes each lesson in the picker and under it', async () => {
        const other = {...QUICK_START, id: 'other', title: 'Other lesson', summary: 'Another summary.'};
        await act(async () => { renderLab({lessons: [QUICK_START, other]}); });
        expect(screen.getByRole('option', {name: /Quick start/})).toHaveAttribute('title', QUICK_START.summary);
        expect(screen.getByRole('option', {name: /Other lesson/})).toHaveAttribute('title', 'Another summary.');
        expect(screen.getByText(QUICK_START.summary)).toBeInTheDocument();
        expect(screen.queryByText('Another summary.')).toBeNull();
    });

    it('links the tutorial a lesson adapts, in a new tab', async () => {
        const lesson = {...QUICK_START, tutorial: 'https://calm.finos.org/tutorials/beginner/01-setup'};
        await act(async () => { renderLab({lesson, lessons: [lesson]}); });
        const link = screen.getByRole('link', {name: /Tutorial/});
        expect(link).toHaveAttribute('href', lesson.tutorial);
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('shows no tutorial link when the lesson has none', async () => {
        await act(async () => { renderLab(); });
        expect(screen.queryByRole('link', {name: /Tutorial/})).toBeNull();
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
