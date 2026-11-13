import { UserAccess, UserAccessPermission, isGroupGrant, subjectLabel } from '../../../model/user-access.js';

const PERMISSION_BADGE: Record<UserAccessPermission, string> = {
    read: 'badge-info',
    write: 'badge-warning',
    admin: 'badge-error',
};

interface GrantRowProps {
    grant: UserAccess;
    onRequestRevoke: (grant: UserAccess) => void;
}

export function GrantRow({ grant, onRequestRevoke }: GrantRowProps) {
    const group = isGroupGrant(grant);
    const displayName = !group && grant.username === '*' ? '* (everyone)' : grant.username;

    return (
        <tr>
            <td className="font-mono text-sm">{displayName}</td>
            <td>
                <span className={`badge badge-sm ${group ? 'badge-neutral' : 'badge-ghost'}`}>
                    {group ? 'group' : 'user'}
                </span>
            </td>
            <td>
                <span className={`badge badge-sm ${PERMISSION_BADGE[grant.permission]}`}>
                    {grant.permission}
                </span>
            </td>
            <td className="text-right">
                <button
                    className="btn btn-xs btn-error btn-outline"
                    onClick={() => onRequestRevoke(grant)}
                    aria-label={`Revoke access for ${subjectLabel(grant)}`}
                >
                    Revoke
                </button>
            </td>
        </tr>
    );
}
