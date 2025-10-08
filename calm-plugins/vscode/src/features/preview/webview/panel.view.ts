import { PanelViewModel } from './panel.view-model'
import { ModelTabView } from '../model-tab/view/model-tab.view'
import { TemplateTabView } from '../template-tab/view/template-tab.view'
import { DocifyTabView } from '../docify-tab/view/docify-tab.view'

/**
 * TabsView - Manages the tab selection and coordinates child tab views
 */
class TabsView {
    private container: HTMLElement
    private tabsViewModel: any

    // Child views
    private modelTabView: ModelTabView
    private templateTabView: TemplateTabView
    private docifyTabView: DocifyTabView

    constructor(tabsViewModel: any, container: HTMLElement) {
        this.tabsViewModel = tabsViewModel
        this.container = container

        // Create child tab views using existing DOM elements
        const modelContainer = document.getElementById('model-content')!
        const templateContainer = document.getElementById('template-content')!
        const docifyContainer = document.getElementById('docify-content')!

        this.modelTabView = new ModelTabView(tabsViewModel.model, modelContainer)
        this.templateTabView = new TemplateTabView(tabsViewModel.template, templateContainer)
        this.docifyTabView = new DocifyTabView(tabsViewModel.docify, docifyContainer)

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
    }

    private bindViewModelEvents(): void {
        // Listen for any ViewModel changes that affect the view
        // For now, selection changes are the main thing
        this.panelViewModel.tabs.model.onSelectionChanged((selectedId) => {
            this.tabsView.updateSelection(selectedId)
        })

        // Listen for template mode changes to show/hide live docify badge
        this.panelViewModel.tabs.template.onTemplateModeChanged((modeData) => {
            this.updateLiveDocifyBadge(modeData.isTemplateMode)
        })
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

    dispose(): void {
        this.tabsView.dispose()
    }
}