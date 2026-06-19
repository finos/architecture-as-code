import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalmService } from '../../service/calm-service.js';

interface DomainsPanelProps {
    calmService?: CalmService;
}

export function DomainsPanel({ calmService }: DomainsPanelProps) {
    const svc = useMemo(() => calmService ?? new CalmService(), [calmService]);

    const [domains, setDomains] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [name, setName] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const load = useCallback(() => {
        setLoading(true);
        setLoadError(null);
        svc.fetchDomains()
            .then(setDomains)
            .catch(() => setLoadError('Failed to load domains.'))
            .finally(() => setLoading(false));
    }, [svc]);

    useEffect(() => { load(); }, [load]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        setSubmitError(null);
        setSuccess(null);
        try {
            await svc.createDomain(name.trim());
            setSuccess(`Domain '${name.trim()}' created.`);
            setName('');
            load();
        } catch {
            setSubmitError('Failed to create domain.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">Domains</h1>

            <section aria-label="Create domain" className="card bg-base-100 shadow mb-8">
                <div className="card-body">
                    <h2 className="card-title text-lg">Create Domain</h2>
                    <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-sm">
                        <input
                            className="input input-bordered input-sm"
                            placeholder="Name (e.g. payments)"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            aria-label="Domain name"
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

            <section aria-label="Existing domains">
                <h2 className="text-lg font-semibold mb-3">Existing Domains</h2>
                {loading && <span className="loading loading-spinner" aria-label="Loading domains" />}
                {!loading && loadError && <p className="text-error text-sm" role="alert">{loadError}</p>}
                {!loading && !loadError && domains.length === 0 && (
                    <p className="text-base-content/50 text-sm italic">No domains yet.</p>
                )}
                {!loading && domains.length > 0 && (
                    <ul className="flex flex-wrap gap-2">
                        {domains.map((d) => (
                            <li key={d} className="badge badge-ghost badge-lg">{d}</li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}
