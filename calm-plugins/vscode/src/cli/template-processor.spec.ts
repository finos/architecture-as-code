import { describe, it, expect } from 'vitest'
import { TemplateProcessor } from './template-processor'

describe('TemplateProcessor', () => {
    describe('processTemplateForLabels', () => {
        it('should return content unchanged when showLabels is true', () => {
            const processor = new TemplateProcessor()
            const content = '{{block-architecture}}'
            const result = processor.processTemplateForLabels(content, true)
            expect(result).toBe('{{block-architecture}}')
        })

        it('should add edge-labels="none" when showLabels is false', () => {
            const processor = new TemplateProcessor()
            const content = '{{block-architecture}}'
            const result = processor.processTemplateForLabels(content, false)
            expect(result).toBe('{{block-architecture edge-labels="none"}}')
        })

        it('should handle block-architecture with whitespace', () => {
            const processor = new TemplateProcessor()
            const content = '{{block-architecture  }}'
            const result = processor.processTemplateForLabels(content, false)
            expect(result).toBe('{{block-architecture   edge-labels="none"}}')
        })

        it('should handle multiple block-architecture occurrences', () => {
            const processor = new TemplateProcessor()
            const content = '{{block-architecture}}\n\nSome text\n\n{{block-architecture}}'
            const result = processor.processTemplateForLabels(content, false)
            expect(result).toBe('{{block-architecture edge-labels="none"}}\n\nSome text\n\n{{block-architecture edge-labels="none"}}')
        })
    })

    describe('processTemplateForTheme', () => {
        it('should return content unchanged when theme is "auto"', () => {
            const processor = new TemplateProcessor()
            const content = '{{block-architecture}}'
            const result = processor.processTemplateForTheme(content, 'auto')
            expect(result).toBe('{{block-architecture}}')
        })

        it('should inject widget-options frontmatter for light theme on content without frontmatter', () => {
            const processor = new TemplateProcessor()
            const content = '{{block-architecture}}'
            const result = processor.processTemplateForTheme(content, 'light')
            
            expect(result).toContain('---')
            expect(result).toContain('widget-options:')
            expect(result).toContain('block-architecture:')
            expect(result).toContain('theme: light')
            expect(result).toContain('render-node-type-shapes: true')
            expect(result).toContain('{{block-architecture}}')
        })

        it('should inject widget-options frontmatter for dark theme on content without frontmatter', () => {
            const processor = new TemplateProcessor()
            const content = '# My Template\n{{block-architecture}}'
            const result = processor.processTemplateForTheme(content, 'dark')
            
            expect(result).toContain('---')
            expect(result).toContain('widget-options:')
            expect(result).toContain('block-architecture:')
            expect(result).toContain('theme: dark')
            expect(result).toContain('render-node-type-shapes: true')
            expect(result).toContain('# My Template')
            expect(result).toContain('{{block-architecture}}')
        })

        it('should handle content that already has YAML frontmatter', () => {
            const processor = new TemplateProcessor()
            const content = `---
title: My Architecture
description: A cool architecture
---
{{block-architecture}}`
            
            const result = processor.processTemplateForTheme(content, 'light')
            
            // Should have widget-options injected
            expect(result).toContain('widget-options:')
            expect(result).toContain('theme: light')
            expect(result).toContain('render-node-type-shapes: true')
            // Should preserve existing frontmatter
            expect(result).toContain('title: My Architecture')
            expect(result).toContain('description: A cool architecture')
            // Should preserve content
            expect(result).toContain('{{block-architecture}}')
            // Should still be valid YAML frontmatter (only one frontmatter block)
            const frontmatterCount = (result.match(/---/g) || []).length
            expect(frontmatterCount).toBe(2) // Opening and closing ---
        })

        it('should handle content with existing widget-options in frontmatter', () => {
            const processor = new TemplateProcessor()
            const content = `---
widget-options:
    table:
        columns: 3
---
{{block-architecture}}`
            
            const result = processor.processTemplateForTheme(content, 'dark')
            
            // Should have both widget-options
            expect(result).toContain('widget-options:')
            expect(result).toContain('block-architecture:')
            expect(result).toContain('theme: dark')
            expect(result).toContain('table:')
            expect(result).toContain('columns: 3')
            // Should preserve content
            expect(result).toContain('{{block-architecture}}')
        })

        it('should handle empty content', () => {
            const processor = new TemplateProcessor()
            const result = processor.processTemplateForTheme('', 'light')
            
            expect(result).toContain('---')
            expect(result).toContain('widget-options:')
            expect(result).toContain('theme: light')
        })

        it('should handle multiline content without frontmatter', () => {
            const processor = new TemplateProcessor()
            const content = `# Architecture Diagram

This is my architecture.

{{block-architecture}}

## Details

More information here.`
            
            const result = processor.processTemplateForTheme(content, 'light')
            
            expect(result).toContain('widget-options:')
            expect(result).toContain('theme: light')
            expect(result).toContain('# Architecture Diagram')
            expect(result).toContain('More information here.')
        })
    })

    describe('getTemplateNameForSelection', () => {
        it('should return default template when no selection', () => {
            const processor = new TemplateProcessor()
            const result = processor.getTemplateNameForSelection(undefined, null)
            expect(result).toBe('default-template.hbs')
        })

        it('should return default template for group selection', () => {
            const processor = new TemplateProcessor()
            const result = processor.getTemplateNameForSelection('group:my-group', null)
            expect(result).toBe('default-template.hbs')
        })

        it('should return node-focus-template for node selection', () => {
            const processor = new TemplateProcessor()
            const graph = {
                nodes: [{ id: 'node-1' }, { id: 'node-2' }],
                edges: []
            }
            const result = processor.getTemplateNameForSelection('node-1', graph)
            expect(result).toBe('node-focus-template.hbs')
        })

        it('should return flow-focus-template for flow edge selection', () => {
            const processor = new TemplateProcessor()
            const graph = {
                nodes: [],
                edges: [{ id: 'edge-1', type: 'flow' }]
            }
            const result = processor.getTemplateNameForSelection('edge-1', graph)
            expect(result).toBe('flow-focus-template.hbs')
        })

        it('should return relationship-focus-template for relationship edge selection', () => {
            const processor = new TemplateProcessor()
            const graph = {
                nodes: [],
                edges: [{ id: 'edge-1', type: 'relationship' }]
            }
            const result = processor.getTemplateNameForSelection('edge-1', graph)
            expect(result).toBe('relationship-focus-template.hbs')
        })

        it('should return default template when graph is null', () => {
            const processor = new TemplateProcessor()
            const result = processor.getTemplateNameForSelection('some-id', null)
            expect(result).toBe('default-template.hbs')
        })

        it('should return default template when selection not found in graph', () => {
            const processor = new TemplateProcessor()
            const graph = {
                nodes: [{ id: 'node-1' }],
                edges: [{ id: 'edge-1', type: 'flow' }]
            }
            const result = processor.getTemplateNameForSelection('node-999', graph)
            expect(result).toBe('default-template.hbs')
        })
    })

    describe('replacePlaceholders', () => {
        it('should replace single placeholder', () => {
            const processor = new TemplateProcessor()
            const template = 'Hello {{name}}!'
            const result = processor.replacePlaceholders(template, { name: 'World' })
            expect(result).toBe('Hello World!')
        })

        it('should replace multiple placeholders', () => {
            const processor = new TemplateProcessor()
            const template = '{{greeting}} {{name}}, welcome to {{place}}!'
            const result = processor.replacePlaceholders(template, {
                greeting: 'Hello',
                name: 'Alice',
                place: 'Wonderland'
            })
            expect(result).toBe('Hello Alice, welcome to Wonderland!')
        })

        it('should replace multiple occurrences of the same placeholder', () => {
            const processor = new TemplateProcessor()
            const template = '{{name}} said hello to {{name}}'
            const result = processor.replacePlaceholders(template, { name: 'Bob' })
            expect(result).toBe('Bob said hello to Bob')
        })

        it('should leave unknown placeholders unchanged', () => {
            const processor = new TemplateProcessor()
            const template = 'Hello {{name}}, you are {{age}} years old'
            const result = processor.replacePlaceholders(template, { name: 'Charlie' })
            expect(result).toBe('Hello Charlie, you are {{age}} years old')
        })

        it('should handle empty placeholders object', () => {
            const processor = new TemplateProcessor()
            const template = 'Hello {{name}}!'
            const result = processor.replacePlaceholders(template, {})
            expect(result).toBe('Hello {{name}}!')
        })

        it('should handle template with no placeholders', () => {
            const processor = new TemplateProcessor()
            const template = 'Hello World!'
            const result = processor.replacePlaceholders(template, { name: 'Alice' })
            expect(result).toBe('Hello World!')
        })
    })

    describe('generateFallbackTemplate', () => {
        it('should generate template without edge-labels when showLabels is true', () => {
            const processor = new TemplateProcessor()
            const result = processor.generateFallbackTemplate(true)
            expect(result).toBe('{{block-architecture}}')
        })

        it('should generate template with edge-labels="none" when showLabels is false', () => {
            const processor = new TemplateProcessor()
            const result = processor.generateFallbackTemplate(false)
            expect(result).toBe('{{block-architecture edge-labels="none"}}')
        })
    })
})
