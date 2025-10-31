import type { DocifyViewModel } from '../view-model/docify.view-model'
import type { VsCodeApi } from '../../webview/panel.view-model'
import MermaidRenderer from '../../webview/mermaid-renderer'
import { DiagramControls } from '../../webview/diagram-controls'

const DOM_SETTLE_DELAY_MS = 150
const MIN_CLICKABLE_STROKE_WIDTH = 8
const HOVER_STROKE_WIDTH = 12

/**
 * DocifyTabView - Manages the DOM for the docify tab in the webview  
 * Keeps it simple like the original - just displays docify results
 */
export class DocifyTabView {
    private viewModel: DocifyViewModel
    private container: HTMLElement
    private markdownRenderer = new MermaidRenderer()
    private diagramControls: Map<string, DiagramControls> = new Map()
    private vscode: VsCodeApi

    constructor(viewModel: DocifyViewModel, container: HTMLElement, vscode: VsCodeApi) {
        this.viewModel = viewModel
        this.container = container
        this.vscode = vscode
        this.bindViewModel()
        this.initialize()
    }

    private bindViewModel(): void {
        // Listen for docify results
        this.viewModel.onDocifyResult((result: { content: string; format: 'html' | 'markdown'; sourceFile: string }) => {
            this.renderResult(result).catch(error => {
                console.error('Failed to render docify result:', error)
                this.renderError('Failed to render result')
            })
        })

        // Listen for docify errors
        this.viewModel.onDocifyError((error: string) => {
            this.renderError(error)
        })
    }

    /**
     * Initialize with default state
     */
    public initialize(): void {
        (this.container as any).innerHTML = '<em>Initializing...</em>'
    }

    /**
     * Render docify result - keep it simple but render markdown properly
     */
    private async renderResult(result: { content: string; format: 'html' | 'markdown'; sourceFile: string }): Promise<void> {
        const { content, format, sourceFile } = result
        
        // Clean up old diagram controls
        this.cleanupDiagramControls()

        if (format === 'html') {
            (this.container as any).innerHTML = content
        } else {
            // For markdown, render it through MermaidRenderer with source file path for image resolution
            const renderedHtml = await this.markdownRenderer.render(content, sourceFile);
            (this.container as any).innerHTML = renderedHtml

            // Initialize pan/zoom on all rendered diagrams
            this.initializePanZoomForDiagrams()
        }
    }

    /**
     * Initialize pan/zoom controls for all Mermaid diagrams in the content
     */
    private initializePanZoomForDiagrams(): void {
        // Wait a bit for DOM to settle
        setTimeout(() => {
            const diagramContainers = this.container.querySelectorAll('.mermaid-diagram-container')

            diagramContainers.forEach(container => {
            const diagramId = container.getAttribute('data-diagram-id')
            if (!diagramId) return

            // Initialize pan/zoom for this diagram
            const panZoomManager = this.markdownRenderer.initializePanZoom(diagramId, {
                minZoom: 0.1,
                maxZoom: 10,
                zoomScaleSensitivity: 0.2,
                mouseWheelZoomEnabled: true,
            })

            if (panZoomManager) {
                // Create controls for this diagram
                const controls = new DiagramControls(panZoomManager)
                controls.createControls(container as HTMLElement)
                this.diagramControls.set(diagramId, controls)
            }

            // Add click event listeners to Mermaid diagram nodes
            this.addClickHandlersToMermaidDiagram(container as HTMLElement)
            })
        }, DOM_SETTLE_DELAY_MS)
    }

