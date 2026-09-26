import {describe, it, expect, vi} from 'vitest';
import {render} from '@testing-library/react';
import Editor from './Editor';

describe('Editor', () => {
    it('colours a .json file as JSON', () => {
        const {container} = render(
            <Editor fileName="a.json" value='{"a": 1}' onChange={vi.fn()} onSave={vi.fn()} />,
        );
        expect(container.querySelector('[class*="tokKey"]')).not.toBeNull();
        expect(container.querySelector('[class*="tokNumber"]')).not.toBeNull();
    });

    it('renders a non-.json file as plain text, even when it looks like JSON', () => {
        const {container} = render(
            <Editor fileName="notes.md" value='{"a": 1}' onChange={vi.fn()} onSave={vi.fn()} />,
        );
        expect(container.querySelector('[class*="tok"]')).toBeNull();
        expect(container.querySelector('pre')?.textContent).toContain('{"a": 1}');
    });
});
