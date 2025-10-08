import { CalmModelViewModel } from '../model-tab/view-model/calm-model.view-model'
import { TemplateViewModel } from '../template-tab/view-model/template.view-model'
import { DocifyViewModel } from '../docify-tab/view-model/docify.view-model'

interface VsCodeApi {
    postMessage(msg: any): void;
}

/**
 * TabsViewModel - Manages tab selection and coordinates child tab ViewModels
 */
class TabsViewModel {
    private activeTab: 'docify-panel' | 'template-panel' | 'model-panel' = 'docify-panel'
    private vscode: VsCodeApi

    // Child ViewModels
    public readonly model = new CalmModelViewModel()
    public readonly template = new TemplateViewModel()
    public readonly docify = new DocifyViewModel()

    // Observer callback for tab changes
    public onTabChanged: (tabId: string) => void = () => { }

    constructor(vscode: VsCodeApi) {
        this.vscode = vscode
    }

    setActiveTab(tabId: 'docify-panel' | 'template-panel' | 'model-panel'): void {
        if (this.activeTab !== tabId) {
            this.activeTab = tabId
            this.onTabChanged(tabId)

            // Request data when switching tabs
            if (tabId === 'docify-panel') this.vscode.postMessage({ type: 'runDocify' })
            if (tabId === 'template-panel') this.vscode.postMessage({ type: 'requestTemplateData' })
            if (tabId === 'model-panel') this.vscode.postMessage({ type: 'requestModelData' })
        }
    }

    getActiveTab(): string {
        return this.activeTab
    }

    isActiveTab(tabId: string): boolean {
        return this.activeTab === tabId
    }

    // Handle incoming messages and route to appropriate child ViewModel
    handleMessage(msg: any): void {
        switch (msg.type) {
            case 'modelData':
                if (msg.data) {
                    // Update model ViewModel with data
                    this.model.setModelData(msg.data)
                }
                break
            case 'templateData':
                if (msg.data) {
                    // Update template ViewModel with data
                    this.template.setTemplateContent(
                        msg.data.content || '',
                        msg.data.name || '',
                        msg.data.selectedId || 'none',
                        msg.data.isTemplateMode || false
                    )
                }
                break
            case 'templateMode':
                // Handle template mode changes from the backend
                this.template.setTemplateMode(
                    msg.isTemplateMode || false,
                    msg.templatePath,
                    msg.architecturePath
                )
                break
            case 'docifyResult':
                // Update docify ViewModel with result
                this.docify.setDocifyResult(msg.content, msg.format, msg.sourceFile)
                break
            case 'docifyError':
                // Update docify ViewModel with error
                this.docify.setDocifyError(msg.message)
                break
            case 'select':
                // Update all child ViewModels with selection
                this.model.setSelectedId(msg.id)
                this.template.setSelectedId(msg.id || 'none')

                // Request fresh data for all tabs on selection change
                this.vscode.postMessage({ type: 'requestModelData' })
                this.vscode.postMessage({ type: 'requestTemplateData' })

                // If on docify tab, refresh docify too
                if (this.activeTab === 'docify-panel') {
                    this.vscode.postMessage({ type: 'runDocify' })
                }
                break
        }
    }
}

/**
 * PanelViewModel - Main ViewModel that coordinates tabs
 * Note: Header is template-based with {{version}} interpolation, no dynamic ViewModel needed
 */
export class PanelViewModel {
    public readonly tabs = new TabsViewModel(this.vscode)

    constructor(private vscode: VsCodeApi) {
        // Set up message handling
        window.addEventListener('message', (event) => {
            this.handleMessage(event.data)
        })
    }

    private handleMessage(msg: any): void {
        // Forward messages to tabs ViewModel (header is static template-based)
        this.tabs.handleMessage(msg)
    }

    /**
     * Initialize the panel
     */
    initialize(): void {
        // Signal that webview is ready
        this.vscode.postMessage({ type: 'ready' })

        // Request initial docify data
        this.vscode.postMessage({ type: 'runDocify' })
    }
}