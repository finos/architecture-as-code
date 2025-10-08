/**
 * TemplateProcessor - Pure domain service for template processing logic
 * Framework-free service for template content manipulation
 */
export class TemplateProcessor {
    constructor() { }

    /**
     * Process template content for label display settings
     */
    processTemplateForLabels(content: string, showLabels: boolean): string {
        if (!showLabels) {
            content = content.replace(
                new RegExp('\\{\\{block-architecture(\\s*)\\}\\}', 'g'),
                '{{block-architecture$1 edge-labels="none"}}'
            )
        }
        return content
    }

    /**
   * Get template name based on selection and graph structure
   */
    getTemplateNameForSelection(selectedId: string | undefined, graph: any): string {
        if (!selectedId) return 'default-template.hbs'
        if (selectedId.startsWith('group:')) return 'default-template.hbs'

        if (graph) {
            const isNode = graph.nodes?.some((n: any) => n.id === selectedId)
            if (isNode) return 'node-focus-template.hbs'

            const edge = graph.edges?.find((x: any) => x.id === selectedId)
            if (edge) {
                return edge.type === 'flow' ? 'flow-focus-template.hbs' : 'relationship-focus-template.hbs'
            }
        }

        return 'default-template.hbs'
    }

    /**
     * Replace template placeholders with actual values
     */
    replacePlaceholders(template: string, placeholders: Record<string, string>): string {
        let result = template

        for (const [key, value] of Object.entries(placeholders)) {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
            result = result.replace(regex, value)
        }

        return result
    }

    /**
     * Generate fallback template content
     */
    generateFallbackTemplate(showLabels: boolean): string {
        const edge = showLabels ? '' : ' edge-labels="none"'
        return `{{block-architecture${edge}}}`
    }
}