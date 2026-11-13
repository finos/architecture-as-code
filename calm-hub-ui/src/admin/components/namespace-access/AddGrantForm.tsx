import { useState } from 'react';
import { UserAccessPermission, UserAccessRequest, UserAccessSubjectType } from '../../../model/user-access.js';

const PERMISSIONS: UserAccessPermission[] = ['read', 'write', 'admin'];
const SUBJECT_TYPES: UserAccessSubjectType[] = ['user', 'group'];

interface AddGrantFormProps {
    onSubmit: (request: UserAccessRequest) => Promise<void>;
}

export function AddGrantForm({ onSubmit }: AddGrantFormProps) {
    const [subjectType, setSubjectType] = useState<UserAccessSubjectType>('user');
    const [username, setUsername] = useState('');
    const [permission, setPermission] = useState<UserAccessPermission>('read');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const trimmed = username.trim();
    const isGroup = subjectType === 'group';
    const invalidGroupName = isGroup && trimmed === '*';
    const nameLabel = isGroup ? 'Group name' : 'Username';

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!trimmed || invalidGroupName) return;

        setSubmitting(true);
        setError(null);
        try {
            await onSubmit({ username: trimmed, subjectType, permission });
            setUsername('');
            setSubjectType('user');
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
                <span className="text-xs font-medium">Type</span>
                <select
                    className="select select-sm select-bordered"
                    value={subjectType}
                    onChange={(e) => setSubjectType(e.target.value as UserAccessSubjectType)}
                    disabled={submitting}
                    aria-label="Subject type"
                >
                    {SUBJECT_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                    ))}
                </select>
            </div>
            <div className="flex flex-col gap-1">
                <span className="text-xs font-medium">{nameLabel}</span>
                <input
                    className="input input-sm input-bordered w-48"
                    type="text"
                    placeholder={isGroup ? 'group name' : 'username or *'}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={submitting}
                    aria-label={nameLabel}
                    aria-invalid={invalidGroupName}
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
                disabled={submitting || !trimmed || invalidGroupName}
            >
                {submitting ? 'Granting…' : 'Grant Access'}
            </button>
            {invalidGroupName && (
                <p className="text-error text-xs w-full">* is not a valid group name.</p>
            )}
            {error && (
                <p className="text-error text-xs w-full" role="alert">{error}</p>
            )}
        </form>
    );
}
