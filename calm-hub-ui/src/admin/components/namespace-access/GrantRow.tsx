import { UserAccess, UserAccessPermission } from '../../../model/user-access.js';

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
    const displayUsername = grant.username === '*' ? '* (everyone)' : grant.username;

    return (
        <tr>
            <td className="font-mono text-sm">{displayUsername}</td>
            <td>
                <span className={`badge badge-sm ${PERMISSION_BADGE[grant.permission]}`}>
                    {grant.permission}
                </span>
            </td>
            <td className="text-right">
                <button
                    className="btn btn-xs btn-error btn-outline"
                    onClick={() => onRequestRevoke(grant)}
                    aria-label={`Revoke access for ${displayUsername}`}
                >
                    Revoke
                </button>
            </td>
        </tr>
    );
}
