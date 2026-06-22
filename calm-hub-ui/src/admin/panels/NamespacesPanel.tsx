import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalmService } from '../../service/calm-service.js';

interface NamespacesPanelProps {
    calmService?: CalmService;
}

export function NamespacesPanel({ calmService }: NamespacesPanelProps) {
    const svc = useMemo(() => calmService ?? new CalmService(), [calmService]);

    const [namespaces, setNamespaces] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const load = useCallback(() => {
        setLoading(true);
        setLoadError(null);
        svc.fetchNamespaces()
            .then(setNamespaces)
            .catch(() => setLoadError('Failed to load namespaces.'))
            .finally(() => setLoading(false));
    }, [svc]);

    useEffect(() => { load(); }, [load]);

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
            load();
        } catch {
            setSubmitError('Failed to create namespace.');
        } finally {
            setSubmitting(false);
        }
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
                            placeholder="Description (optional)"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            aria-label="Namespace description"
                        />
                        {submitError && <p className="text-error text-sm" role="alert">{submitError}</p>}
                        {success && <p className="text-success text-sm" role="status">{success}</p>}
                        <button
                            className="btn btn-primary btn-sm self-start"
                            type="submit"
                            disabled={submitting || !name.trim()}
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
                    <ul className="flex flex-wrap gap-2">
                        {namespaces.map((ns) => (
                            <li key={ns} className="badge badge-ghost badge-lg">{ns}</li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}