    /**
     * Add click event listeners to Mermaid diagram nodes to enable selection
     */
    private addClickHandlersToMermaidDiagram(container: HTMLElement): void {
        const svg = container.querySelector('svg')
        if (!svg) {
            console.warn('[docify-tab] No SVG found in container')
            return
        }

        console.log('[docify-tab] Setting up click handlers for Mermaid diagram')
        const nodeGroups = svg.querySelectorAll('g.node')
        console.log(`[docify-tab] Found ${nodeGroups.length} node groups in diagram`)
        
        nodeGroups.forEach(nodeGroup => {
            // Extract the node ID from the group's ID attribute
            // Mermaid generates IDs like "flowchart-conference-website-123" for node "conference-website"
            const fullId = nodeGroup.getAttribute('id')
            if (!fullId) return

            // Extract the actual node ID by removing the diagram prefix and suffix
            const nodeId = this.extractNodeIdFromMermaidElement(fullId)
            if (!nodeId) return

            console.log(`[docify-tab] Processing node: ${fullId} -> ${nodeId}`);

            // Make the entire node group clickable (includes shape + label)
            (nodeGroup as SVGElement).style.cursor = 'pointer';
            (nodeGroup as SVGElement).style.pointerEvents = 'all'
            
            // Prevent text selection cursor on labels
            const labels = nodeGroup.querySelectorAll('text, tspan, foreignObject')
            labels.forEach(label => {
                (label as SVGElement).style.cursor = 'pointer';
                (label as SVGElement).style.userSelect = 'none';
                (label as SVGElement).style.pointerEvents = 'none' // Let clicks bubble to parent group
            })

            // Add click event listener to the entire node group
            nodeGroup.addEventListener('click', (event) => {
                event.stopPropagation()
                event.preventDefault()
                console.log(`[docify-tab] Clicked on node: ${nodeId}`)
                // Send selection message to the extension
                this.vscode.postMessage({ type: 'selected', id: nodeId })
            })
        })

        // Also handle edge clicks (relationships)
        const edgePaths = svg.querySelectorAll('g.edgePath')
        console.log(`[docify-tab] Found ${edgePaths.length} edge paths in diagram`)
        
        edgePaths.forEach(edgePath => {
            const fullId = edgePath.getAttribute('id')
            if (!fullId) return

            // Edge IDs are typically formatted differently, extract relationship ID
            const relationshipId = this.extractRelationshipIdFromMermaidElement(fullId)
            if (!relationshipId) return

            console.log(`[docify-tab] Processing edge: ${fullId} -> ${relationshipId}`);

            // Find the path element within the edge group
            const path = edgePath.querySelector('path.path')
            if (!path) {
                console.warn(`[docify-tab] No path found for edge ${relationshipId}`)
                return
            }

            // Make the path clickable - increase stroke width for easier clicking
            path.classList.add('clickable-edge');
            (path as SVGElement).style.cursor = 'pointer';
            (path as SVGElement).style.pointerEvents = 'visibleStroke'  // Make the visible stroke area clickable
            
            // Store original stroke width and increase for clickability
            const originalStrokeWidth = window.getComputedStyle(path as Element).strokeWidth;
            path.setAttribute('data-original-stroke-width', originalStrokeWidth)
            
            // Increase stroke width for better clickability
            const currentWidth = parseFloat(originalStrokeWidth) || 2;
            (path as SVGElement).style.strokeWidth = `${Math.max(currentWidth, MIN_CLICKABLE_STROKE_WIDTH)}px`
            
            // Add hover effect via event listeners instead of CSS (more reliable for SVG)
            path.addEventListener('mouseenter', () => {
                (path as SVGElement).style.strokeWidth = `${HOVER_STROKE_WIDTH}px`
            })
            path.addEventListener('mouseleave', () => {
                const baseWidth = parseFloat(path.getAttribute('data-original-stroke-width') || '2');
                (path as SVGElement).style.strokeWidth = `${Math.max(baseWidth, MIN_CLICKABLE_STROKE_WIDTH)}px`
            })

            // Add click event listener to the path
            path.addEventListener('click', (event) => {
                event.stopPropagation()
                event.preventDefault()
                console.log(`[docify-tab] Clicked on relationship: ${relationshipId}`)
                this.vscode.postMessage({ type: 'selected', id: relationshipId })
            })
        })

        console.log('[docify-tab] Click handlers attached successfully')
    }

    /**
     * Extract CALM node ID from Mermaid-generated element ID.
     * 
     * Expected input format: Mermaid typically generates IDs like "flowchart-conference-website-123".
     * This function removes the "flowchart-" prefix and the trailing numeric suffix.
     * 
     * Example:
     *   Input:  "flowchart-conference-website-123"
     *   Output: "conference-website"
     * 
     * @param mermaidId The Mermaid-generated element ID string.
     * @returns The extracted node ID, or null if extraction fails.
     */
    private extractNodeIdFromMermaidElement(mermaidId: string): string | null {
        // Remove common Mermaid prefixes
        let cleaned = mermaidId.replace(/^flowchart-/, '')
        
        // Remove trailing numbers (Mermaid appends random numbers)
        // Match everything except the last segment if it's purely numeric
        const match = cleaned.match(/^(.+?)-\d+$/)
        if (match) {
            return match[1]
        }
        
        // If no numeric suffix, return the cleaned ID
        return cleaned || null
    }

    /**
     * Extract CALM relationship ID from Mermaid-generated edge element ID
     * Mermaid edge IDs are formatted like "L-node1-node2-0" or similar
     */
    private extractRelationshipIdFromMermaidElement(mermaidId: string): string | null {
        // Mermaid edge IDs often start with "L-" or "LE-"
        let cleaned = mermaidId.replace(/^L[E]?-/, '')
        
        // Remove trailing numbers
        const match = cleaned.match(/^(.+?)-\d+$/)
        if (match) {
            return match[1]
        }
        
        return cleaned || null
    }

    /**
     * Clean up diagram controls
     */
    private cleanupDiagramControls(): void {
        this.diagramControls.forEach(controls => controls.destroy())
        this.diagramControls.clear()
        this.markdownRenderer.destroyAllPanZoom()
    }

    /**
     * Render docify error
     */
    private renderError(error: string): void {
        (this.container as any).innerHTML = `<div style="color:var(--vscode-editorError-foreground)">Error: ${this.escapeHtml(error)}</div>`
    }

    /**
     * Update the view when external selection changes
     */
    public updateSelection(_selectedId?: string): void {
        // Just update the internal state, don't auto-trigger docify
        // The TabsViewModel will handle triggering docify when appropriate
    }

    /**
     * Escape HTML to prevent XSS
     */
    private escapeHtml(str: string): string {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }

    /**
     * Cleanup event listeners
     */
    public dispose(): void {
        this.cleanupDiagramControls();
        (this.container as any).innerHTML = ''
    }
}