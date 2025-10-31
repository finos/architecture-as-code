import { PanelViewModel, VsCodeApi } from './panel.view-model'
import { PanelView } from './panel.view'

/**
 * PreviewPanelFactory - Creates and wires up the complete panel MVVM structure
 */
export class PreviewPanelFactory {

    /**
     * Create a complete panel with ViewModel and View hierarchy
     */
    static create(vscode: VsCodeApi): { viewModel: PanelViewModel; view: PanelView } {
        // Create the main PanelViewModel (which contains header and tabs ViewModels)
        const panelViewModel = new PanelViewModel(vscode)

        // Create the main PanelView (which contains header and tabs views)
        const panelView = new PanelView(panelViewModel)

        // Initialize the panel
        panelViewModel.initialize()

        return {
            viewModel: panelViewModel,
            view: panelView
        }
    }
}