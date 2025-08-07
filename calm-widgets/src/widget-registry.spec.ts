import { describe, it, expect, beforeEach, vi } from 'vitest';
import Handlebars from 'handlebars';
import { WidgetRegistry } from './widget-registry';
import { CalmWidget } from './types';
import { vol } from 'memfs';
import { createFsFromVolume } from 'memfs';
import * as fs from 'fs';

const memFs = createFsFromVolume(vol);

describe('WidgetRegistry (with memfs)', () => {
    const registerPartial = vi.fn();
    const registerHelper = vi.fn();
    const mockHandlebars = {
        registerPartial,
        registerHelper,
    } as unknown as typeof Handlebars;

    let registry: WidgetRegistry;

    beforeEach(() => {
        vol.reset(); // Reset in-memory filesystem
        vi.clearAllMocks();

        const readFileSyncCompat = memFs.readFileSync.bind(memFs) as unknown as typeof fs.readFileSync;
        registry = new WidgetRegistry(mockHandlebars, readFileSyncCompat);
    });

    it('registers main and partial templates using memfs', () => {
        vol.fromJSON({
            '/widget/main.hbs': 'Main Template Content',
            '/widget/sub1.hbs': 'Subtemplate 1',
            '/widget/sub2.hbs': 'Subtemplate 2',
        });

        const widget: CalmWidget = {
            id: 'my-widget',
            templatePartial: 'main.hbs',
            partials: ['sub1.hbs', 'sub2.hbs'],
            validateContext: function (context: unknown): context is unknown {
                return false;
            }
        };

        registry.register(widget, '/widget');

        expect(registerPartial).toHaveBeenCalledWith('main.hbs', 'Main Template Content');
        expect(registerPartial).toHaveBeenCalledWith('my-widget', 'Main Template Content');
        expect(registerPartial).toHaveBeenCalledWith('sub1.hbs', 'Subtemplate 1');
        expect(registerPartial).toHaveBeenCalledWith('sub2.hbs', 'Subtemplate 2');
    });

    it('registers helpers if provided', () => {
        vol.fromJSON({
            '/widget/main.hbs': 'Main Template',
        });

        const widget: CalmWidget<unknown,object,unknown> = {
            id: 'helper-widget',
            templatePartial: 'main.hbs',
            registerHelpers: () => ({
                shout: (...args: unknown[]) => {
                    const s = args[0] as string;
                    return s.toUpperCase();
                },
                count: (...args: unknown[]) => {
                    const arr = args[0] as unknown[];
                    return arr.length;
                },
            }),
            validateContext: function (context: unknown): context is unknown {
                return true;
            }
        };

        registry.register(widget, '/widget');

        expect(registerHelper).toHaveBeenCalledWith('shout', expect.any(Function));
        expect(registerHelper).toHaveBeenCalledWith('count', expect.any(Function));
    });

    it('can retrieve registered widget', () => {
        vol.fromJSON({
            '/widget/main.hbs': 'Main Template',
        });

        const widget: CalmWidget = {
            id: 'retrievable',
            templatePartial: 'main.hbs',
            validateContext: function (context: unknown): context is unknown {
                return true;
            }
        };

        registry.register(widget, '/widget');
        expect(registry.get('retrievable')?.id).toBe('retrievable');
    });

    it('clears widgets', () => {
        vol.fromJSON({
            '/widget/main.hbs': 'Main Template',
        });

        const widget: CalmWidget = {
            id: 'clear-me',
            templatePartial: 'main.hbs',
            validateContext: function (context: unknown): context is unknown {
                return true;
            }
        };

        registry.register(widget, '/widget');
        expect(registry.get('clear-me')).toBeDefined();

        registry.clear();
        expect(registry.get('clear-me')).toBeUndefined();
    });
});
