import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalmService } from '../../service/calm-service.js';
import { NamespaceRow } from '../components/namespaces/NamespaceRow.js';
import { ConfirmDeleteDialog } from '../components/ConfirmDeleteDialog.js';
import { useDeleteConfirmation } from '../hooks/useDeleteConfirmation.js';

interface NamespacesPanelProps {
    calmService?: CalmService;
}

interface NamespaceDetails {
    name: string;
    description: string;
}

export function NamespacesPanel({ calmService }: NamespacesPanelProps) {
    const svc = useMemo(() => calmService ?? new CalmService(), [calmService]);

    const [namespaces, setNamespaces] = useState<NamespaceDetails[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const request = useCallback(
        () =>
            svc.fetchNamespaceDetails()
                .then(setNamespaces)
                .catch(() => setLoadError('Failed to load namespaces.'))
                .finally(() => setLoading(false)),
        [svc]
    );

    useEffect(() => { request(); }, [request]);

    const load = useCallback(() => {
        setLoading(true);
        setLoadError(null);
        return request();
    }, [request]);

    const {
        pending: pendingDelete,
        deleting,
        error: deleteError,
        requestDelete: handleRequestDelete,
        cancelDelete: handleCancelDelete,
        confirmDelete: handleConfirmDelete,
    } = useDeleteConfirmation((namespaceName) => svc.deleteNamespace(namespaceName), load, 'Failed to delete namespace.');

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        setSubmitError(null);
        setSuccess(null);
        try {
            await svc.createNamespace(name.trim(), description.trim());
            setSuccess(`Namespace '${name.trim()}' created.`);
            setName('');
            setDescription('');
            await load();
        } catch (err) {
            setSubmitError(err instanceof Error ? err.message : 'Failed to create namespace.');
        } finally {
            setSubmitting(false);
        }
    }

    async function handleSaveDescription(namespaceName: string, newDescription: string) {
        await svc.updateNamespace(namespaceName, newDescription);
        // Awaited so NamespaceRow doesn't flip back to display mode (via its own
        // `await onSave(...)`) until the refetched description has actually landed —
        // otherwise it would briefly render the stale pre-edit value.
        await load();
    }

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">Namespaces</h1>

            <section aria-label="Create namespace" className="card bg-base-100 shadow mb-8">
                <div className="card-body">
                    <h2 className="card-title text-lg">Create Namespace</h2>
                    <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-sm">
                        <input
                            className="input input-bordered input-sm"
                            placeholder="Name (e.g. org.team)"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            aria-label="Namespace name"
                        />
                        <input
                            className="input input-bordered input-sm"
                            placeholder="Description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            required
                            aria-label="Namespace description"
                        />
                        {submitError && <p className="text-error text-sm" role="alert">{submitError}</p>}
                        {success && <p className="text-success text-sm" role="status">{success}</p>}
                        <button
                            className="btn btn-primary btn-sm self-start"
                            type="submit"
                            disabled={submitting || !name.trim() || !description.trim()}
                        >
                            {submitting ? 'Creating…' : 'Create'}
                        </button>
                    </form>
                </div>
            </section>

            <section aria-label="Existing namespaces">
                <h2 className="text-lg font-semibold mb-3">Existing Namespaces</h2>
                {loading && <span className="loading loading-spinner" aria-label="Loading namespaces" />}
                {!loading && loadError && <p className="text-error text-sm" role="alert">{loadError}</p>}
                {!loading && !loadError && namespaces.length === 0 && (
                    <p className="text-base-content/50 text-sm italic">No namespaces yet.</p>
                )}
                {!loading && namespaces.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="table table-sm">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Description</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {namespaces.map((ns) => (
                                    <NamespaceRow
                                        key={ns.name}
                                        name={ns.name}
                                        description={ns.description}
                                        onSave={handleSaveDescription}
                                        onRequestDelete={handleRequestDelete}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <ConfirmDeleteDialog
                open={!!pendingDelete}
                message={
                    <>
                        Delete namespace <span className="font-mono font-semibold">{pendingDelete}</span>?
                        This also removes all user-access grants for it. This cannot be undone.
                    </>
                }
                error={deleteError}
                deleting={deleting}
                onConfirm={handleConfirmDelete}
                onCancel={handleCancelDelete}
            />
        </div>
    );
}
