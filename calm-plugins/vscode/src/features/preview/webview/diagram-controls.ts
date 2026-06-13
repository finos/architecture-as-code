/**
 * DiagramControls - UI controls for diagram zoom and pan
 */

import { PanZoomManager } from './pan-zoom-manager';
import '@vscode-elements/elements/dist/vscode-button/index.js';
import '@vscode-elements/elements/dist/vscode-context-menu/index.js';

export interface DiagramControlsOptions {
    onZoomIn?: () => void;
    onZoomOut?: () => void;
    onReset?: () => void;
    onFit?: () => void;
    onExportSvg?: () => void;
    onExportPng?: () => void;
}

type ExportFormat = 'svg' | 'png';

/**
 * Manages the diagram control UI and interactions
 */
export class DiagramControls {
    private container: HTMLElement | null = null;
    private panZoomManager: PanZoomManager;
    private options: DiagramControlsOptions;

    constructor(panZoomManager: PanZoomManager, options: DiagramControlsOptions = {}) {
        this.panZoomManager = panZoomManager;
        this.options = options;
    }

    /**
     * Create and inject control UI into a container
     */
    public createControls(parentElement: HTMLElement): HTMLElement {
        // Create controls container
        const controls = document.createElement('div');
        controls.className = 'diagram-controls';
        controls.setAttribute('role', 'toolbar');
        controls.setAttribute('aria-label', 'Diagram zoom and pan controls');

        // Zoom in button
        const zoomInBtn = this.createButton('➕', 'Zoom in', () => {
            this.panZoomManager.zoomIn();
            this.options.onZoomIn?.();
        });
        controls.appendChild(zoomInBtn);

        // Zoom out button
        const zoomOutBtn = this.createButton('➖', 'Zoom out', () => {
            this.panZoomManager.zoomOut();
            this.options.onZoomOut?.();
        });
        controls.appendChild(zoomOutBtn);

        // Fit to view button
        const fitBtn = this.createButton('⊡', 'Fit to view', () => {
            this.panZoomManager.fit();
            this.options.onFit?.();
        });
        controls.appendChild(fitBtn);

        // Export dropdown (SVG/PNG)
        const exportControl = this.createExportControl();
        if (exportControl) {
            controls.appendChild(exportControl);
        }

        // Store reference and inject into parent
        this.container = controls;
        parentElement.appendChild(controls);

        return controls;
    }

    /**
     * Create a control button
     */
    private createButton(
        label: string,
        title: string,
        onClick: () => void
    ): HTMLButtonElement {
        const button = document.createElement('button');
        button.className = 'diagram-control-btn';
        button.textContent = label;
        button.title = title;
        button.setAttribute('aria-label', title);
        button.addEventListener('click', onClick);
        return button;
    }

    /**
     * Create the "Export" button with an SVG/PNG dropdown menu.
     * Returns null if neither export callback was provided.
     */
    private createExportControl(): HTMLElement | null {
        const items: { label: string; value: ExportFormat }[] = [];
        if (this.options.onExportSvg) {
            items.push({ label: 'Export as SVG', value: 'svg' });
        }
        if (this.options.onExportPng) {
            items.push({ label: 'Export as PNG', value: 'png' });
        }
        if (items.length === 0) {
            return null;
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'diagram-export-control diagram-control-group-start';

        const trigger = document.createElement('vscode-button');
        trigger.textContent = 'Export ▾';
        trigger.secondary = true;
        trigger.title = 'Export diagram';
        trigger.setAttribute('aria-label', 'Export diagram');
        trigger.classList.add('diagram-export-trigger');

        const menu = document.createElement('vscode-context-menu');
        menu.classList.add('diagram-export-menu');
        menu.data = items;
        // Inline styles override the component's default `:host { position: relative }`
        // so the menu floats below the trigger instead of affecting toolbar layout.
        menu.style.position = 'absolute';
        menu.style.top = '100%';
        menu.style.right = '0';
        menu.style.marginTop = '4px';
        menu.style.zIndex = '1';

        trigger.addEventListener('click', () => {
            menu.show = !menu.show;
        });

        menu.addEventListener('vsc-context-menu-select', (event) => {
            const { value } = event.detail;
            if (value === 'svg') {
                this.options.onExportSvg?.();
            } else if (value === 'png') {
                this.options.onExportPng?.();
            }
        });

        wrapper.appendChild(trigger);
        wrapper.appendChild(menu);
        return wrapper;
    }

    /**
     * Show controls
     */
    public show(): void {
        if (this.container) {
            this.container.style.display = 'flex';
        }
    }

    /**
     * Hide controls
     */
    public hide(): void {
        if (this.container) {
            this.container.style.display = 'none';
        }
    }

    /**
     * Remove controls from DOM
     */
    public destroy(): void {
        if (this.container && this.container.parentElement) {
            this.container.parentElement.removeChild(this.container);
        }
        this.container = null;
    }
}
