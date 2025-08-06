import fs from 'fs';
import path from 'path';
import Handlebars from 'handlebars';
import { CalmWidget} from './types';

/**
 * Registers a widget and its associated Handlebars partial(s).
 * - Main template is registered under `widget.id`
 * - Supporting partials (if any) are registered under their filenames
 *
 * @param widget - the CalmWidget definition
 * @param widgetFolder - the directory where the widget and its templates live (usually __dirname)
 */
export class WidgetRegistry {
    private registry: Record<string, CalmWidget> = {};

    constructor(private handlebars = Handlebars, private readFileSync = fs.readFileSync) {}

    register<TContext>(widget: CalmWidget<TContext>, widgetFolder: string): void {
        const mainPath = path.join(widgetFolder, widget.templatePartial);
        const mainSource = this.readFileSync(mainPath, 'utf-8');
        this.handlebars.registerPartial(widget.templatePartial, mainSource);
        this.handlebars.registerPartial(widget.id, mainSource);

        widget.partials?.forEach((partialFile) => {
            const partialPath = path.join(widgetFolder, partialFile);
            const partialSource = this.readFileSync(partialPath, 'utf-8');
            this.handlebars.registerPartial(partialFile, partialSource);
        });

        if (widget.registerHelpers) {
            const helpers = widget.registerHelpers();
            for (const [name, fn] of Object.entries(helpers)) {
                this.handlebars.registerHelper(name, fn);
            }
        }

        this.registry[widget.id] = widget as CalmWidget;
    }

    get(id: string): CalmWidget<unknown> | undefined {
        return this.registry[id];
    }

    clear(): void {
        this.registry = {};
    }
}
