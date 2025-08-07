import Handlebars from 'handlebars';
import { WidgetRegistry } from './widget-registry';
import { CalmWidget } from './types';

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
        if (!widget.validateContext?.(context)) {
            // TODO: Give more context on why the widget is invalid.
            throw new Error(`Invalid context for widget '${widgetId}'`);
        }

        const transformed = widget.transformToViewModel
            ? widget.transformToViewModel(context, options)
            : context;

        const template = this.handlebars.compile(`{{> ${widget.id} }}`);
        return template(transformed);
    }
}
