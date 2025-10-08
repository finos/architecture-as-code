import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import { detectFileType, FileType } from '../../models/file-types'
import { parseFrontMatter } from '../../cli/front-matter'
import { ModelService } from '../../core/services/model-service'
import { TemplateService } from '../../cli/template-service'
import { HtmlBuilder } from '../../cli/html-builder'
import { DocifyService } from '../../cli/docify-service'
import { AsyncGuard } from '../../core/async-guard'
import {
  isInMsg,
  InMsg,
  CommandRegistry,
  RevealInEditorCmd,
  SelectedCmd,
  ReadyCmd,
  RunDocifyCmd,
  RequestModelDataCmd,
  RequestTemplateDataCmd,
  ToggleLabelsCmd,
  LogCmd,
  ErrorCmd,
} from './commands'
import { PreviewViewModel } from './preview.view-model'
import { Logger } from '../../core/ports/logger'
import {GraphData} from "../../models/model";

/** ---------- main panel ---------- */
export class CalmPreviewPanel {
  public static currentPanel: CalmPreviewPanel | undefined
  private readonly panel: vscode.WebviewPanel
  private disposables: vscode.Disposable[] = []
  private revealInEditorHandlers: Array<(id: string) => void> = []
  private selectHandlers: Array<(id: string) => void> = []

  private getCurrentTreeSelection: (() => string | undefined) | undefined = undefined

  private modelService: ModelService
  private templateService: TemplateService
  private htmlBuilder: HtmlBuilder
  private docifyService: DocifyService
  public readonly viewModel: PreviewViewModel  // Made public for external access

  private runDocifyGuard = new AsyncGuard()
  private commands = new CommandRegistry()

