export type UserAccessPermission = 'read' | 'write' | 'admin';

export interface UserAccess {
    userAccessId: number;
    username: string;
    permission: UserAccessPermission;
    namespace?: string;
    domain?: string;
    creationDateTime?: string;
    updateDateTime?: string;
}

export interface UserAccessRequest {
    username: string;
    permission: UserAccessPermission;
}
