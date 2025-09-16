import {describe, it, expect, vi, beforeEach, Mock} from 'vitest';
import handlebars from 'handlebars';
import { WidgetEngine } from './widget-engine';
import { WidgetRegistry } from './widget-registry';
import { CalmWidget } from './types';
import { WidgetRenderer } from './widget-renderer';

const globalHelpers = {
    kebabToTitleCase: (s: string) => s.replace(/-/g, ' '),
    notEmpty: (obj: object) => !!obj && Object.keys(obj).length > 0,
};

vi.mock('./widget-helpers', () => ({
    registerGlobalTemplateHelpers: () => globalHelpers,
}));

vi.mock('./widget-renderer', () => ({
    WidgetRenderer: vi.fn().mockImplementation(() => ({
        render: vi.fn().mockReturnValue('rendered-content'),
    })),
}));

vi.mock('./widgets/json-viewer', () => ({
    JsonViewerWidget: {
        id: 'json-viewer',
        templatePartial: 'json.hbs',
        validateContext: () => true,
    },
}));

vi.mock('./widgets/list', () => ({
    ListWidget: {
        id: 'list',
        templatePartial: 'list.hbs',
        validateContext: () => true,
    },
}));

vi.mock('./widgets/table', () => ({
    TableWidget: {
        id: 'table',
        templatePartial: 'table.hbs',
        validateContext: () => true,
    },
}));

describe('WidgetEngine', () => {
    let localHandlebars: typeof handlebars;
    const registerMock = vi.fn();
    let registry: WidgetRegistry;
    let engine: WidgetEngine;

    beforeEach(() => {
        vi.clearAllMocks();
        localHandlebars = handlebars.create(); // ✅ fresh handlebars with empty helpers
        vi.spyOn(localHandlebars, 'registerHelper');
        registry = { register: registerMock } as unknown as WidgetRegistry;
        engine = new WidgetEngine(localHandlebars, registry);
    });

    describe('setupWidgets', () => {
        it('registers global helpers and widgets', () => {
            const mockWidget: CalmWidget<unknown, Record<string, unknown>, unknown> = {
                id: 'mock-widget',
                templatePartial: 'main.hbs',
                validateContext: (_context): _context is unknown => true,
            };

            engine.setupWidgets([{ widget: mockWidget, folder: '/mock' }]);

            expect(localHandlebars.registerHelper).toHaveBeenCalledWith('kebabToTitleCase', expect.any(Function));
            expect(localHandlebars.registerHelper).toHaveBeenCalledWith('notEmpty', expect.any(Function));
            expect(registerMock).toHaveBeenCalledWith(mockWidget, '/mock');
            expect(localHandlebars.registerHelper).toHaveBeenCalledWith('mock-widget', expect.any(Function));
        });

        it('throws if widget id collides with global helper', () => {
            const badWidget: CalmWidget<unknown, Record<string, unknown>, unknown> = {
                id: 'notEmpty',
                templatePartial: 'oops.hbs',
                validateContext: (_): _ is unknown => true,
            };

            expect(() => {
                engine.setupWidgets([{ widget: badWidget, folder: '/bad' }]);
            }).toThrowError('[WidgetEngine] ❌ Conflict: widget id \'notEmpty\' collides with a global helper name.');
        });

        it('throws if widget id already registered as helper', () => {
            localHandlebars.registerHelper('table', () => true);

            const conflictingWidget: CalmWidget<unknown, Record<string, unknown>, unknown> = {
                id: 'table',
                templatePartial: 'conflict.hbs',
                validateContext: (_): _ is unknown => true,
            };

            expect(() => {
                engine.setupWidgets([{ widget: conflictingWidget, folder: '/conflict' }]);
            }).toThrowError('[WidgetEngine] ❌ Conflict: Handlebars already has a helper registered as \'table\'.');
        });

        it('handles empty widget array', () => {
            engine.setupWidgets([]);
            expect(registerMock).not.toHaveBeenCalled();
        });
    });

    describe('registerWidgetHelper', () => {
        it('calls WidgetRenderer and returns SafeString', () => {
            engine.registerWidgetHelper('test-widget');

            const calls = (localHandlebars.registerHelper as Mock).mock.calls;
            const [helperName, helperFn] = calls.find(([name]) => name === 'test-widget')!;

            const output = helperFn({ some: 'context' }, { hash: {} });

            expect(helperName).toBe('test-widget');
            expect(output.toString()).toBe('rendered-content');
            expect(WidgetRenderer).toHaveBeenCalledWith(localHandlebars, registry);
        });
    });

    describe('registerDefaultWidgets', () => {
        it('registers the default widgets (list, table, json-viewer, flow-sequence, related-nodes, block-architecture)', () => {
            engine.registerDefaultWidgets();

            expect(registerMock).toHaveBeenCalledTimes(6);
            expect(localHandlebars.registerHelper).toHaveBeenCalledWith('list', expect.any(Function));
            expect(localHandlebars.registerHelper).toHaveBeenCalledWith('table', expect.any(Function));
            expect(localHandlebars.registerHelper).toHaveBeenCalledWith('json-viewer', expect.any(Function));
            expect(localHandlebars.registerHelper).toHaveBeenCalledWith('flow-sequence', expect.any(Function));
            expect(localHandlebars.registerHelper).toHaveBeenCalledWith('related-nodes', expect.any(Function));
            expect(localHandlebars.registerHelper).toHaveBeenCalledWith('block-architecture', expect.any(Function));
        });
    });
});
