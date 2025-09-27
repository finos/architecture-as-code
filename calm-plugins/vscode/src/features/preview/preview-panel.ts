import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import { detectFileType, FileType } from '../../domain/file-types'
import { parseFrontMatter } from '../../domain/front-matter'
import { StateStore } from './state-store'
import { ModelService } from './model-service'
import { TemplateService } from './template-service'
import { HtmlBuilder } from './html-builder'
import { DocifyService } from './docify-service'
import { Debouncer } from './utils/debounce'
import { AsyncGuard } from './utils/async-guard'
import {
  isInMsg,
  InMsg,
  CommandRegistry,
  RevealInEditorCmd,
  SelectedCmd,
  ReadyCmd,
  SavePositionsCmd,
  SaveViewportCmd,
  ClearPositionsCmd,
  SaveTogglesCmd,
  RunDocifyCmd,
  RequestModelDataCmd,
  RequestTemplateDataCmd,
  ToggleLabelsCmd,
  LogCmd,
  ErrorCmd,
} from './commands'
import { GraphData } from "./types";
import { PreviewViewModel } from './preview.view-model'
import { Logger } from '../../core/ports/logger'

/** ---------- main panel ---------- */
export class CalmPreviewPanel {
  public static currentPanel: CalmPreviewPanel | undefined
  private readonly panel: vscode.WebviewPanel
  private disposables: vscode.Disposable[] = []
  private revealInEditorHandlers: Array<(id: string) => void> = []
  private selectHandlers: Array<(id: string) => void> = []

  private getCurrentTreeSelection: (() => string | undefined) | undefined = undefined

  private store: StateStore
  private modelService: ModelService
  private templateService: TemplateService
  private htmlBuilder: HtmlBuilder
  private docifyService: DocifyService
  private viewModel: PreviewViewModel

  private runDocifyDebounce = new Debouncer()
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
      CalmPreviewPanel.currentPanel.reveal(uri)
      return CalmPreviewPanel.currentPanel
    }
    const panel = vscode.window.createWebviewPanel('calmPreview', 'CALM Preview', column, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, 'dist'),
        vscode.Uri.joinPath(context.extensionUri, 'media'),
        vscode.Uri.joinPath(context.extensionUri, 'templates'),
      ],
    })
    CalmPreviewPanel.currentPanel = new CalmPreviewPanel(panel, context, config, log)
    CalmPreviewPanel.currentPanel.reveal(uri)
    return CalmPreviewPanel.currentPanel
  }

  constructor(
    panel: vscode.WebviewPanel,
    private context: vscode.ExtensionContext,
    private cfg: vscode.WorkspaceConfiguration,
    private log: Logger
  ) {
    this.panel = panel
    this.store = new StateStore(context)
    this.modelService = new ModelService()
    this.templateService = new TemplateService(context, log)
    this.htmlBuilder = new HtmlBuilder(context)
    this.docifyService = new DocifyService(log, this.templateService)

    // Initialize ViewModel with MVVM pattern
    this.viewModel = new PreviewViewModel()

    // Bind ViewModel events to service operations
    this.bindViewModelEvents()

    // register commands
    this.commands.register(new RevealInEditorCmd(this))
    this.commands.register(new SelectedCmd(this))
    this.commands.register(new ReadyCmd(this))
    this.commands.register(new SavePositionsCmd(this))
    this.commands.register(new SaveViewportCmd(this))
    this.commands.register(new ClearPositionsCmd(this))
    this.commands.register(new SaveTogglesCmd(this))
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
      if (state.ready && state.hasData) {
        this.post({ type: 'setData', ...this.viewModel.getData() })
        if (state.selectedId) {
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
    } else {
      this.viewModel.setTemplateMode(false)
      this.log.info(`[preview] Architecture mode: ${uri.fsPath}`)
    }

    this.panel.reveal(vscode.ViewColumn.Beside)
  }

  getCurrentUri(): vscode.Uri | undefined {
    const uri = this.viewModel.getCurrentUri()
    return uri ? vscode.Uri.file(uri) : undefined
  }

  onDidDispose(handler: () => void) { this.panel.onDidDispose(handler) }
  onRevealInEditor(handler: (id: string) => void) { this.revealInEditorHandlers.push(handler) }
  onDidSelect(handler: (id: string) => void) { this.selectHandlers.push(handler) }

  setData(payload: { graph: GraphData; selectedId?: string; settings?: unknown }) {
    const currentUri = this.getCurrentUri()
    const positions = currentUri ? this.store.getPositions(currentUri) : undefined
    const viewport = currentUri ? this.store.getViewport(currentUri) : undefined
    const toggles = currentUri ? this.store.getToggles(currentUri) : undefined
    const settings = { ...(payload.settings || {}), ...(toggles || {}) }

    this.viewModel.setData({ ...payload, settings, positions, viewport })
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
    this.viewModel.handleReady()
  }

  public handleSavePositions(positions: unknown) {
    this.viewModel.handleSavePositions(positions)
    const currentUri = this.getCurrentUri()
    if (currentUri) this.store.savePositions(currentUri, positions).catch(() => { })
  }

  public handleSaveViewport(viewport: unknown) {
    this.viewModel.handleSaveViewport(viewport)
    const currentUri = this.getCurrentUri()
    if (currentUri) this.store.saveViewport(currentUri, viewport).catch(() => { })
  }

  public handleClearPositions() {
    const currentUri = this.getCurrentUri()
    if (currentUri) this.store.clearPositions(currentUri).catch(() => { })
  }

  public handleSaveToggles(toggles: unknown) {
    const currentUri = this.getCurrentUri()
    if (currentUri) this.store.saveToggles(currentUri, toggles).catch(() => { })
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
    this.log.info('[preview] runDocify requested')
    this.runDocifyGuard
      .run(async () => {
        const state = this.viewModel.getPreviewState()
        const res = await this.docifyService.run({
          currentUri: state.currentUri ? vscode.Uri.file(state.currentUri) : undefined,
          isTemplateMode: state.isTemplateMode,
          templateFilePath: state.templateFilePath,
          architectureFilePath: state.architectureFilePath,
          selectedId: state.selectedId,
          getCurrentTreeSelection: this.getCurrentTreeSelection,
          lastData: this.viewModel.getData(),
          showLabels: state.showLabels,
        })
        this.post({ type: 'docifyResult', content: res.content, format: res.format, sourceFile: res.sourceFile })
      })
      .catch(e => this.post({ type: 'docifyError', message: String(e?.message || e) }))
  }
}