  static createOrShow(
    context: vscode.ExtensionContext,
    uri: vscode.Uri,
    config: vscode.WorkspaceConfiguration,
    log: Logger
  ) {
    const column = vscode.ViewColumn.Beside
    if (CalmPreviewPanel.currentPanel) {
      // Ensure the existing panel is still valid before reusing
      try {
        CalmPreviewPanel.currentPanel.reveal(uri)
        return CalmPreviewPanel.currentPanel
      } catch {
        // Panel may have been disposed externally, clean up the reference
        log.info('[preview] Existing panel was invalid, creating new one')
        CalmPreviewPanel.currentPanel = undefined
      }
    }
    const panel = vscode.window.createWebviewPanel('calmPreview', 'CALM Preview', column, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, 'dist'),
        vscode.Uri.joinPath(context.extensionUri, 'media'),
        vscode.Uri.joinPath(context.extensionUri, 'templates'),
        // Add workspace folders to allow access to local images
        ...(vscode.workspace.workspaceFolders || []).map(folder => folder.uri),
      ],
    })
    CalmPreviewPanel.currentPanel = new CalmPreviewPanel(panel, context, config, log)
    CalmPreviewPanel.currentPanel.reveal(uri)
    return CalmPreviewPanel.currentPanel
  }

  static createOrShowWithViewModel(
    context: vscode.ExtensionContext,
    uri: vscode.Uri,
    config: vscode.WorkspaceConfiguration,
    log: Logger,
    viewModel: PreviewViewModel
  ) {
    const column = vscode.ViewColumn.Beside
    if (CalmPreviewPanel.currentPanel) {
      // Ensure the existing panel is still valid before reusing
      try {
        CalmPreviewPanel.currentPanel.reveal(uri)
        return CalmPreviewPanel.currentPanel
      } catch {
        // Panel may have been disposed externally, clean up the reference
        log.info('[preview] Existing panel was invalid, creating new one')
        CalmPreviewPanel.currentPanel = undefined
      }
    }
    const panel = vscode.window.createWebviewPanel('calmPreview', 'CALM Preview', column, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, 'dist'),
        vscode.Uri.joinPath(context.extensionUri, 'media'),
        vscode.Uri.joinPath(context.extensionUri, 'templates'),
        // Add workspace folders to allow access to local images
        ...(vscode.workspace.workspaceFolders || []).map(folder => folder.uri),
      ],
    })
    CalmPreviewPanel.currentPanel = new CalmPreviewPanel(panel, context, config, log, viewModel)
    CalmPreviewPanel.currentPanel.reveal(uri)
    return CalmPreviewPanel.currentPanel
  }

  constructor(
    panel: vscode.WebviewPanel,
    private context: vscode.ExtensionContext,
    private cfg: vscode.WorkspaceConfiguration,
    private log: Logger,
    externalViewModel?: PreviewViewModel
  ) {
    this.panel = panel
    this.modelService = new ModelService()
    this.templateService = new TemplateService(context, log)
    this.htmlBuilder = new HtmlBuilder(context)
    this.docifyService = new DocifyService(log, this.templateService)

    // Use external ViewModel if provided, otherwise create new one
    this.viewModel = externalViewModel || new PreviewViewModel()

    // Bind ViewModel events to service operations
    this.bindViewModelEvents()

    // register commands
    this.commands.register(new RevealInEditorCmd(this))
    this.commands.register(new SelectedCmd(this))
    this.commands.register(new ReadyCmd(this))
    this.commands.register(new RunDocifyCmd(this))
    this.commands.register(new RequestModelDataCmd(this))
    this.commands.register(new RequestTemplateDataCmd(this))
    this.commands.register(new ToggleLabelsCmd(this))
    this.commands.register(new LogCmd(this))
    this.commands.register(new ErrorCmd(this))

    // route messages to commands
    this.panel.webview.onDidReceiveMessage(
      (raw: unknown) => {
        if (!isInMsg(raw)) return
        const msg: InMsg = raw
        try { this.log.info('[preview][rawMsg] ' + JSON.stringify(msg)) } catch { }
        this.commands.dispatch(msg)
      },
      undefined,
      this.disposables
    )

    this.panel.webview.html = this.htmlBuilder.getHtml(this.panel)
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables)
  }

  private bindViewModelEvents(): void {
    // Bind ViewModel events to actual service operations
    this.viewModel.onVisibilityChanged((visible) => {
      if (visible) {
        this.panel.reveal(vscode.ViewColumn.Beside)
      }
    })

    this.viewModel.onStateChanged(() => {
      const state = this.viewModel.getPreviewState()
      this.log.info(`[preview] onStateChanged - ready: ${state.ready}, hasData: ${state.hasData}, selectedId: ${state.selectedId}`)
      if (state.ready && state.hasData) {
        this.post({ type: 'setData', ...this.viewModel.getData() })
        if (state.selectedId) {
          this.log.info(`[preview] Posting select message for: ${state.selectedId}`)
          this.post({ type: 'select', id: state.selectedId })
        }
      }
    })

    this.viewModel.onModelDataRequest(() => {
      this.handleRequestModelDataImpl()
    })

    this.viewModel.onTemplateDataRequest(() => {
      this.handleRequestTemplateDataImpl()
    })

    this.viewModel.onDocifyRequest(() => {
      this.handleRunDocifyImpl()
    })

    // Listen for docify results and post them to webview
    this.viewModel.docify.onDocifyResult((result) => {
      this.post({ type: 'docifyResult', content: result.content, format: result.format, sourceFile: result.sourceFile })
    })

    // Listen for docify errors and post them to webview
    this.viewModel.docify.onDocifyError((error) => {
      this.post({ type: 'docifyError', message: error })
    })
  }

  private post(msg: unknown) {
    try { this.panel.webview.postMessage(msg) } catch { }
  }

  /** --------- public API - now delegates to ViewModel --------- */
  reveal(uri: vscode.Uri) {
    this.viewModel.setCurrentUri(uri.fsPath)
    const fileInfo = detectFileType(uri.fsPath)
    const isTemplateMode = fileInfo.type === FileType.TemplateFile && fileInfo.isValid

    this.log.info(`[preview] reveal() - File: ${uri.fsPath}`)
    this.log.info(`[preview] reveal() - fileInfo: type=${fileInfo.type}, isValid=${fileInfo.isValid}, architecturePath=${fileInfo.architecturePath}`)
    this.log.info(`[preview] reveal() - isTemplateMode set to: ${isTemplateMode}`)

    if (isTemplateMode) {
      this.viewModel.setTemplateMode(true, uri.fsPath, fileInfo.architecturePath)
      this.log.info(`[preview] Template mode activated: ${uri.fsPath} -> ${fileInfo.architecturePath}`)

      // Send template mode to webview
      this.post({
        type: 'templateMode',
        isTemplateMode: true,
        templatePath: uri.fsPath,
        architecturePath: fileInfo.architecturePath
      })
    } else {
      this.viewModel.setTemplateMode(false, undefined, uri.fsPath)
      this.log.info(`[preview] Architecture mode: ${uri.fsPath}`)

      // Send template mode to webview
      this.post({
        type: 'templateMode',
        isTemplateMode: false
      })
    }

    // Don't trigger docify immediately here - let refreshForDocument handle it after selection is determined

    this.panel.reveal(vscode.ViewColumn.Beside)
  }

  getCurrentUri(): vscode.Uri | undefined {
    const uriString = this.viewModel.getCurrentUriString()
    return uriString ? vscode.Uri.file(uriString) : undefined
  }

  onDidDispose(handler: () => void) { this.panel.onDidDispose(handler) }
  onRevealInEditor(handler: (id: string) => void) { this.revealInEditorHandlers.push(handler) }
  onDidSelect(handler: (id: string) => void) { this.selectHandlers.push(handler) }

  setData(payload: { graph: GraphData; selectedId?: string }) {
    this.viewModel.setData(payload)
  }

  postSelect(id: string) {
    this.viewModel.setSelectedId(id)
    this.log.info(`[preview] TreeView selection changed to: ${id || 'none'}`)
  }

  setGetCurrentTreeSelection(fn: () => string | undefined) {
    this.getCurrentTreeSelection = fn
  }

  dispose() {
    this.viewModel.setVisible(false)
    CalmPreviewPanel.currentPanel = undefined
    while (this.disposables.length) {
      const d = this.disposables.pop()
      try { d?.dispose() } catch { }
    }
  }

  /** --------- Command handlers using ViewModel --------- */
  public handleRevealInEditor(id: string) {
    this.revealInEditorHandlers.forEach(h => h(id))
    this.viewModel.handleRevealInEditor(id)
  }

  public handleSelected(id: string) {
    this.selectHandlers.forEach(h => h(id))
    this.viewModel.handleSelected(id)
  }

  public handleReady() {
    this.log.info('[preview] handleReady() called - webview is ready')
    this.viewModel.handleReady()
  }

  public handleRunDocify() {
    this.viewModel.handleRunDocify()
  }

  public handleRequestModelData() {
    this.viewModel.handleRequestModelData()
  }

  public async handleRequestTemplateData() {
    this.viewModel.handleRequestTemplateData()
  }

  public async handleToggleLabels(showLabels: boolean) {
    this.viewModel.handleToggleLabels(showLabels)
  }

  public handleLog(message: string) {
    this.log.info(`[webview] ${message}`)
  }

  public handleError(message: string, stack?: string) {
    this.log.error?.(`[webview][error] ${message}`)
    if (stack) this.log.error?.(String(stack))
  }

  // Implementation methods triggered by ViewModel
  private handleRequestModelDataImpl() {
    const uri = this.getCurrentUri()
    if (!uri) { this.post({ type: 'modelData', data: null }); return }

    try {
      const state = this.viewModel.getPreviewState()
      this.log.info(`[preview] handleRequestModelData - isTemplateMode: ${state.isTemplateMode}`)

      const fileInfo = detectFileType(uri.fsPath)
      const isTemplate = fileInfo.type === FileType.TemplateFile && fileInfo.isValid
      const fileToRead = isTemplate && fileInfo.architecturePath ? fileInfo.architecturePath : uri.fsPath

      this.log.info(`[preview] Reading ${isTemplate ? 'architecture file for template mode' : 'current file'}: ${fileToRead}`)

      const fullModelData = this.modelService.readModel(fileToRead)
      const filteredData = this.modelService.filterBySelection(fullModelData, state.selectedId)
      this.post({ type: 'modelData', data: filteredData })
      this.log.info(`[preview] Sent filtered model data for selection: ${state.selectedId || 'none'}`)
    } catch (error) {
      this.log.error?.('[preview] Error reading model data: ' + String(error))
      this.post({ type: 'modelData', data: null })
    }
  }

  private async handleRequestTemplateDataImpl() {
    try {
      const state = this.viewModel.getPreviewState()
      let templateContent: string
      let templateName: string

      if (state.isTemplateMode && state.templateFilePath) {
        const parsed = parseFrontMatter(state.templateFilePath)
        if (parsed) {
          templateContent = this.templateService.processTemplateForLabels(parsed.content, state.showLabels)
          templateName = path.basename(state.templateFilePath)
        } else {
          templateContent = fs.readFileSync(state.templateFilePath, 'utf8')
          templateContent = this.templateService.processTemplateForLabels(templateContent, state.showLabels)
          templateName = path.basename(state.templateFilePath)
        }
      } else {
        templateContent = await this.templateService.generateTemplateContent(
          state.selectedId,
          this.viewModel.getData()?.graph,
          state.currentUri,
          state.showLabels,
          state.isTemplateMode,
          state.architectureFilePath
        )
        templateName = this.templateService.getTemplateNameForSelection(state.selectedId, this.viewModel.getData()?.graph)
      }

      this.post({
        type: 'templateData',
        data: { content: templateContent, name: templateName, selectedId: state.selectedId || 'none', isTemplateMode: state.isTemplateMode }
      })
    } catch (error) {
      this.log.error?.('[preview] Error reading template data: ' + String(error))
      this.post({ type: 'templateData', data: null })
    }
  }

  private handleRunDocifyImpl() {
    const state = this.viewModel.getPreviewState()
    const treeSelection = this.getCurrentTreeSelection ? this.getCurrentTreeSelection() : undefined
    this.log.info('[preview] runDocify requested')
    this.log.info(`[preview] runDocify - state.selectedId: ${state.selectedId}`)
    this.log.info(`[preview] runDocify - tree selection: ${treeSelection}`)
    this.log.info(`[preview] runDocify - isTemplateMode: ${state.isTemplateMode}`)
    this.log.info(`[preview] runDocify - currentUri: ${state.currentUri}`)
    this.log.info(`[preview] runDocify - architectureFilePath: ${state.architectureFilePath}`)
    this.runDocifyGuard
      .run(async () => {
        const res = await this.docifyService.run({
          currentFilePath: state.currentUri,
          isTemplateMode: state.isTemplateMode,
          templateFilePath: state.templateFilePath,
          architectureFilePath: state.architectureFilePath,
          selectedId: state.selectedId,
          getCurrentTreeSelection: this.getCurrentTreeSelection,
          lastData: this.viewModel.getData(),
          showLabels: state.showLabels,
        })
        // Preprocess the content to convert image paths before sending to webview
        const processedContent = res.format === 'markdown' ? this.preprocessMarkdownImages(res.content, res.sourceFile) : res.content

        // Use MVVM pattern - set result in DocifyViewModel instead of posting directly
        this.viewModel.docify.setDocifyResult(processedContent, res.format, res.sourceFile)
        this.log.info('[preview] Docify finished')
        this.log.info(`[preview] Docify result format: ${res.format}, source: ${res.sourceFile}`)
      })
      .catch(e => {
        // Use MVVM pattern - set error in DocifyViewModel instead of posting directly
        this.viewModel.docify.setDocifyError(String(e?.message || e))
      })
  }

  /**
   * Preprocess markdown content to convert relative image paths to webview URIs
   */
  private preprocessMarkdownImages(markdownContent: string, sourceFile: string): string {
    this.log.info(`[preview] Preprocessing markdown images from source: ${sourceFile}`)

    try {
      const sourceDir = path.dirname(sourceFile)
      this.log.info(`[preview] Source directory: ${sourceDir}`)

      // Regex to match markdown image syntax:
      // - Inline images: ![alt](path), ![alt](path "title"), ![alt](path 'title')
      // - Reference-style images: ![alt][ref]
      const imageRegex = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+(['"])(.*?)\3)?\)|!\[([^\]]*)\]\[([^\]]+)\]/g

      const processedContent = markdownContent.replace(imageRegex, (match, alt1, imagePath, quote, title, alt2, ref) => {
        // Handle inline images: ![alt](path "title") or ![alt](path)
        if (alt1 !== undefined) {
          this.log.info(`[preview] Found image: alt="${alt1}", path="${imagePath}"${title ? `, title="${title}"` : ''}`)

          if (this.isRelativePath(imagePath)) {
            try {
              let absolutePath: string

              if (imagePath.startsWith('./')) {
                absolutePath = path.resolve(sourceDir, imagePath.substring(2))
              } else if (imagePath.startsWith('../')) {
                absolutePath = path.resolve(sourceDir, imagePath)
              } else if (!imagePath.startsWith('/')) {
                absolutePath = path.resolve(sourceDir, imagePath)
              } else {
                return match // Skip absolute paths
              }

              this.log.info(`[preview] Resolved ${imagePath} to ${absolutePath}`)

              // Convert to webview URI
              const webviewUri = this.panel.webview.asWebviewUri(vscode.Uri.file(absolutePath))
              const convertedPath = webviewUri.toString()
              this.log.info(`[preview] Converted to webview URI: ${convertedPath}`)

              // Preserve title if present
              if (title) {
                return `![${alt1}](${convertedPath} ${quote}${title}${quote})`
              } else {
                return `![${alt1}](${convertedPath})`
              }
            } catch (error) {
              this.log.error?.(`[preview] Error converting image path ${imagePath}: ${String(error)}`)
              return match // Return original if conversion fails
            }
          } else {
            this.log.info(`[preview] Skipping non-relative image path: ${imagePath}`)
            return match // Return original for non-relative paths
          }
        }
        // Handle reference-style images: ![alt][ref]
        else if (alt2 !== undefined && ref !== undefined) {
          this.log.info(`[preview] Found reference-style image: alt="${alt2}", ref="${ref}"`)
          // For reference-style images, we would need to parse the reference definitions
          // elsewhere in the document. For now, we'll leave them unchanged.
          this.log.info(`[preview] Reference-style images not yet supported, leaving unchanged`)
          return match
        }

        return match
      })

      this.log.info(`[preview] Markdown preprocessing completed`)
      return processedContent
    } catch (error) {
      this.log.error?.(`[preview] Error preprocessing markdown images: ${String(error)}`)
      return markdownContent // Return original content if preprocessing fails
    }
  }

  private isRelativePath(path: string): boolean {
    // Check for absolute URLs
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:') || path.startsWith('blob:')) {
      return false
    }

    // Check for absolute file paths
    if (path.startsWith('/') || path.match(/^[a-zA-Z]:\\/)) {
      return false
    }

    // Check for special VS Code URIs
    if (path.startsWith('vscode-')) {
      return false
    }

    return true
  }
}
