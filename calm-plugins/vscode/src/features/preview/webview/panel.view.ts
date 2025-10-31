import { PanelViewModel, TabsViewModel } from './panel.view-model'
import { ModelTabView } from '../model-tab/view/model-tab.view'
import { TemplateTabView } from '../template-tab/view/template-tab.view'
import { DocifyTabView } from '../docify-tab/view/docify-tab.view'

/**
 * TabsView - Manages the tab selection and coordinates child tab views
 */
class TabsView {
    private container: HTMLElement
    private tabsViewModel: TabsViewModel

    // Child views
    private modelTabView: ModelTabView
    private templateTabView: TemplateTabView
    private docifyTabView: DocifyTabView

    constructor(tabsViewModel: TabsViewModel, container: HTMLElement) {
        this.tabsViewModel = tabsViewModel
        this.container = container

        // Create child tab views using existing DOM elements
        const modelContainer = document.getElementById('model-content')!
        const templateContainer = document.getElementById('template-content')!
        const docifyContainer = document.getElementById('docify-content')!

        this.modelTabView = new ModelTabView(tabsViewModel.model, modelContainer)
        this.templateTabView = new TemplateTabView(tabsViewModel.template, templateContainer)
        this.docifyTabView = new DocifyTabView(tabsViewModel.docify, docifyContainer, tabsViewModel.vscode)

        // Initialize docify tab
        this.docifyTabView.initialize()

        this.bindTabEvents()
        this.bindViewModelEvents()
    }

    private bindTabEvents(): void {
        // Bind tab button clicks
        const tabButtons = document.querySelectorAll('.tab-button')
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const target = button.getAttribute('data-target') as any
                if (target) {
                    this.tabsViewModel.setActiveTab(target)
                }
            })
        })
    }

    private bindViewModelEvents(): void {
        // Listen for tab changes from ViewModel
        this.tabsViewModel.onTabChanged = (tabId: string) => {
            this.updateActiveTab(tabId)
        }
    }

    private updateActiveTab(activeTabId: string): void {
        // Update tab button states
        const tabButtons = document.querySelectorAll('.tab-button')
        tabButtons.forEach(button => {
            const target = button.getAttribute('data-target')
            const isActive = target === activeTabId
            button.classList.toggle('active', isActive)
        })

        // Update tab content visibility
        const tabContents = document.querySelectorAll('.tab-content')
        tabContents.forEach(content => {
            const isActive = content.id === activeTabId
                ; (content as HTMLElement).style.display = isActive ? 'block' : 'none'
        })
    }

    /**
     * Update all tab views when selection changes
     */
    updateSelection(selectedId?: string): void {
        this.modelTabView.updateSelection(selectedId)
        this.templateTabView.updateSelection(selectedId)
        this.docifyTabView.updateSelection(selectedId)
    }

    dispose(): void {
        this.modelTabView.dispose()
        this.templateTabView.dispose()
        this.docifyTabView.dispose()
    }
}

/**
 * PanelView - Main view that coordinates tabs views
 * Note: Header is template-based ({{version}}) and doesn't need dynamic management
 */
export class PanelView {
    private tabsView: TabsView

    constructor(private panelViewModel: PanelViewModel) {
        // Get tabs container - header is static template-based
        const tabsContainer = document.getElementById('container')!

        // Create tabs view (header is handled by template interpolation)
        this.tabsView = new TabsView(panelViewModel.tabs, tabsContainer)

        this.bindViewModelEvents()

        // Set initial visibility state based on current template mode
        const initialTemplateMode = this.panelViewModel.tabs.template.getIsTemplateMode()
        this.updateShowLabelsControl(initialTemplateMode)
        this.updateLiveDocifyBadge(initialTemplateMode)

        // Set initial checkbox state
        const initialShowLabels = this.panelViewModel.tabs.template.getShowLabels()
        this.updateShowLabelsCheckbox(initialShowLabels)
    }

    private bindViewModelEvents(): void {
        // Listen for any ViewModel changes that affect the view
        // For now, selection changes are the main thing
        this.panelViewModel.tabs.model.onSelectionChanged((selectedId) => {
            this.tabsView.updateSelection(selectedId)
        })

        // Listen for template mode changes to show/hide live docify badge and show labels control
        this.panelViewModel.tabs.template.onTemplateModeChanged((modeData) => {
            this.updateLiveDocifyBadge(modeData.isTemplateMode)
            this.updateShowLabelsControl(modeData.isTemplateMode)
        })

        // Listen for show labels changes to update checkbox state
        this.panelViewModel.tabs.template.onShowLabelsChanged((showLabels) => {
            this.updateShowLabelsCheckbox(showLabels)
        })

        // Wire up the show labels checkbox event listener
        this.bindShowLabelsCheckbox()
        
        // Wire up the home button event listener
        this.bindBackButton()
    }

    /**
     * Update the live docify badge visibility based on template mode
     * Template mode = Live docify mode, so show badge when in template mode
     */
    private updateLiveDocifyBadge(isTemplateMode: boolean): void {
        const badge = document.getElementById('live-docify-badge')
        if (badge) {
            (badge as HTMLElement).style.display = isTemplateMode ? 'block' : 'none'
        }
    }

    /**
     * Update the show labels control visibility based on template mode
     * Show labels control should be visible for CALM JSON files (NOT in template mode)
     * Hide for markdown template files (in template mode)
     */
    private updateShowLabelsControl(isTemplateMode: boolean): void {
        const control = document.getElementById('show-labels-control')
        if (control) {
            // Show when NOT in template mode (i.e., when viewing CALM JSON files)
            (control as HTMLElement).style.display = isTemplateMode ? 'none' : 'flex'
        }
    }

    /**
     * Update the checkbox state to match the ViewModel
     */
    private updateShowLabelsCheckbox(showLabels: boolean): void {
        const checkbox = document.getElementById('show-labels-checkbox') as HTMLInputElement | null
        if (checkbox) {
            checkbox.checked = showLabels
        }
    }

    /**
     * Wire up the show labels checkbox to send toggleLabels messages
     */
    private bindShowLabelsCheckbox(): void {
        const checkbox = document.getElementById('show-labels-checkbox')
        if (checkbox) {
            checkbox.addEventListener('change', (event) => {
                const isChecked = (event.target as HTMLInputElement).checked
                this.panelViewModel.tabs.template.setShowLabels(isChecked)
                // Send message to backend to update showLabels preference
                this.panelViewModel.tabs.vscode.postMessage({
                    type: 'toggleLabels',
                    showLabels: isChecked
                })
                // Trigger immediate docify refresh to show the change
                this.panelViewModel.tabs.vscode.postMessage({
                    type: 'runDocify'
                })
            })
        }
    }

    /**
     * Wire up the home button to clear selection
     */
    private bindBackButton(): void {
        const backButton = document.getElementById('back-button')
        if (backButton) {
            backButton.addEventListener('click', () => {
                // Clear selection in the ViewModel
                this.panelViewModel.tabs.model.setSelectedId(undefined)
                
                // Send message to backend to clear selection
                this.panelViewModel.tabs.vscode.postMessage({
                    type: 'selected',
                    id: ''  // Empty string to clear selection
                })
                
                // Refresh all tabs to show full architecture - use single message to avoid race conditions
                this.panelViewModel.tabs.vscode.postMessage({ type: 'refreshAll' })
            })
        }
    }

    dispose(): void {
        this.tabsView.dispose()
    }
}