import { useState } from 'react';
import { UserAccessPermission, UserAccessRequest } from '../../../model/user-access.js';

const PERMISSIONS: UserAccessPermission[] = ['read', 'write', 'admin'];

interface AddGrantFormProps {
    onSubmit: (request: UserAccessRequest) => Promise<void>;
}

export function AddGrantForm({ onSubmit }: AddGrantFormProps) {
    const [username, setUsername] = useState('');
    const [permission, setPermission] = useState<UserAccessPermission>('read');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const trimmed = username.trim();
        if (!trimmed) return;

        setSubmitting(true);
        setError(null);
        try {
            await onSubmit({ username: trimmed, permission });
            setUsername('');
            setPermission('read');
        } catch {
            setError('Failed to grant access. Please try again.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="flex items-end gap-2 flex-wrap">
            <div className="flex flex-col gap-1">
                <span className="text-xs font-medium">Username</span>
                <input
                    className="input input-sm input-bordered w-48"
                    type="text"
                    placeholder="username or *"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={submitting}
                    aria-label="Username"
                />
            </div>
            <div className="flex flex-col gap-1">
                <span className="text-xs font-medium">Permission</span>
                <select
                    className="select select-sm select-bordered"
                    value={permission}
                    onChange={(e) => setPermission(e.target.value as UserAccessPermission)}
                    disabled={submitting}
                    aria-label="Permission"
                >
                    {PERMISSIONS.map((p) => (
                        <option key={p} value={p}>{p}</option>
                    ))}
                </select>
            </div>
            <button
                type="submit"
                className="btn btn-sm btn-primary"
                disabled={submitting || !username.trim()}
            >
                {submitting ? 'Granting…' : 'Grant Access'}
            </button>
            {error && (
                <p className="text-error text-xs w-full" role="alert">{error}</p>
            )}
        </form>
    );
}
