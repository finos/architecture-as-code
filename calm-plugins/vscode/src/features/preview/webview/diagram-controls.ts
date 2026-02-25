/**
 * DiagramControls - UI controls for diagram zoom and pan
 */

import { PanZoomManager } from './pan-zoom-manager';

export interface DiagramControlsOptions {
    onZoomIn?: () => void;
    onZoomOut?: () => void;
    onReset?: () => void;
    onFit?: () => void;
}

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
