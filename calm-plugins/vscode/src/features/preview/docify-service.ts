import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import * as vscode from 'vscode'
import { parseFrontMatter } from '../../domain/front-matter'
import { TemplateService } from './template-service'
import { Logger } from '../../core/ports/logger'

type GraphData = { nodes: Array<{ id: string; label: string; type?: string }>; edges: Array<{ id:string; source: string; target: string; label?: string; type?: string }> }

type DocifyResult = { content: string; format: 'html' | 'markdown'; sourceFile: string }

export class DocifyService {
  constructor(private log: Logger, private templateService: TemplateService) {}

  async run(params: {
    currentUri: vscode.Uri | undefined
    isTemplateMode: boolean
    templateFilePath: string | undefined
    architectureFilePath: string | undefined
    selectedId: string | undefined
    getCurrentTreeSelection: (() => string | undefined) | undefined
    lastData: { graph: GraphData; selectedId?: string; settings?: any; positions?: Record<string, { x: number; y: number }>; viewport?: { pan: { x: number; y: number }; zoom: number } } | undefined
    showLabels: boolean
  }): Promise<DocifyResult> {
    if (!params.currentUri) throw new Error('No current file open in preview')
    let archUri: vscode.Uri
    let templateContentToUse: string | undefined
    let urlToLocalPathMapping = new Map<string, string>()
    if (params.isTemplateMode && params.architectureFilePath && params.templateFilePath) {
      archUri = vscode.Uri.file(params.architectureFilePath)
      const parsed = parseFrontMatter(params.templateFilePath)
      if (parsed) {
        templateContentToUse = parsed.content
        if (parsed.urlToLocalPathMapping) urlToLocalPathMapping = parsed.urlToLocalPathMapping
      } else {
        templateContentToUse = fs.readFileSync(params.templateFilePath, 'utf8')
      }
    } else {
      archUri = params.currentUri as vscode.Uri
    }
    if (!fs.existsSync(archUri.fsPath)) throw new Error(`Architecture file not found: ${archUri.fsPath}`)
    let selectedId = params.selectedId
    if (!selectedId && params.getCurrentTreeSelection) selectedId = params.getCurrentTreeSelection()
    const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'calm-docify-'))
    const outFile = path.join(tmpDir, 'output.md')
    let templatePath: string | undefined
    if (!templatePath) {
      const autoTpl = path.join(tmpDir, 'auto-template.hbs')
      let templateContent: string
      if (templateContentToUse) templateContent = templateContentToUse
      else templateContent = await this.templateService.generateTemplateContent(
        selectedId,
        params.lastData?.graph,
        params.currentUri?.fsPath,
        params.showLabels,
        params.isTemplateMode,
        params.architectureFilePath
      )
      await fs.promises.writeFile(autoTpl, templateContent, 'utf8')
      templatePath = autoTpl
      this.log.info('[preview] Generated template: ' + templateContent.replace(/\n/g, '\\n'))
    }
    const mod: any = await import('@finos/calm-shared')
    const Docifier = mod.Docifier || mod.default?.Docifier || (mod as any).Docifier
    if (!Docifier) throw new Error('Docifier not found in @finos/calm-shared')
    const docifyMode = templatePath ? 'USER_PROVIDED' : 'BUNDLE'
    const templateMode = templatePath ? 'template' : 'bundle'
    const d = new Docifier(docifyMode, archUri.fsPath, outFile, urlToLocalPathMapping, templateMode, templatePath, false)
    await d.docify()
    this.log.info('[preview] Docify finished')
    let content: string | undefined
    let outputPath: string | undefined
    try {
      content = await fs.promises.readFile(outFile, 'utf8')
      outputPath = outFile
    } catch {
      const files = await fs.promises.readdir(tmpDir)
      const c = files.filter(f => f.endsWith('.html') || f.endsWith('.md') || f.endsWith('.txt'))
      if (c.length) {
        outputPath = path.join(tmpDir, c[0])
        content = await fs.promises.readFile(outputPath, 'utf8')
      } else if (files.length) {
        outputPath = path.join(tmpDir, files[0])
        content = await fs.promises.readFile(outputPath, 'utf8')
      }
    }
    if (!content) throw new Error('Docify completed but no output file was found')
    return { content, format: content.trim().startsWith('<') ? 'html' : 'markdown', sourceFile: outputPath || outFile }
  }
}
