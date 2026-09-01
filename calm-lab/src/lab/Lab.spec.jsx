import {describe, it, expect, vi, beforeEach} from 'vitest';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import Lab from './Lab';
import {ARCHITECTURE_FILE} from './lesson';

// ReactFlow needs a measured canvas; the diagram is not what these tests are about.
vi.mock('./HubDiagram', () => ({default: () => null}));

// shell.ts resolves `./engine` to the same module, so this one mock covers the
// terminal path and Lab's own recompute.
const engine = vi.hoisted(() => ({
    validateArchitecture: vi.fn(),
    okResult: () => ({
        ok: true,
        issues: [],
        errors: [],
        pretty: 'Summary\n- Errors: no (0)\n\nNo issues found.\n',
        doc: {nodes: [], relationships: []},
    }),
}));

vi.mock('../engine', () => ({
    validateArchitecture: engine.validateArchitecture,
    parseJson: vi.fn(),
    commandSupport: vi.fn(() => undefined),
    ENGINE_VERSION: '0.0.0-test',
    LabError: class LabError extends Error {},
}));

const VALIDATE_COMMAND = `calm validate ${ARCHITECTURE_FILE}`;
const STEP_ONE = /Look around/;

function stepOneCompleted() {
    return screen.queryByRole('button', {name: /Look around \(completed\)/}) !== null;
}

async function runCommand(command) {
    const input = screen.getByLabelText('Terminal input');
    fireEvent.change(input, {target: {value: command}});
    await act(async () => {
        fireEvent.keyDown(input, {key: 'Enter'});
    });
}

beforeEach(() => {
    engine.validateArchitecture.mockReset();
    engine.validateArchitecture.mockImplementation(async () => engine.okResult());
});

describe('Lab', () => {
    it('completes the first step once `calm validate` succeeds', async () => {
        await act(async () => {
            render(<Lab />);
        });
        expect(screen.getByRole('button', {name: STEP_ONE})).toBeInTheDocument();
        expect(stepOneCompleted()).toBe(false);

        await runCommand(VALIDATE_COMMAND);

        await waitFor(() => expect(stepOneCompleted()).toBe(true));
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
            render(<Lab />);
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
            render(<Lab />);
        });

        fireEvent.click(screen.getByRole('tab', {name: /Problems/}));

        expect(screen.getByText(/showing first 20 of 45 problems/)).toBeInTheDocument();
        // The badge reports the real total, not the 20 the panel can list.
        expect(screen.getByRole('button', {name: /✗ 45 problems/})).toBeInTheDocument();
    });

    it('does not complete a step from a validate the learner reset away', async () => {
        await act(async () => {
            render(<Lab />);
        });

        const inFlight = {resolve: null};
        engine.validateArchitecture.mockImplementationOnce(
            () => new Promise((resolve) => {
                inFlight.resolve = () => resolve(engine.okResult());
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
            inFlight.resolve();
        });

        await waitFor(() => expect(screen.getByLabelText('Terminal input')).not.toBeDisabled());
        expect(stepOneCompleted()).toBe(false);
    });
});
