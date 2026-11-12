import { expect, it } from 'vitest';
import { decoratorKeys } from './decoratorKeys.js';

it('keys a decorator on its uniqueId, so the key does not change when the list shifts', () => {
    expect(decoratorKeys([{ uniqueId: 'a' }, { uniqueId: 'b' }])).toEqual(['id:a', 'id:b']);
    expect(decoratorKeys([{ uniqueId: 'new' }, { uniqueId: 'a' }, { uniqueId: 'b' }])).toEqual(['id:new', 'id:a', 'id:b']);
});

it('falls back to the index for a missing, empty or repeated uniqueId', () => {
    expect(decoratorKeys([{}, { uniqueId: '' }, { uniqueId: 'dup' }, { uniqueId: 'dup' }, { uniqueId: 'ok' }])).toEqual([
        'index:0', 'index:1', 'index:2', 'index:3', 'id:ok',
    ]);
});

it('does not let an id collide with an index key', () => {
    expect(decoratorKeys([{}, { uniqueId: '0' }])).toEqual(['index:0', 'id:0']);
});
