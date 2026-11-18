import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExtensionContext, ExtensionForm, ExtensionSummary } from '../../model/extensions.js';
import { CalmService } from '../../service/calm-service.js';
import { ExtensionService, FormOutcome, FormSubmission } from '../../service/extension-service.js';
import { ExtensionsProvider } from '../ExtensionsContext.js';
import { ExtensionSlot } from '../ExtensionSlot.js';
import { useExtensionRevision } from '../extensionRefresh.js';
import { FormPoint } from './FormBlock.js';

const REVIEW: ExtensionForm = {
    id: 'request-review',
    title: 'Request a review',
    route: 'request-review',
    target: 'element',
    submitLabel: 'Request review',
    fields: [
        {
            id: 'reviewType',
            type: 'choice',
            label: 'Review type',
            required: true,
            options: [
                { value: 'security', label: 'Security' },
                { value: 'design', label: 'Design' },
            ],
        },
        { id: 'note', type: 'multiline', label: 'Note', required: true, help: 'What to check.' },
        { id: 'urgent', type: 'checkbox', label: 'Urgent' },
    ],
};

const extension: ExtensionSummary = {
    id: 'release-tracker',
    name: 'Release Tracker',
    hubApi: 0,
    routes: [
        { id: 'panel', method: 'GET', path: '/panel', scope: 'read', readOnly: true },
        { id: 'request-review', method: 'POST', path: '/reviews/{namespace}', scope: 'write', readOnly: false },
    ],
    contributes: { form: [REVIEW] },
};
const panel = { id: 'review', title: 'Review', route: 'panel' };
const API = { namespace: 'finos', resourceType: 'architectures', resourceId: '1', version: '1.0.0', selectedElement: 'api' };
const DB = { ...API, selectedElement: 'db' };

let replies: ((outcome: FormOutcome) => void)[];
let submissions: FormSubmission[];

beforeEach(() => {
    replies = [];
    submissions = [];
    vi.spyOn(ExtensionService.prototype, 'fetchExtensions').mockResolvedValue([]);
    vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue({ hubApi: 0, blocks: [{ type: 'form', form: 'request-review' }] });
    vi.spyOn(ExtensionService.prototype, 'submitForm').mockImplementation((_id, _form, body) => {
        submissions.push(body);
        return new Promise((resolve) => replies.push(resolve));
    });
});
afterEach(() => vi.restoreAllMocks());

function Revision() {
    return <output data-testid="revision">{useExtensionRevision('release-tracker')}</output>;
}

interface SlotProps {
    context?: ExtensionContext;
    point?: FormPoint;
    ext?: ExtensionSummary;
    shown?: boolean;
}

function Slot({ context = API, point = 'detail-panel', ext = extension, shown = true }: SlotProps) {
    return (
        <ExtensionsProvider>
            {shown && <ExtensionSlot extension={ext} contribution={panel} context={context} point={point} headingLevel={3} />}
            <Revision />
        </ExtensionsProvider>
    );
}

/**
 * Renders, then lets the mocked slot reply land inside act, so React mounts the form and its draft subscription starts
 * before the test acts on it. A findBy alone can return before that effect runs: a click then renders late.
 */
async function show(ui: ReactElement) {
    const view = render(ui);
    await act(async () => {});
    return {
        ...view,
        rerender: async (next: ReactElement) => {
            view.rerender(next);
            await act(async () => {});
        },
    };
}

const reply = async (outcome: FormOutcome) => {
    await act(async () => replies.shift()!(outcome));
};
const submitButton = () => screen.getByRole('button', { name: /Request review|Send again|Sending/ });

async function fill() {
    fireEvent.change(await screen.findByLabelText(/Review type/), { target: { value: 'design' } });
    fireEvent.change(screen.getByLabelText(/Note/), { target: { value: 'Check the ledger' } });
}

async function sendConfirmed() {
    fireEvent.click(submitButton());
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Send' }));
}

