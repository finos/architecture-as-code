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
    diffArchitectures: vi.fn(),
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
