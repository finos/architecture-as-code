import Handlebars from 'handlebars';
import { WidgetRegistry } from './widget-registry';
import { CalmWidget } from './types';
import { get, isPlainObject } from 'lodash';

function flattenOptions(options?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!isPlainObject(options)) return undefined;
    const maybeHash = get(options, 'hash');
    return isPlainObject(maybeHash) ? maybeHash as Record<string, unknown> : options;
}

export class WidgetRenderer {
    constructor(
        private handlebars: typeof Handlebars,
        private registry: WidgetRegistry
    ) {}

    render(
        widgetId: string,
        context: unknown,
        options?: Record<string, unknown>
    ): string {
        const widget: CalmWidget | undefined = this.registry.get(widgetId);
        if (!widget) throw new Error(`Widget '${widgetId}' not found.`);

        const flattenedOptions = flattenOptions(options);
        // TODO: Give more context on why the widget is invalid.
        if (!widget.validateContext?.(context, flattenedOptions)) {
            throw new Error(`Invalid context for widget '${widgetId}'`);
        }

        const transformed = widget.transformToViewModel
            ? widget.transformToViewModel(context, flattenedOptions)
            : context;

        const template = this.handlebars.compile(`{{> ${widget.id} }}`);
        return template(transformed);
    }
}
