import Handlebars from 'handlebars';
import { WidgetRegistry } from './widget-registry';
import { WidgetRenderer } from './widget-renderer';
import { CalmWidget } from './types';
import {registerGlobalTemplateHelpers} from './widget-helpers';

import { TableWidget } from './widgets/table';
import { ListWidget } from './widgets/list';
import { JsonViewerWidget } from './widgets/json-viewer';
import { FlowSequenceWidget } from './widgets/flow-sequence';
import { RelatedNodesWidget } from './widgets/related-nodes';
import { BlockArchitectureWidget } from './widgets/block-architecture';

export class WidgetEngine {
    constructor(
        private readonly handlebars: typeof Handlebars,
        private readonly registry: WidgetRegistry
    ) {}

    setupWidgets(widgets: { widget: CalmWidget<unknown, Record<string, unknown>, unknown>, folder: string }[]) {
        const helpers = registerGlobalTemplateHelpers();

        for (const [name, fn] of Object.entries(helpers)) {
            this.handlebars.registerHelper(name, fn);
        }

        for (const { widget, folder } of widgets) {
            const widgetId = widget.id;

            if (helpers[widgetId]) {
                throw new Error(`[WidgetEngine] ❌ Conflict: widget id '${widgetId}' collides with a global helper name.`);
            }

            if (this.handlebars.helpers[widgetId]) {
                throw new Error(`[WidgetEngine] ❌ Conflict: Handlebars already has a helper registered as '${widgetId}'.`);
            }

            this.registry.register(widget, folder);
            this.registerWidgetHelper(widgetId);
        }
    }


    registerWidgetHelper(widgetId: string) {
        this.handlebars.registerHelper(widgetId, (context: unknown, options: Record<string, unknown>) => {
            const renderer = new WidgetRenderer(this.handlebars, this.registry);
            const rendered = renderer.render(widgetId, context, options);
            return new this.handlebars.SafeString(rendered);
        });
    }

    registerDefaultWidgets() {
        const widgets: { widget: CalmWidget<unknown, object, unknown>, folder: string }[] = [
            {
                widget: TableWidget as CalmWidget<unknown, object, unknown>,
                folder: __dirname + '/widgets/table',
            },
            {
                widget: ListWidget as CalmWidget<unknown, object, unknown>,
                folder: __dirname + '/widgets/list',
            },
            {
                widget: JsonViewerWidget as CalmWidget<unknown, object, unknown>,
                folder: __dirname + '/widgets/json-viewer',
            },
            {
                widget: FlowSequenceWidget as CalmWidget<unknown, object, unknown>,
                folder: __dirname + '/widgets/flow-sequence',
            },
            {
                widget: RelatedNodesWidget as CalmWidget<unknown, object, unknown>,
                folder: __dirname + '/widgets/related-nodes',
            },
            {
                widget: BlockArchitectureWidget as CalmWidget<unknown, object, unknown>,
                folder: __dirname + '/widgets/block-architecture',
            },
        ];
        this.setupWidgets(widgets);
    }
}
