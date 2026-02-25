/**
 * PanZoomManager - Manages pan and zoom functionality for SVG diagrams
 * Wraps svg-pan-zoom library with lifecycle management and state tracking
 */

import svgPanZoom from 'svg-pan-zoom';

export interface PanZoomState {
    zoom: number;
    pan: { x: number; y: number };
}

export interface PanZoomOptions {
    minZoom?: number;
    maxZoom?: number;
    zoomScaleSensitivity?: number;
    mouseWheelZoomEnabled?: boolean;
    panEnabled?: boolean;
    controlIconsEnabled?: boolean;
}

/**
 * Manages pan and zoom for an SVG element
 */
export class PanZoomManager {
    private instance: SvgPanZoom.Instance | null = null;
    private svgElement: SVGSVGElement | null = null;

    /**
     * Initialize pan/zoom on an SVG element
     */
    public initialize(
        svgElement: SVGSVGElement,
        options: PanZoomOptions = {}
    ): void {
        if (this.instance) {
            this.destroy();
        }

        this.svgElement = svgElement;

        const defaultOptions = {
            minZoom: 0.1,
            maxZoom: 10,
            zoomScaleSensitivity: 0.3,
            mouseWheelZoomEnabled: true,
            panEnabled: true,
            controlIconsEnabled: false, // We'll use custom controls
            fit: false, // Don't auto-fit, we'll call it manually after resize
            center: false,
            contain: false, // Allow panning beyond original diagram bounds to use full container
            refreshRate: 'auto' as const,
        };

        this.instance = svgPanZoom(svgElement, {
            ...defaultOptions,
            ...options,
        });
        
        // Don't auto-fit/center - let the diagram render at its natural size
        // The user can use the Fit button if they want to fit it to viewport
    }

    /**
     * Zoom in by a percentage (default 25%)
     */
    public zoomIn(percentage: number = 0.25): void {
        if (!this.instance) return;
        
        const currentZoom = this.instance.getZoom();
        this.instance.zoom(currentZoom * (1 + percentage));
    }

    /**
     * Zoom out by a percentage (default 25%)
     */
    public zoomOut(percentage: number = 0.25): void {
        if (!this.instance) return;
        
        const currentZoom = this.instance.getZoom();
        this.instance.zoom(currentZoom * (1 - percentage));
    }

    /**
     * Reset zoom to 100% and center the diagram
     */
    public reset(): void {
        if (!this.instance) return;
        
        this.instance.resetZoom();
        this.instance.resetPan();
    }

    /**
     * Fit the entire diagram in the viewport
     */
    public fit(): void {
        if (!this.instance) return;
        
        // Recalculate viewport dimensions and update bounding box
        this.instance.resize();
        this.instance.updateBBox();
        // Then fit and center to fill the viewport
        this.instance.fit();
        this.instance.center();
    }

    /**
     * Set zoom to a specific level
     */
    public setZoom(level: number): void {
        if (!this.instance) return;
        
        this.instance.zoom(level);
    }

    /**
     * Get current zoom level
     */
    public getZoom(): number {
        if (!this.instance) return 1;
        
        return this.instance.getZoom();
    }

    /**
     * Get current pan position
     */
    public getPan(): { x: number; y: number } {
        if (!this.instance) return { x: 0, y: 0 };
        
        return this.instance.getPan();
    }

    /**
     * Set pan position
     */
    public setPan(position: { x: number; y: number }): void {
        if (!this.instance) return;
        
        this.instance.pan(position);
    }

    /**
     * Get current state (zoom and pan)
     */
    public getState(): PanZoomState {
        return {
            zoom: this.getZoom(),
            pan: this.getPan(),
        };
    }

    /**
     * Restore state (zoom and pan)
     */
    public setState(state: PanZoomState): void {
        if (!this.instance) return;
        
        this.setZoom(state.zoom);
        this.setPan(state.pan);
    }

    /**
     * Enable pan and zoom
     */
    public enable(): void {
        if (!this.instance) return;
        
        this.instance.enablePan();
        this.instance.enableZoom();
    }

    /**
     * Disable pan and zoom
     */
    public disable(): void {
        if (!this.instance) return;
        
        this.instance.disablePan();
        this.instance.disableZoom();
    }

    /**
     * Check if initialized
     */
    public isInitialized(): boolean {
        return this.instance !== null;
    }

    /**
     * Destroy the pan/zoom instance
     */
    public destroy(): void {
        if (this.instance) {
            this.instance.destroy();
            this.instance = null;
        }
        this.svgElement = null;
    }
}
