import { WebviewViewModel } from './webview.view-model';

/**
 * The View is responsible for all DOM manipulations.
 * It observes the ViewModel and updates the UI when the state changes.
 */
export class View {
    private docifyContent: HTMLElement;
    private templateContent: HTMLElement;
    private modelContent: HTMLElement;
    private showLabelsCheckbox: HTMLInputElement;

    constructor(private viewModel: WebviewViewModel) {
        this.docifyContent = document.getElementById('docify-content')!;
        this.templateContent = document.getElementById('template-content')!;
        this.modelContent = document.getElementById('model-content')!;
        this.showLabelsCheckbox = document.getElementById('show-labels-checkbox') as HTMLInputElement;

        this.bindEvents();
        this.viewModel.onStateChange = () => this.render();
    }

    private bindEvents() {
        // Bind tab buttons
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', () => {
                const target = button.getAttribute('data-target');
                if (target) {
                    this.viewModel.setActiveTab(target as any);
                }
            });
        });

        // Bind show labels checkbox
        this.showLabelsCheckbox.addEventListener('change', () => {
            this.viewModel.toggleLabels(this.showLabelsCheckbox.checked);
        });
    }

    private render() {
        // Update content panels
        this.docifyContent.innerHTML = this.viewModel.docifyContent;
        this.templateContent.innerHTML = this.viewModel.templateContent;
        this.modelContent.innerHTML = this.viewModel.modelContent;

        // Update active tab
        document.querySelectorAll('.tab-button').forEach(button => {
            const target = button.getAttribute('data-target');
            const isActive = this.viewModel.isActiveTab(target as any);
            button.classList.toggle('active', isActive);
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            const isActive = this.viewModel.isActiveTab(content.id as any);
            (content as HTMLElement).style.display = isActive ? 'block' : 'none';
        });

        // Update other UI elements
        this.showLabelsCheckbox.checked = this.viewModel.showLabels;
        (document.getElementById('live-docify-badge') as HTMLElement).style.display = this.viewModel.isTemplateMode ? 'block' : 'none';
        (document.getElementById('show-labels-control') as HTMLElement).style.display = this.viewModel.isTemplateMode ? 'none' : 'flex';
    }
}

