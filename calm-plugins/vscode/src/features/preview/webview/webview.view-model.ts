import MermaidRenderer from './mermaid-renderer';

interface VsCodeApi {
    postMessage(msg: any): void;
}

/**
 * The ViewModel for the webview.
 * It holds the UI state and logic, completely decoupled from the DOM.
 */
export class WebviewViewModel {
    private vscode: VsCodeApi;
    private markdownRenderer = new MermaidRenderer();

    // State
    public activeTabId: 'docify-panel' | 'template-panel' | 'model-panel' = 'docify-panel';
    public docifyContent = '<em>Initializing...</em>';
    public templateContent = '';
    public modelContent = '';
    public showLabels = true;
    public isTemplateMode = false;

    // Observer callback
    public onStateChange: () => void = () => {};

    constructor(vscodeApi: VsCodeApi) {
        this.vscode = vscodeApi;
        window.addEventListener('message', (event) => this.handleMessage(event.data));
    }

    private notify() {
        this.onStateChange();
    }

    private async handleMessage(msg: any) {
        switch (msg.type) {
            case 'docifyResult':
                this.docifyContent = msg.format === 'html' ? msg.content : await this.markdownRenderer.render(msg.content);
                this.notify();
                break;
            case 'docifyError':
                this.docifyContent = `<div style="color:var(--vscode-editorError-foreground)">Error: ${msg.message}</div>`;
                this.notify();
                break;
            case 'templateData':
                if (msg.data) {
                    this.isTemplateMode = msg.data.isTemplateMode;
                    const templateStr = this.escapeHtml(msg.data.content || '');
                    this.templateContent = `<pre>${templateStr}</pre>`;
                }
                this.notify();
                break;
            case 'modelData':
                if (msg.data) {
                    const modelStr = this.escapeHtml(JSON.stringify(msg.data, null, 2));
                    this.modelContent = `<pre>${modelStr}</pre>`;
                }
                this.notify();
                break;
        }
    }

    // --- Commands from the View ---
    public setActiveTab(tabId: 'docify-panel' | 'template-panel' | 'model-panel') {
        this.activeTabId = tabId;
        this.notify();

        // Request data if the tab is opened for the first time or needs fresh data
        if (tabId === 'docify-panel') this.vscode.postMessage({ type: 'runDocify' });
        if (tabId === 'template-panel') this.vscode.postMessage({ type: 'requestTemplateData' });
        if (tabId === 'model-panel') this.vscode.postMessage({ type: 'requestModelData' });
    }

    public toggleLabels(show: boolean) {
        this.showLabels = show;
        this.vscode.postMessage({ type: 'toggleLabels', showLabels: this.showLabels });
        this.notify();
    }

    // --- Queries from the View ---
    public isActiveTab(tabId: 'docify-panel' | 'template-panel' | 'model-panel'): boolean {
        return this.activeTabId === tabId;
    }

    private escapeHtml(str: string): string {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}

