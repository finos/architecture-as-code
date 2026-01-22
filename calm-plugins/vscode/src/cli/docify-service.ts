import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { parseFrontMatter, replaceVariables } from '@finos/calm-shared'
import { DocifyProcessor } from './docify-processor'
import { TemplateService } from './template-service'
import { Logger } from '../core/ports/logger'
import { GraphData } from "../models/model"
import { IDocifierFactory, DocifierFactory } from './docifier-factory'

type DocifyResult = { content: string; format: 'html' | 'markdown'; sourceFile: string }

/**
 * DocifyService - Framework-agnostic docification service
 * Handles file system operations and external library interactions for docify process
 */
export class DocifyService {
  private processor = new DocifyProcessor()

  constructor(
    private log: Logger,
    private templateService: TemplateService,
    private docifierFactory: IDocifierFactory = new DocifierFactory()
  ) { }

  async run(params: {
    currentFilePath: string | undefined
    isTemplateMode: boolean
    templateFilePath: string | undefined
    architectureFilePath: string | undefined
    selectedId: string | undefined
    getCurrentTreeSelection: (() => string | undefined) | undefined
    lastData: { graph: GraphData; selectedId?: string; settings?: any; positions?: Record<string, { x: number; y: number }>; viewport?: { pan: { x: number; y: number }; zoom: number } } | undefined
    showLabels: boolean
  }): Promise<DocifyResult> {
    if (!params.currentFilePath) {
      throw new Error('No current file open in preview')
    }

    // Determine architecture file and template content
    const { archFilePath, templateContentToUse, urlMappingPath } = await this.prepareDocifyInputs(params)

    if (!fs.existsSync(archFilePath)) {
      throw new Error(`Architecture file not found: ${archFilePath}`)
    }

    // Determine selected ID
    const treeSelection = params.getCurrentTreeSelection && params.getCurrentTreeSelection()
    const selectedId = params.selectedId || treeSelection
    this.log.info(`[docify-service] Selection determination:`)
    this.log.info(`[docify-service] - params.selectedId: ${params.selectedId}`)
    this.log.info(`[docify-service] - tree selection: ${treeSelection}`)
    this.log.info(`[docify-service] - final selectedId: ${selectedId}`)

    // Setup temporary directory and files
    const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'calm-docify-'))
    const fileNames = this.processor.generateTempFileNames(tmpDir)

    // Generate or use provided template
    this.log.info(`[docify-service] Preparing template with selectedId: ${selectedId}`)
    const templatePath = await this.prepareTemplate(
      fileNames.autoTemplate,
      templateContentToUse,
      selectedId,
      params
    )
    this.log.info(`[docify-service] Template prepared at: ${templatePath}`)

    // Execute docification
    this.log.info(`[docify-service] Executing docify:`)
    this.log.info(`[docify-service] - architecture: ${archFilePath}`)
    this.log.info(`[docify-service] - template: ${templatePath}`)
    this.log.info(`[docify-service] - output: ${fileNames.outFile}`)
    await this.executeDocify(archFilePath, fileNames.outFile, urlMappingPath, templatePath)

    // Process results - use the original template file path for image resolution
    const originalSourceFile = params.isTemplateMode && params.templateFilePath
      ? params.templateFilePath
      : params.currentFilePath

    return await this.processResults(tmpDir, fileNames.outFile, originalSourceFile)
  }

  private async prepareDocifyInputs(params: any) {
    let archFilePath: string
    let templateContentToUse: string | undefined
    let urlMappingPath: string | undefined

    if (params.isTemplateMode && params.architectureFilePath && params.templateFilePath) {
      archFilePath = params.architectureFilePath
      const parsed = parseFrontMatter(params.templateFilePath)

      if (parsed) {
        templateContentToUse = replaceVariables(parsed.content, parsed.frontMatter)
        urlMappingPath = parsed.urlMappingPath
      } else {
        templateContentToUse = fs.readFileSync(params.templateFilePath, 'utf8')
      }
    } else {
      archFilePath = params.currentFilePath as string
    }

    return { archFilePath, templateContentToUse, urlMappingPath }
  }

  private async prepareTemplate(
    autoTemplateFile: string,
    templateContentToUse: string | undefined,
    selectedId: string | undefined,
    params: any
  ): Promise<string | undefined> {
    if (templateContentToUse) {
      await fs.promises.writeFile(autoTemplateFile, templateContentToUse, 'utf8')
      this.log.info('[preview] Generated template: ' + this.processor.createLogTemplate(templateContentToUse))
      return autoTemplateFile
    }

    const templateContent = await this.templateService.generateTemplateContent(
      selectedId,
      params.lastData?.graph,
      params.currentFilePath,
      params.showLabels,
      params.isTemplateMode,
      params.architectureFilePath
    )

    await fs.promises.writeFile(autoTemplateFile, templateContent, 'utf8')
    this.log.info('[preview] Generated template: ' + this.processor.createLogTemplate(templateContent))
    return autoTemplateFile
  }

  private async executeDocify(
    architectureFilePath: string,
    outputFilePath: string,
    urlMappingPath: string | undefined,
    templatePath: string | undefined
  ) {
    const config = this.processor.getDocifyConfiguration(templatePath)

    const docifier = this.docifierFactory.create({
      mode: config.docifyMode,
      inputPath: architectureFilePath,
      outputPath: outputFilePath,
      urlMappingPath: urlMappingPath,
      templateProcessingMode: config.templateMode,
      templatePath: templatePath,
      clearOutputDirectory: false,
      scaffoldOnly: false
    })

    await docifier.docify()
    this.log.info('[preview] Docify finished')
  }

  private async processResults(tmpDir: string, expectedOutputFile: string, originalSourceFile: string): Promise<DocifyResult> {
    let content: string
    let outputPath: string

    try {
      content = await fs.promises.readFile(expectedOutputFile, 'utf8')
      outputPath = expectedOutputFile
    } catch {
      // Fallback to finding any output file
      const files = await fs.promises.readdir(tmpDir)
      const result = this.processor.processDocifyResult(files.map(f => path.join(tmpDir, f)), expectedOutputFile)

      if (result.hasOutput) {
        outputPath = result.outputPath
        content = await fs.promises.readFile(outputPath, 'utf8')
      } else {
        throw new Error('Docify completed but no output file was found')
      }
    }

    return {
      content,
      format: this.processor.detectContentFormat(content),
      sourceFile: originalSourceFile // Use the original template file path for image resolution
    }
  }
}
