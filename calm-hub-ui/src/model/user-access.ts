export type UserAccessPermission = 'read' | 'write' | 'admin';

export type UserAccessSubjectType = 'user' | 'group';

export interface UserAccess {
    userAccessId: number;
    /** A user name, `*`, or (for a group grant) the group name. */
    username: string;
    /** Absent on grants created before group grants existed; treat as `user`. */
    subjectType?: UserAccessSubjectType;
    permission: UserAccessPermission;
    namespace?: string;
    domain?: string;
    creationDateTime?: string;
    updateDateTime?: string;
}

export interface UserAccessRequest {
    username: string;
    subjectType: UserAccessSubjectType;
    permission: UserAccessPermission;
}

export function isGroupGrant(grant: UserAccess): boolean {
    return grant.subjectType === 'group';
}

/** The name to show for a grant's subject in sentences and labels. */
export function subjectLabel(grant: UserAccess): string {
    if (isGroupGrant(grant)) return `${grant.username} (group)`;
    return grant.username === '*' ? '* (everyone)' : grant.username;
}
