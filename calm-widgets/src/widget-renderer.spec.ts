import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import Handlebars from 'handlebars';
import { WidgetRenderer } from './widget-renderer';
import { WidgetRegistry } from './widget-registry';
import { CalmWidget } from './types';

describe('WidgetRenderer', () => {
    const compileMock = vi.fn();
    const templateFnMock = vi.fn();

    const mockHandlebars = {
        compile: compileMock,
    } as unknown as typeof Handlebars;

    let registry: WidgetRegistry;
    let renderer: WidgetRenderer;

    const widgetBase: Partial<CalmWidget> = {
        id: 'test-widget',
        templatePartial: 'main.hbs',
    };

    beforeEach(() => {
        vi.clearAllMocks();
        compileMock.mockReset();
        templateFnMock.mockReset();

        registry = {
            get: vi.fn(),
        } as unknown as WidgetRegistry;

        renderer = new WidgetRenderer(mockHandlebars, registry);
    });

    it('throws if widget is not found', () => {
        (registry.get as Mock).mockReturnValue(undefined);

        expect(() =>
            renderer.render('missing-widget', {})
        ).toThrow('Widget \'missing-widget\' not found.');
    });

    it('throws if context is invalid', () => {
        (registry.get as Mock).mockReturnValue({
            ...widgetBase,
            validateContext: () => false,
        });

        expect(() =>
            renderer.render('test-widget', {})
        ).toThrow('Invalid context for widget \'test-widget\'');
    });

    it('uses transformToViewModel if present', () => {
        const widget: CalmWidget = {
            id: 'test-widget',
            templatePartial: 'main.hbs',
            validateContext: (context: unknown): context is unknown => true,
            transformToViewModel: vi.fn().mockImplementation((ctx) => ({
                wrapped: ctx,
            })),
        };

        (registry.get as Mock).mockReturnValue(widget);
        compileMock.mockReturnValue(templateFnMock);
        templateFnMock.mockReturnValue('rendered output');

        const result = renderer.render('test-widget', { foo: 'bar' });

        expect(widget.transformToViewModel).toHaveBeenCalledWith({ foo: 'bar' }, undefined);
        expect(templateFnMock).toHaveBeenCalledWith({ wrapped: { foo: 'bar' } });
        expect(result).toBe('rendered output');
    });

    it('uses raw context if no transformToViewModel present', () => {
        const widget: CalmWidget = {
            id: 'plain-widget',
            templatePartial: 'main.hbs',
            validateContext: (context: unknown): context is unknown => true,
        };

        (registry.get as Mock).mockReturnValue(widget);
        compileMock.mockReturnValue(templateFnMock);
        templateFnMock.mockReturnValue('plain output');

        const result = renderer.render('plain-widget', { a: 1 });

        expect(templateFnMock).toHaveBeenCalledWith({ a: 1 });
        expect(result).toBe('plain output');
    });
});
