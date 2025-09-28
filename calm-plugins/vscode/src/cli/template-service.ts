import * as fs from 'fs'
import * as path from 'path'
import * as vscode from 'vscode'
import { Logger } from '../core/ports/logger'
import { TemplateProcessor } from './template-processor'
import { ModelService } from '../core/services/model-service'

/**
 * TemplateService - VSCode-specific template file loading service
 * Handles file system operations for templates while delegating logic to TemplateProcessor
 */
export class TemplateService {
  private processor = new TemplateProcessor()
  private modelService = new ModelService()

  constructor(private context: vscode.ExtensionContext, private log: Logger) { }

  /**
   * Process template content for label display settings
   */
  processTemplateForLabels(content: string, showLabels: boolean): string {
    return this.processor.processTemplateForLabels(content, showLabels)
  }

  /**
   * Load template file from extension templates directory
   */
  async loadTemplate(name: string, showLabels: boolean): Promise<string> {
    try {
      const templatePath = path.join(this.context.extensionUri.fsPath, 'templates', name)
      let content = await fs.promises.readFile(templatePath, 'utf8')
      return this.processor.processTemplateForLabels(content, showLabels)
    } catch (e) {
      this.log.info(`[preview] loadTemplate: using fallback template for ${name}`)
      return this.processor.generateFallbackTemplate(showLabels)
    }
  }

  /**
   * Get template name based on selection
   */
  getTemplateNameForSelection(selectedId: string | undefined, graph: any): string {
    return this.processor.getTemplateNameForSelection(selectedId, graph)
  }

  /**
   * Generate template content based on selection and context
   */
  async generateTemplateContent(
    selectedId: string | undefined,
    graph: any,
    currentModelPath: string | undefined,
    showLabels: boolean,
    isTemplateMode: boolean,
    architectureFilePath: string | undefined
  ): Promise<string> {
    if (!selectedId || selectedId.startsWith('group:')) {
      return this.loadTemplate('default-template.hbs', showLabels)
    }

    if (graph) {
      const isNode = graph.nodes?.some((n: any) => n.id === selectedId)
      if (isNode) {
        const template = await this.loadTemplate('node-focus-template.hbs', showLabels)
        return this.processor.replacePlaceholders(template, {
          'focused-node-id': selectedId
        })
      }

      const edge = graph.edges?.find((x: any) => x.id === selectedId)
      if (edge) {
        const template = await this.loadTemplate('relationship-focus-template.hbs', showLabels)
        return this.processor.replacePlaceholders(template, {
          'focused-relationship-id': selectedId
        })
      }
    }

    const modelFile = isTemplateMode && architectureFilePath ? architectureFilePath : currentModelPath
    if (modelFile) {
      try {
        const data = this.modelService.readModel(modelFile)

        if (data?.flows?.find((f: any) => f['unique-id'] === selectedId)) {
          const template = await this.loadTemplate('flow-focus-template.hbs', showLabels)
          return this.processor.replacePlaceholders(template, {
            'focused-flow-id': selectedId
          })
        }
      } catch (e) {
        this.log.info(`[preview] generateTemplateContent: error reading modelFile ${String(e)}`)
      }
    }

    return this.loadTemplate('default-template.hbs', showLabels)
  }
}
