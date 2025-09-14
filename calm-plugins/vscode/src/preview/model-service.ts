import * as fs from 'fs'
import * as vscode from 'vscode'

export class ModelService {
  constructor(private output: vscode.OutputChannel) {}

  readModel(filePath: string) {
    const content = fs.readFileSync(filePath, 'utf8')
    if (filePath.endsWith('.json')) return JSON.parse(content)
    if (filePath.endsWith('.yml') || filePath.endsWith('.yaml')) {
      try {
        const yaml = require('yaml')
        return yaml.parse(content)
      } catch {
        return { raw: content, format: 'yaml' }
      }
    }
    return { raw: content, format: 'unknown' }
  }

  filterBySelection(fullModelData: any, selectedId?: string): any {
    if (!selectedId || selectedId.startsWith('group:')) return fullModelData
    if (fullModelData?.nodes) {
      const n = fullModelData.nodes.find((x: any) => x['unique-id'] === selectedId)
      if (n) return n
    }
    if (fullModelData?.relationships) {
      const r = fullModelData.relationships.find((x: any) => x['unique-id'] === selectedId)
      if (r) return r
    }
    if (fullModelData?.flows) {
      const f = fullModelData.flows.find((x: any) => x['unique-id'] === selectedId)
      if (f) return f
    }
    return fullModelData
  }
}

