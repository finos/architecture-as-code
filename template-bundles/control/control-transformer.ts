import { CalmTemplateTransformer } from "@finos/calm-shared";

export class ControlSpecificationTransformer implements CalmTemplateTransformer {
    getTransformedModel(calmJson: string): any {
        const controlSpec = JSON.parse(calmJson);

        return { "control-specification": {
                "id": controlSpec["properties"]["control-id"]["const"],
                "$schema": controlSpec["$id"],
                "title": "Evidence of pre-production review",
                "control-id": controlSpec["properties"]["control-id"]["const"],
                "name": controlSpec["properties"]["name"]["const"],
                "scope-text": controlSpec["properties"]["scope-text"]["const"],
                "scope-rego": controlSpec["properties"]["scope-rego"]["const"],
                "description": controlSpec["properties"]["description"]["const"]
            }
        }
    }

    registerTemplateHelpers(): Record<string, (...args: any[]) => any> {
        return {}; // No helpers needed for this transformation
    }
}

export default ControlSpecificationTransformer;
