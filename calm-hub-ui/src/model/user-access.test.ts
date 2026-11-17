import { describe, it, expect } from 'vitest';
import { UserAccess, isGroupGrant, subjectLabel } from './user-access.js';

const grant = (overrides: Partial<UserAccess>): UserAccess => ({
    userAccessId: 1,
    username: 'alice',
    permission: 'read',
    namespace: 'finos',
    ...overrides,
});

describe('user-access model', () => {
    it('treats a grant without a subject type as a user grant', () => {
        expect(isGroupGrant(grant({}))).toBe(false);
        expect(isGroupGrant(grant({ subjectType: 'user' }))).toBe(false);
        expect(isGroupGrant(grant({ subjectType: 'group' }))).toBe(true);
    });

    it('labels users, everyone and groups', () => {
        expect(subjectLabel(grant({}))).toBe('alice');
        expect(subjectLabel(grant({ username: '*' }))).toBe('* (everyone)');
        expect(subjectLabel(grant({ username: 'architects', subjectType: 'group' }))).toBe('architects (group)');
    });
});