describe('FormBlock', () => {
    it('labels each field and shows a message on each field that fails, without sending', async () => {
        await show(<Slot />);
        expect(await screen.findByRole('heading', { level: 4, name: 'Request a review' })).toBeInTheDocument();
        expect(screen.getByLabelText(/Note/)).toHaveAccessibleDescription('What to check.');
        expect(screen.getByLabelText(/Urgent/)).not.toBeChecked();

        fireEvent.click(submitButton());

        expect(screen.getByLabelText(/Review type/)).toHaveAccessibleDescription('Choose an option.');
        expect(screen.getByLabelText(/Note/)).toHaveAccessibleDescription('What to check. Enter a value.');
        expect(screen.getByLabelText(/Review type/)).toHaveFocus();
        expect(screen.getByRole('alert')).toHaveTextContent('Check the 2 parts marked below.');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(ExtensionService.prototype.submitForm).not.toHaveBeenCalled();
    });

    it('confirms the write with its target, sends once while it is pending, and refreshes the extension after success', async () => {
        await show(<Slot />);
        await fill();
        fireEvent.click(submitButton());
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveTextContent('Send Request a review to Release Tracker?');
        expect(dialog).toHaveTextContent('architectures/1');
        expect(dialog).toHaveTextContent('api');
        fireEvent.click(within(dialog).getByRole('button', { name: 'Send' }));

        expect(submitButton()).toHaveTextContent('Sending…');
        expect(submitButton()).toHaveAttribute('aria-disabled', 'true');
        expect(screen.getByLabelText(/Note/)).toBeDisabled();
        expect(screen.getByText('Request a review: sending…')).toHaveAttribute('role', 'status');
        fireEvent.click(submitButton());
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(submissions).toHaveLength(1);
        expect(submissions[0].input).toEqual({ reviewType: 'design', note: 'Check the ledger', urgent: false });
        expect(submissions[0].context).toEqual({ ...API, resource: 'architectures/1' });
        expect(screen.getByTestId('revision')).toHaveTextContent('0');

        await reply({ kind: 'success', message: 'Review 12 opened.' });

        expect(screen.getByTestId('form-success')).toHaveTextContent(
            'Sent to Release Tracker for finos architectures/1 1.0.0, node api. Review 12 opened.'
        );
        expect(screen.getByTestId('revision')).toHaveTextContent('1');
        expect(screen.getByLabelText(/Note/)).toHaveValue('');
        expect(submitButton()).toHaveFocus();
    });

    it('keeps the input after a refusal and does not refresh', async () => {
        await show(<Slot />);
        await fill();
        await sendConfirmed();
        await reply({ kind: 'failed', sent: true, message: 'A review is already open.', fields: { note: 'Name the release.' } });

        expect(screen.getByRole('alert')).toHaveTextContent(
            'Not saved. A review is already open. Check the fields marked above. Your input is kept.'
        );
        expect(screen.getByLabelText(/Note/)).toHaveValue('Check the ledger');
        expect(screen.getByLabelText(/Note/)).toHaveAccessibleDescription('What to check. Name the release.');
        expect(screen.getByTestId('revision')).toHaveTextContent('0');
        expect(submitButton()).toHaveTextContent('Request review');
    });

    it('after an unknown outcome, sends the same input again with the same id, and holds changed input until it is settled', async () => {
        await show(<Slot />);
        await fill();
        await sendConfirmed();
        await reply({ kind: 'unknown' });

        expect(screen.getByRole('alert')).toHaveTextContent('may have been saved');
        expect(screen.getByTestId('revision')).toHaveTextContent('0');
        expect(submitButton()).toHaveTextContent('Send again');
        await sendConfirmed();
        await reply({ kind: 'unknown' });
        expect(submissions[1].submission).toBe(submissions[0].submission);

        // Changed input waits: the button explains why, and a click opens no dialog.
        const note = screen.getByLabelText(/Note/);
        fireEvent.change(note, { target: { value: 'Check the ledger and the queue' } });
        const warning = screen.getByRole('alert');
        expect(warning).toHaveTextContent(
            'CALM Hub cannot confirm whether Release Tracker saved your earlier submission for finos architectures/1 1.0.0, node api.'
        );
        expect(warning).toHaveTextContent('so the form does not send until the earlier submission is settled');
        expect(submitButton()).toHaveTextContent('Request review');
        expect(submitButton()).toHaveAttribute('aria-disabled', 'true');
        expect(submitButton()).toHaveAccessibleDescription(/^CALM Hub cannot confirm .* Or check Release Tracker, then forget it\.$/);
        fireEvent.click(submitButton());
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        // Back to the earlier input, with no send between: a repeat with the same id.
        fireEvent.change(note, { target: { value: 'Check the ledger' } });
        expect(submitButton()).toHaveTextContent('Send again');
        await sendConfirmed();
        expect(submissions.map((body) => body.submission)).toEqual(Array(3).fill(submissions[0].submission));
        await reply({ kind: 'success' });
        expect(screen.getByTestId('revision')).toHaveTextContent('1');
    });

    it('sends changed input with a new id only after the user forgets the earlier submission', async () => {
        await show(<Slot />);
        await fill();
        await sendConfirmed();
        await reply({ kind: 'unknown' });
        fireEvent.change(screen.getByLabelText(/Note/), { target: { value: 'Check the queue' } });

        fireEvent.click(screen.getByRole('button', { name: 'Forget the earlier submission' }));
        const ask = screen.getByRole('group', { name: 'Forget the earlier submission?' });
        expect(ask).toHaveTextContent('Check Release Tracker first. If it saved the submission, a new send can save it a second time.');
        expect(within(ask).getByRole('button', { name: 'Keep it' })).toHaveFocus();
        fireEvent.click(within(ask).getByRole('button', { name: 'Keep it' }));
        expect(submitButton()).toHaveAttribute('aria-disabled', 'true');

        fireEvent.click(screen.getByRole('button', { name: 'Forget the earlier submission' }));
        fireEvent.click(screen.getByRole('button', { name: 'Forget' }));
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(screen.getByLabelText(/Note/)).toHaveValue('Check the queue');
        expect(submitButton()).toHaveAttribute('aria-disabled', 'false');
        expect(submitButton()).toHaveFocus();
        await sendConfirmed();
        expect(submissions).toHaveLength(2);
        expect(submissions[1].submission).not.toBe(submissions[0].submission);
    });

    it('holds a new target after an unknown outcome as it holds changed input', async () => {
        const { rerender } = await show(<Slot />);
        await fill();
        await sendConfirmed();
        await reply({ kind: 'unknown' });
        await rerender(<Slot context={DB} />);
        fireEvent.click(within(await screen.findByTestId('retarget-notice')).getByRole('button', { name: 'Send to node db instead' }));

        expect(submitButton()).toHaveAttribute('aria-disabled', 'true');
        fireEvent.click(submitButton());
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(submissions).toHaveLength(1);
    });

    it('keeps the warning and Send again when Hub refuses the repeat before it sends it', async () => {
        await show(<Slot />);
        await fill();
        await sendConfirmed();
        await reply({ kind: 'unknown' });
        await sendConfirmed();
        await reply({ kind: 'failed', sent: false, message: 'The extension is busy.' });

        const warning = screen.getByRole('alert');
        expect(warning).toHaveTextContent('may have been saved');
        expect(warning).toHaveTextContent('CALM Hub did not send the last try: The extension is busy.');
        expect(warning).not.toHaveTextContent('Not saved');
        expect(submitButton()).toHaveTextContent('Send again');
        await sendConfirmed();
        await reply({ kind: 'success' });
        expect(submissions.map((body) => body.submission)).toEqual(Array(3).fill(submissions[0].submission));
    });

    it('keeps the warning and Clear after an unknown outcome of input that the user did not edit', async () => {
        const defaults: ExtensionForm = {
            ...REVIEW,
            fields: [
                { ...REVIEW.fields[0], default: 'security' },
                { ...REVIEW.fields[1], default: 'Routine check' },
            ],
        };
        await show(<Slot ext={{ ...extension, contributes: { form: [defaults] } }} />);
        await screen.findByLabelText(/Note/);
        await sendConfirmed();
        await reply({ kind: 'unknown' });
        expect(submissions[0].input).toEqual({ reviewType: 'security', note: 'Routine check' });

        const unload = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(unload);
        expect(unload.defaultPrevented).toBe(true);
        fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
        expect(screen.getByRole('group', { name: 'Discard your input?' })).toHaveTextContent(
            'Release Tracker may have saved your earlier submission. Discarding does not undo it.'
        );
        fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        const after = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(after);
        expect(after.defaultPrevented).toBe(false);
    });

    it('sends a screen form to the target that the page context fills, and keeps it after an edit', async () => {
        vi.spyOn(CalmService.prototype, 'fetchNamespaces').mockResolvedValue(['finos']);
        vi.spyOn(CalmService.prototype, 'fetchArchitectureSummaries').mockResolvedValue([{ id: 1, name: 'Payments' } as never]);
        vi.spyOn(CalmService.prototype, 'fetchArchitectureVersions').mockResolvedValue(['1.0.0']);
        vi.spyOn(CalmService.prototype, 'fetchArchitecture').mockResolvedValue({
            data: { nodes: [{ 'unique-id': 'api' }, { 'unique-id': 'db' }] },
        } as never);
        // The context of a typed screen link: the screen page remounts the slot when it changes.
        const screenContext = (selectedElement: string) => ({ ...API, resource: 'architectures/1', selectedElement });
        const Screen = ({ context }: { context: ExtensionContext }) => (
            <ExtensionsProvider>
                <ExtensionSlot key={JSON.stringify(context)} extension={extension} contribution={panel} context={context} point="screen" />
            </ExtensionsProvider>
        );
        const node = async () => within(await screen.findByRole('group', { name: 'Target' })).getByLabelText('Node');
        const { rerender, unmount } = await show(<Screen context={screenContext('api')} />);
        expect(await node()).toHaveValue('api');
        await fill();
        // The first edit pins the target, so a later screen link does not change it.
        await rerender(<Screen context={screenContext('db')} />);
        expect(await node()).toHaveValue('api');
        await sendConfirmed();
        expect(submissions[0].context).toEqual(screenContext('api'));
        await reply({ kind: 'success' });
        unmount();

        // An empty context is not a choice: an edit does not pin it, so a later screen link fills the picker.
        const next = await show(<Screen context={{}} />);
        await fill();
        await next.rerender(<Screen context={screenContext('db')} />);
        expect(await node()).toHaveValue('db');
    });

    it('keeps its target when the selection changes, and names both', async () => {
        const { rerender } = await show(<Slot />);
        await fill();
        await rerender(<Slot context={DB} />);

        const notice = await screen.findByTestId('retarget-notice');
        expect(notice).toHaveTextContent('The selection changed. This form still sends to finos architectures/1 1.0.0, node api.');
        expect(screen.getByLabelText(/Note/)).toHaveValue('Check the ledger');
        await sendConfirmed();
        expect(submissions[0].context.selectedElement).toBe('api');
        await reply({ kind: 'failed', sent: true });

        fireEvent.click(within(notice).getByRole('button', { name: 'Send to node db instead' }));
        expect(screen.queryByTestId('retarget-notice')).not.toBeInTheDocument();
        await sendConfirmed();
        expect(submissions[1].context.selectedElement).toBe('db');
    });

    it('keeps the input and a submission in flight while the slot is unmounted', async () => {
        const { rerender } = await show(<Slot />);
        await fill();
        await rerender(<Slot shown={false} />);
        await rerender(<Slot />);
        expect(await screen.findByLabelText(/Note/)).toHaveValue('Check the ledger');

        await sendConfirmed();
        await rerender(<Slot shown={false} />);
        await rerender(<Slot />);
        expect(await screen.findByRole('button', { name: 'Sending…' })).toHaveAttribute('aria-disabled', 'true');
        await reply({ kind: 'success' });
        expect(screen.getByTestId('revision')).toHaveTextContent('1');
        expect(submissions).toHaveLength(1);
    });

    it('sends a read-only form without a dialog, and does not refresh after it', async () => {
        const readOnly = { ...extension, routes: extension.routes.map((route) => ({ ...route, readOnly: true })) };
        await show(<Slot ext={readOnly} />);
        await fill();
        fireEvent.click(submitButton());
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(submissions).toHaveLength(1);
        await reply({ kind: 'success' });
        // A readOnly route changed nothing, so the extension does not reload.
        expect(screen.getByTestId('revision')).toHaveTextContent('0');
    });

    it('takes field ids such as constructor and toString, and shows a backend message only on its own field', async () => {
        const named: ExtensionForm = {
            ...REVIEW,
            fields: [
                { id: 'constructor', type: 'text', label: 'Builder', default: 'factory' },
                { id: 'toString', type: 'text', label: 'Label' },
                { id: 'valueOf', type: 'checkbox', label: 'Value' },
            ],
        };
        await show(<Slot ext={{ ...extension, contributes: { form: [named] } }} />);
        await screen.findByLabelText('Builder');
        expect(screen.getByLabelText('Builder')).not.toHaveAccessibleDescription();
        await sendConfirmed();
        expect(submissions[0].input).toEqual({ constructor: 'factory', valueOf: false });

        await reply({ kind: 'failed', sent: true, message: 'Check the form', fields: { toString: 'Name the label.' } });
        expect(screen.getByLabelText('Label')).toHaveAccessibleDescription('Name the label.');
        expect(screen.getByLabelText('Builder')).not.toHaveAccessibleDescription();
        expect(screen.getByLabelText('Value')).not.toHaveAccessibleDescription();
        expect(screen.getByRole('alert')).toHaveTextContent('Not saved. Check the form Check the fields marked above.');
    });

    it('counts only the backend messages of its own fields', async () => {
        await show(<Slot />);
        await fill();
        await sendConfirmed();
        await reply({ kind: 'failed', sent: true, message: 'Refused', fields: { other: 'Not a field of this form.' } });
        expect(screen.getByRole('alert')).toHaveTextContent('Not saved. Refused Your input is kept.');
    });

    it('says when this Hub does not have the form', async () => {
        await show(<Slot ext={{ ...extension, contributes: {} }} />);
        expect(await screen.findByRole('alert')).toHaveTextContent('This form is not available on this CALM Hub.');
    });

    it('asks before it discards input, and warns before the page unloads with unsent input', async () => {
        await show(<Slot />);
        await fill();
        const unload = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(unload);
        expect(unload.defaultPrevented).toBe(true);

        fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
        fireEvent.click(within(screen.getByRole('group', { name: 'Discard your input?' })).getByRole('button', { name: 'Keep editing' }));
        expect(screen.getByLabelText(/Note/)).toHaveValue('Check the ledger');
        fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
        fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
        expect(screen.getByLabelText(/Note/)).toHaveValue('');

        const after = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(after);
        expect(after.defaultPrevented).toBe(false);
    });

    it('lets a screen form choose its target', async () => {
        vi.spyOn(CalmService.prototype, 'fetchNamespaces').mockResolvedValue(['finos']);
        vi.spyOn(CalmService.prototype, 'fetchArchitectureSummaries').mockResolvedValue([{ id: 1, name: 'Payments' } as never]);
        vi.spyOn(CalmService.prototype, 'fetchArchitectureVersions').mockResolvedValue(['1.0.0']);
        await show(<Slot point="screen" context={{}} ext={{ ...extension, contributes: { form: [{ ...REVIEW, target: 'resource' }] } }} />);
        await fill();
        fireEvent.click(submitButton());
        expect(screen.getByText('Choose each part of the target.')).toBeInTheDocument();
        expect(screen.getByRole('alert')).toHaveTextContent('Check the part marked below.');
        expect(screen.getByLabelText('Namespace')).toHaveFocus();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        const target = screen.getByRole('group', { name: 'Target' });
        await waitFor(() => expect(within(target).getByLabelText('Namespace')).toBeEnabled());
        fireEvent.change(within(target).getByLabelText('Namespace'), { target: { value: 'finos' } });
        await waitFor(() => expect(within(target).getByLabelText('Architecture')).toBeEnabled());
        fireEvent.change(within(target).getByLabelText('Architecture'), { target: { value: '1' } });
        await waitFor(() => expect(within(target).getByLabelText('Version')).toBeEnabled());
        fireEvent.change(within(target).getByLabelText('Version'), { target: { value: '1.0.0' } });

        await sendConfirmed();
        expect(submissions[0].context).toEqual({
            namespace: 'finos',
            resource: 'architectures/1',
            resourceType: 'architectures',
            resourceId: '1',
            version: '1.0.0',
        });
        await reply({ kind: 'success' });
        // A target that the user chose stays for the next submission.
        expect(within(target).getByLabelText('Version')).toHaveValue('1.0.0');
    });

    it('lists the nodes of a pattern as the diagram finds them, and sends the node that the user chooses', async () => {
        const node = (id: string, name?: string) => ({
            properties: { 'unique-id': { const: id }, ...(name && { name: { const: name } }) },
        });
        const declares = (...nodes: object[]) => ({ properties: { nodes: { prefixItems: nodes } } });
        const patterns: Record<string, object> = {
            // Only allOf declares nodes: the first branch that declares them counts, as in the diagram.
            '7': {
                allOf: [
                    { properties: { relationships: { prefixItems: [] } } },
                    declares(node('gateway', 'API gateway'), node('ledger')),
                    declares(node('later')),
                ],
            },
            // The root and allOf declare nodes: the root counts.
            '8': { ...declares(node('root-node')), allOf: [declares(node('branch-node'))] },
        };
        vi.spyOn(CalmService.prototype, 'fetchNamespaces').mockResolvedValue(['finos']);
        vi.spyOn(CalmService.prototype, 'fetchPatternSummaries').mockResolvedValue([
            { id: 7, name: 'Gateway' },
            { id: 8, name: 'Mixed' },
        ] as never);
        vi.spyOn(CalmService.prototype, 'fetchPatternVersions').mockResolvedValue(['1.0.0']);
        vi.spyOn(CalmService.prototype, 'fetchPattern').mockImplementation(async (_namespace, id) => ({ data: patterns[id] }) as never);
        await show(<Slot point="screen" context={{}} />);
        await fill();
        const target = screen.getByRole('group', { name: 'Target' });
        const choose = async (label: string, value: string) => {
            await waitFor(() => expect(within(target).getByLabelText(label)).toBeEnabled());
            fireEvent.change(within(target).getByLabelText(label), { target: { value } });
        };
        const nodeLabels = () => [...within(target).getByLabelText<HTMLSelectElement>('Node').options].map((option) => option.textContent);

        await choose('Namespace', 'finos');
        fireEvent.change(within(target).getByLabelText('Type'), { target: { value: 'patterns' } });
        await choose('Pattern', '8');
        await choose('Version', '1.0.0');
        await waitFor(() => expect(within(target).getByLabelText('Node')).toBeEnabled());
        expect(nodeLabels()).toEqual(['Choose', 'root-node']);

        await choose('Pattern', '7');
        await choose('Version', '1.0.0');
        await choose('Node', 'ledger');
        expect(nodeLabels()).toEqual(['Choose', 'API gateway (gateway)', 'ledger']);
        await sendConfirmed();
        expect(submissions[0].context).toEqual({
            namespace: 'finos',
            resource: 'patterns/7',
            resourceType: 'patterns',
            resourceId: '7',
            version: '1.0.0',
            selectedElement: 'ledger',
        });
    });
});
