import * as fs from 'fs'
import * as path from 'path'
import * as vscode from 'vscode'
import { Logger } from '../../core/ports/logger'

export class TemplateService {
  constructor(private context: vscode.ExtensionContext, private log: Logger) {}

  processTemplateForLabels(content: string, showLabels: boolean) {
    if (!showLabels) content = content.replace(new RegExp('\{\{block-architecture(\\s*)\}\}', 'g'), '{{block-architecture$1 edge-labels="none"}}')
    return content
  }

  async loadTemplate(name: string, showLabels: boolean) {
    try {
      const p = path.join(this.context.extensionUri.fsPath, 'templates', name)
      let c = await fs.promises.readFile(p, 'utf8')
      return this.processTemplateForLabels(c, showLabels)
    } catch (e) {
      const edge = showLabels ? '' : ' edge-labels="none"'
      this.log.info(`[preview] loadTemplate: using fallback template for ${name}`)
      return `{{block-architecture${edge}}}`
    }
  }

  getTemplateNameForSelection(selectedId: string | undefined, graph: any) {
    if (!selectedId) return 'default-template.hbs'
    if (selectedId.startsWith('group:')) return 'default-template.hbs'
    if (graph) {
      const isNode = graph.nodes?.some((n: any) => n.id === selectedId)
      if (isNode) return 'node-focus-template.hbs'
      const e = graph.edges?.find((x: any) => x.id === selectedId)
      if (e) return e.type === 'flow' ? 'flow-focus-template.hbs' : 'relationship-focus-template.hbs'
    }
    return 'default-template.hbs'
  }

  async generateTemplateContent(selectedId: string | undefined, graph: any, currentModelPath: string | undefined, showLabels: boolean, isTemplateMode: boolean, architectureFilePath: string | undefined) {
    if (!selectedId || selectedId.startsWith('group:')) return this.loadTemplate('default-template.hbs', showLabels)
    if (graph) {
      const isNode = graph.nodes?.some((n: any) => n.id === selectedId)
      if (isNode) {
        const t = await this.loadTemplate('node-focus-template.hbs', showLabels)
        return t.replace(new RegExp('\{\{focused-node-id\}\}', 'g'), selectedId)
      }
      const e = graph.edges?.find((x: any) => x.id === selectedId)
      if (e) {
        const t = await this.loadTemplate('relationship-focus-template.hbs', showLabels)
        return t.replace(new RegExp('\{\{focused-relationship-id\}\}', 'g'), selectedId)
      }
    }
    const modelFile = isTemplateMode && architectureFilePath ? architectureFilePath : currentModelPath
    if (modelFile) {
      try {
        const content = fs.readFileSync(modelFile, 'utf8')
        let data: any
        if (modelFile.endsWith('.json')) data = JSON.parse(content)
        else if (modelFile.endsWith('.yml') || modelFile.endsWith('.yaml')) { const yaml = require('yaml'); data = yaml.parse(content) }
        if (data?.flows?.find((f: any) => f['unique-id'] === selectedId)) {
          const t = await this.loadTemplate('flow-focus-template.hbs', showLabels)
          return t.replace(new RegExp('\{\{focused-flow-id\}\}', 'g'), selectedId)
        }
      } catch (e) {
        this.log.info(`[preview] generateTemplateContent: error reading modelFile ${String(e)}`)
      }
    }
    return this.loadTemplate('default-template.hbs', showLabels)
  }
}
