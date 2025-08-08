/* global acquireVsCodeApi */
import cytoscape from 'cytoscape'
import fcose from 'cytoscape-fcose'
import dagre from 'cytoscape-dagre'
// Compose labels safely (duplicated here by logic to avoid bundling node module path issues)

cytoscape.use(fcose)
cytoscape.use(dagre)

const vscode = (typeof window !== 'undefined' && (window as any).acquireVsCodeApi) ? (window as any).acquireVsCodeApi() : { postMessage: (_: any) => { } }

let cy: cytoscape.Core | undefined
let currentData: any
let selectedId: string | undefined
let currentShowLabels = true
let showDescriptions = false
let currentLayout: string = 'dagre'
const nodePositions: Map<string, { x: number; y: number }> = new Map()
let pendingSelect: string | undefined
let pendingSelectTimer: any
let forceLayoutNextRender = false
let viewportAppliedFromHost = false

function init() {
    const container = document.getElementById('cy')!
    const grid = document.getElementById('container') as HTMLDivElement
    const divider = document.getElementById('divider') as HTMLDivElement
    try {
        cy = cytoscape({
            container,
            elements: [],
            layout: { name: 'dagre' },
            style: getThemeStyles()
        })
    } catch (e: any) {
        postError('Cytoscape init failed', e)
    }

    // Single tap/click: show details only
    cy?.on('tap', 'node,edge', (e) => {
        const id = e.target.data('id')
        selectedId = id
        updateDetails(id)
        cy?.elements().removeClass('selected')
        e.target.addClass('selected')
    })
    // Double tap: jump to source
    cy?.on('dbltap', 'node,edge', (e) => {
        const id = e.target.data('id')
        if (id) {
            vscode.postMessage({ type: 'revealInEditor', id })
        }
    })

    document.getElementById('fit')!.addEventListener('click', () => cy?.fit())
    document.getElementById('refresh')!.addEventListener('click', () => {
        // Clear saved positions to allow a fresh layout on refresh
        nodePositions.clear()
    forceLayoutNextRender = true
        render(currentData)
        // Persist new positions after layout will run inside render/safeLayout
    })
    document.getElementById('reset')!.addEventListener('click', () => {
        try {
            nodePositions.clear()
            vscode.postMessage({ type: 'clearPositions' })
            forceLayoutNextRender = true
            render(currentData)
        } catch { /* noop */ }
    })
    // Persist positions when user finishes dragging a node
    cy?.on('dragfree', 'node', () => {
        try { persistPositions() } catch { /* noop */ }
    })
    // Draggable divider logic
    if (grid && divider) {
        let dragging = false
        const minRight = 200 // px
        const minLeft = 200 // px
        divider.addEventListener('mousedown', (e) => {
            dragging = true
            e.preventDefault()
        })
        window.addEventListener('mousemove', (e) => {
            if (!dragging) return
            const rect = grid.getBoundingClientRect()
            let left = e.clientX - rect.left
            // clamp
            if (left < minLeft) left = minLeft
            if (left > rect.width - minRight) left = rect.width - minRight
            const right = rect.width - left
            // grid has three columns: left | divider | right
            grid.style.gridTemplateColumns = `${left}px 4px ${right - 4}px`
            cy?.resize()
        })
        window.addEventListener('mouseup', () => { dragging = false })
    }
    document.getElementById('labels')!.addEventListener('change', (e) => {
        const show = (e.target as HTMLInputElement).checked
        currentShowLabels = show
        applyTheme()
        // Avoid re-layout if user has positioned nodes
        if (nodePositions.size === 0) safeLayout(currentLayout)
    })
    document.getElementById('descriptions')!.addEventListener('change', (e) => {
        showDescriptions = (e.target as HTMLInputElement).checked
        applyTheme() // recompose label fields
        // Avoid re-layout if user has positioned nodes
        if (nodePositions.size === 0) safeLayout(currentLayout)
    })

    window.addEventListener('message', (event) => {
        const msg = event.data
        if (msg.type === 'setData') {
            // Seed cached positions from host persistence on first set
            if (msg.positions && typeof msg.positions === 'object' && nodePositions.size === 0) {
                try {
                    nodePositions.clear()
                    for (const [id, pos] of Object.entries(msg.positions)) {
                        if (pos && typeof (pos as any).x === 'number' && typeof (pos as any).y === 'number') {
                            nodePositions.set(String(id), { x: (pos as any).x, y: (pos as any).y })
                        }
                    }
                } catch { /* noop */ }
            }
            // Apply saved viewport if provided and we don't yet have a prior pan/zoom
        if (msg.viewport && typeof msg.viewport === 'object' && cy) {
                try {
                    if (typeof msg.viewport.zoom === 'number') cy.zoom(msg.viewport.zoom)
                    if (msg.viewport.pan && typeof msg.viewport.pan.x === 'number' && typeof msg.viewport.pan.y === 'number') {
                        cy.pan({ x: msg.viewport.pan.x, y: msg.viewport.pan.y })
                    }
            viewportAppliedFromHost = true
                } catch { /* noop */ }
            }
            render(msg.graph)
            // Do not center on selection during data updates to avoid viewport jumps
            if (msg.selectedId) selectById(msg.selectedId, false)
            if (msg.settings) applySettings(msg.settings)
        } else if (msg.type === 'select') {
            // Debounce selection so it happens after render/pan-restore, without re-centering
            pendingSelect = msg.id
            if (pendingSelectTimer) clearTimeout(pendingSelectTimer)
            pendingSelectTimer = setTimeout(() => {
                if (pendingSelect) selectById(pendingSelect, false)
                pendingSelect = undefined
            }, 30)
        }
    })
    // notify ready
    vscode.postMessage({ type: 'ready' })

    // Apply theme and listen for changes (VS Code toggles body classes)
    applyTheme()
    const mo = new MutationObserver(() => applyTheme())
    mo.observe(document.body, { attributes: true, attributeFilter: ['class'] })

    // Persist positions on unload as a safety net
    window.addEventListener('beforeunload', () => {
        try { persistPositions() } catch { /* noop */ }
    try { persistViewport() } catch { /* noop */ }
    })
}

function render(graph: any) {
    try {
        currentData = graph || { nodes: [], edges: [] }
        if (!cy) return
        // Snapshot current viewport to restore later
        let prevPan: any | undefined
        let prevZoom: number | undefined
    // Track whether we intentionally adjusted the viewport this render
    let skipViewportRestore = false
        try {
            prevPan = cy.pan ? cy.pan() : undefined
            prevZoom = cy.zoom ? cy.zoom() : undefined
        } catch { /* noop */ }

    const nodes = Array.isArray(currentData.nodes) ? currentData.nodes : []
    const edges = Array.isArray(currentData.edges) ? currentData.edges : []
    const c = cy as cytoscape.Core

    const newNodeIds = new Set(nodes.map((n: any) => String(n.id)))
    const newEdgeIds = new Set(edges.map((e: any) => String(e.id)))

    const wasEmpty = cy.elements().length === 0
    const hasAnySavedPositions = nodes.some((n: any) => nodePositions.has(String(n.id)))

        ;(cy as any).startBatch?.()
        // Persist existing positions
        try {
            cy.nodes().forEach(n => {
                const id = n.data('id')
                if (id) nodePositions.set(id, { ...n.position() })
            })
        } catch { /* noop */ }

        // Remove edges not present anymore (do edges first to avoid orphan inconsistencies)
        try {
            if (typeof (cy as any).edges === 'function') {
                (cy as any).edges().forEach((e: any) => {
                    const id = e.data('id')
                    if (id && !newEdgeIds.has(String(id))) {
                        e.remove()
                    }
                })
            }
        } catch { /* noop */ }
            // Remove nodes not present anymore
            try {
                cy.nodes().forEach(n => {
                    const id = n.data('id')
                    if (id && !newNodeIds.has(String(id))) {
                        n.remove()
                    }
                })
            } catch { /* noop */ }

        // Update existing nodes' data minimally and collect which are missing
    const existingNodeIds = new Set<string>()
    cy.nodes().forEach(n => { existingNodeIds.add(String(n.data('id'))) })

        // Add/update nodes, ensuring parents first on empty canvas
        const orderedNodes = wasEmpty
            ? [...nodes.filter((n: any) => !n.parent), ...nodes.filter((n: any) => !!n.parent)]
            : nodes
        for (const n of orderedNodes) {
            const id = String(n.id)
            if (existingNodeIds.has(id)) {
                const ele = cy.$id(id)
                if (ele && ele.length) {
                    // Only update fields that can change without recreating
                    const cur = ele.data()
                    if (cur.label !== n.label) ele.data('label', n.label)
                    if (cur.description !== n.description) ele.data('description', n.description)
                    if (cur['node-type'] !== n['node-type']) ele.data('node-type', n['node-type'])
                    // Parent changes must use move()
                    const curParent = (ele as any).parent()?.id() || undefined
                    const nextParent = n.parent
                    if (curParent !== nextParent) {
                        try { (ele as any).move({ parent: nextParent }) } catch { /* noop */ }
                    }
                }
            } else {
                // Add new node
                cy.add({ data: n })
                // Position new node near a neighbor if possible after we add edges below
            }
        }

        // Update existing edges or add new ones
    const existingEdgeIds = new Set<string>()
        try { cy.edges().forEach(e => { existingEdgeIds.add(String(e.data('id'))) }) } catch { /* noop */ }
        for (const e of edges) {
            const id = String(e.id)
            if (existingEdgeIds.has(id)) {
                const ele = cy.$id(id)
                if (ele && ele.length) {
                    const cur = ele.data()
                    if (cur.label !== e.label) ele.data('label', e.label)
                    if (cur.description !== e.description) ele.data('description', e.description)
                }
            } else {
                cy.add({ data: e })
            }
        }

        // Safety: synthesize placeholder nodes for any edge endpoints missing from the graph

            // Final sanity: ensure all nodes from data exist
            try {
                let addedCount = 0
                const seen = new Set<string>()
                cy.nodes().forEach(n => { const i = String(n.data('id')); if (i) seen.add(i) })
                for (const n of nodes) {
                    const id = String(n.id)
                    if (!seen.has(id)) {
                        c.add({ data: n })
                        addedCount++
                    }
                }
                if (addedCount > 0) {
                    vscode.postMessage({ type: 'log', message: `Sanity-added ${addedCount} missing nodes` })
                }
            } catch { /* noop */ }
    try {
        const presentIds = new Set<string>()
        cy.nodes().forEach(n => { presentIds.add(String(n.data('id'))) })
        edges.forEach((e: any) => {
                const src = String(e.source)
                const dst = String(e.target)
                if (src && !presentIds.has(src)) {
            c.add({ data: { id: src, label: src } })
                    presentIds.add(src)
                }
                if (dst && !presentIds.has(dst)) {
            c.add({ data: { id: dst, label: dst } })
                    presentIds.add(dst)
                }
        })
        } catch { /* noop */ }

        // Ensure composed labels/styles before any layout for sizing
        applyTheme()

    // Place any newly-added nodes near a positioned neighbor
    const toPlace: cytoscape.NodeCollection = cy.nodes().filter(n => !nodePositions.has(String(n.data('id'))))
    let fallbackCount = 0
    toPlace.forEach((node) => {
            const id = String(node.data('id'))
            let placed = false
            try {
        const connected = c.edges().filter(e => e.data('source') === id || e.data('target') === id)
                for (const e of connected) {
                    const otherId = e.data('source') === id ? e.data('target') : e.data('source')
                    const op = nodePositions.get(String(otherId))
                    if (op) {
                        node.position({ x: op.x + 60, y: op.y + 40 })
                        placed = true
                        break
                    }
                }
            } catch { /* noop */ }
            // Fallback 2: if the node has a compound parent, place near the parent
            if (!placed) {
                try {
                    const pId = (node as any).data('parent')
                    if (pId) {
                        const pp = nodePositions.get(String(pId)) || ((c.$id(String(pId)) as any).position?.() as any)
                        if (pp && typeof pp.x === 'number' && typeof pp.y === 'number') {
                            node.position({ x: pp.x + 60, y: pp.y + 40 })
                            placed = true
                        }
                    }
                } catch { /* noop */ }
            }
            if (!placed) {
                // Fallback: place at current viewport center to ensure visibility
                try {
                    const ext = c.extent?.()
                    if (ext) {
                        const cx = (ext.x1 + ext.x2) / 2
                        const cyv = (ext.y1 + ext.y2) / 2
                        // Spread multiple new nodes around center to avoid overlap/zero-length edges
                        const col = fallbackCount % 3
                        const row = Math.floor(fallbackCount / 3)
                        const dx = (col - 1) * 90 // -90, 0, +90
                        const dy = (row - 1) * 70 // -70, 0, +70
                        node.position({ x: cx + dx, y: cyv + dy })
                        fallbackCount += 1
                    } else {
                        node.position({ x: 50, y: 50 })
                    }
                } catch {
                    node.position({ x: 50, y: 50 })
                }
            }
        })

    // If this is the first render with saved positions, tidy up only the new nodes within the viewport
        if (wasEmpty && hasAnySavedPositions && toPlace.length > 0) {
            try {
                const ext = c.extent?.()
                const bbox = ext ? { x1: ext.x1, y1: ext.y1, w: ext.x2 - ext.x1, h: ext.y2 - ext.y1 } : undefined
                toPlace.layout({ name: 'grid', boundingBox: bbox, avoidOverlap: true } as any).run()
            } catch { /* noop */ }
        }

        // Restore known positions explicitly (in case any changed via compound reparenting)
        cy.nodes().forEach(n => {
            const id = String(n.data('id'))
            const pos = nodePositions.get(id)
            if (pos) n.position(pos)
        })

        // Decide if we should run an initial or forced layout
    if (forceLayoutNextRender && nodes.length > 0) {
            safeLayout(currentLayout)
            cy.fit()
            forceLayoutNextRender = false
        skipViewportRestore = true
        } else if (wasEmpty && nodes.length > 0) {
            if (!hasAnySavedPositions) {
                safeLayout(currentLayout)
                if (!prevPan || typeof prevZoom !== 'number') {
                    cy.fit()
            skipViewportRestore = true
                }
            } else {
                // If we have saved positions but no host-provided viewport, fit once to ensure visibility
                if (!viewportAppliedFromHost) {
            cy.fit()
            skipViewportRestore = true
                } else {
                    vscode.postMessage({ type: 'log', message: 'Skipped initial layout due to saved positions' })
                }
            }
        }

        // Safety net: on very first render, if the current viewport shows little to no content, do a single fit
        if (wasEmpty && nodes.length > 0 && !skipViewportRestore) {
            try {
                const ext = c.extent?.()
                if (ext) {
                    let inside = 0
                    cy.nodes().forEach(n => {
                        const p = (n as any).position()
                        if (p.x >= ext.x1 && p.x <= ext.x2 && p.y >= ext.y1 && p.y <= ext.y2) inside += 1
                    })
                    const total = Math.max(1, cy.nodes().length)
                    const ratio = inside / total
                    if (inside === 0 || ratio < 0.25) {
                        cy.fit()
                        skipViewportRestore = true
                    }
                }
            } catch { /* noop */ }
        }

        // Non-empty canvas: ensure any genuinely new nodes are visible if they landed outside the current viewport
        if (!wasEmpty && toPlace.length > 0) {
            try {
                const ext = c.extent?.()
                if (ext) {
                    let outside = false
                    toPlace.forEach((n) => {
                        const p = (n as any).position()
                        if (p.x < ext.x1 || p.x > ext.x2 || p.y < ext.y1 || p.y > ext.y2) outside = true
                    })
                    if (outside) {
                        if (typeof c.center === 'function') {
                            c.center(toPlace)
                            skipViewportRestore = true
                        }
                    }
                }
            } catch { /* noop */ }
        }

        // Always restore previous viewport to avoid any subtle camera drift
            try {
                // Skip restoring viewport if we intentionally adjusted it this frame
                if (!forceLayoutNextRender && !skipViewportRestore) {
                    if (prevPan && typeof cy.pan === 'function') cy.pan(prevPan)
                    if (typeof prevZoom === 'number' && typeof cy.zoom === 'function') cy.zoom(prevZoom)
                }
            } catch { /* noop */ }

        ;(cy as any).endBatch?.()
        cy.resize()
        // If first render with saved positions, ensure any newly placed nodes are visible
        if (wasEmpty && hasAnySavedPositions && toPlace.length > 0) {
            try {
                const ext = c.extent?.()
                if (ext) {
                    let outside = false
                    toPlace.forEach((n) => {
                        const p = (n as any).position()
                        if (p.x < ext.x1 || p.x > ext.x2 || p.y < ext.y1 || p.y > ext.y2) outside = true
                    })
                    if (outside && typeof c.center === 'function') {
                        c.center(toPlace)
                    }
                }
            } catch { /* noop */ }
        }
        // Persist viewport after render settles (and after any visibility adjustment)
        try { persistViewport() } catch { /* noop */ }

        vscode.postMessage({ type: 'log', message: `Rendered ${nodes.length} nodes and ${edges.length} edges` })
        // Apply any pending selection after viewport restore
        if (pendingSelect) selectById(pendingSelect, false)
    } catch (e: any) {
        postError('Render failed', e)
    }
}

function selectById(id: string, center: boolean = true) {
    const ele = cy?.elements().filter((e) => e.data('id') === id)
    if (ele && ele.length > 0) {
        cy?.elements().unselect()
        ele.select()
        if (center) {
            cy?.center(ele)
        }
        updateDetails(id)
    }
}

function applySettings(s: any) {
    if (!cy) return
    if (s.layout) {
        currentLayout = s.layout
        // Only (re)layout if we don't have user-defined positions
        if (nodePositions.size === 0) {
            safeLayout(currentLayout)
        }
    }
    if (typeof s.showLabels === 'boolean') {
        currentShowLabels = s.showLabels
        applyTheme()
        // Only (re)layout if we don't have user-defined positions
        if (nodePositions.size === 0) {
            safeLayout(currentLayout)
        }
    }
}

function updateDetails(id: string) {
    const pre = document.getElementById('detailsPre')!
    const node = currentData.nodes.find((n: any) => n.id === id)
    const edge = currentData.edges.find((e: any) => e.id === id)
    const selected = node || edge
    if (!selected) { pre.textContent = ''; return }
    // Prefer raw for full detail; fallback to selected
    const raw = selected.raw || selected
    try {
        pre.textContent = JSON.stringify(raw, null, 2)
    } catch {
        pre.textContent = String(raw)
    }
}

init()

// Error/log helpers
function postError(context: string, e: any) {
    try {
        const msg = `${context}: ${e?.message || e}`
        vscode.postMessage({ type: 'error', message: msg, stack: e?.stack })
    } catch { /* noop */ }
}

window.addEventListener('error', (ev) => {
    postError('Window error', ev.error || ev.message)
})

window.addEventListener('unhandledrejection', (ev: any) => {
    postError('Unhandled rejection', ev.reason)
})

function safeLayout(preferred?: string) {
    if (!cy) return
    if (preferred) currentLayout = preferred
    const order = Array.from(new Set([currentLayout, 'dagre', 'fcose', 'cose'].filter(Boolean))) as string[]
    for (const name of order) {
        try {
            cy.layout({ name }).run()
            vscode.postMessage({ type: 'log', message: `Applied layout: ${name}` })
            currentLayout = name
            // Update cached positions after layout so we preserve them on next render
            try {
                nodePositions.clear()
                cy.nodes().forEach(n => {
                    const id = n.data('id')
                    if (id) nodePositions.set(id, { ...n.position() })
                })
                // Persist positions after layout
                persistPositions()
                // Persist viewport too
                persistViewport()
            } catch { /* noop */ }
            return
        } catch (e) {
            // try next
        }
    }
    vscode.postMessage({ type: 'error', message: 'No usable layout found (fcose/dagre/cose)' })
}

// Theme helpers
function isDarkTheme(): boolean {
    const c = document.body.classList
    return c.contains('vscode-dark') || c.contains('vscode-high-contrast')
}

function getThemeStyles(): any[] {
    const dark = isDarkTheme()
    const palette = dark ? {
        nodeBg: '#3b82f6',
        text: '#111827',
        edge: '#9ca3af',
        selection: '#f59e0b'
    } : {
        nodeBg: '#4e79a7',
        text: '#222222',
        edge: '#aaaaaa',
        selection: '#f28e2b'
    }
    const nodeLabelField = showDescriptions ? 'data(labelWithDescription)' : 'data(labelWithoutDescription)'
    return [
        {
            selector: 'node', style: {
                'label': currentShowLabels ? nodeLabelField : '',
                'text-opacity': 1,
                'background-color': '#f5f5f5',
                'color': palette.text,
                'font-size': 14,
                'text-wrap': 'wrap',
                'text-max-width': '180px',
                'text-valign': 'center',
                'text-halign': 'center',
                'font-family': 'Arial',
                'border-color': 'black',
                'border-width': 1,
                'padding': '10px',
                'width': '200px',
                'height': 'label',
                'shape': 'rectangle'
            }
        },
        {
            selector: ':parent', style: {
                'label': 'data(label)',
                'text-valign': 'top',
                'text-halign': 'center',
                'background-color': 'white',
                'border-style': 'dashed',
                'border-width': 2,
                'border-dash-pattern': [8, 10],
                'padding': '20px'
            }
        },
        {
            selector: ':parent:selected', style: {
                'border-color': palette.selection,
                'border-width': 3
            }
        },
        {
            selector: 'edge', style: {
                'curve-style': 'bezier',
                'target-arrow-shape': 'triangle',
                'width': 2,
                'line-color': palette.edge,
                'target-arrow-color': palette.edge,
                'label': currentShowLabels ? (showDescriptions ? 'data(labelWithDescription)' : 'data(label)') : '',
                'color': palette.text,
                'font-size': 14,
                'text-wrap': 'ellipsis',
                'text-background-color': 'white',
                'text-background-opacity': 1,
                'text-background-padding': '5px'
            }
        },
        { selector: '.selected', style: { 'border-width': 3, 'border-color': palette.selection } }
    ]
}

function applyTheme() {
    if (!cy) return
    try {
        // Before applying styles, compute composed label fields into element data
        cy.nodes().forEach(n => {
            const data = n.data()
            const title = data.label || data.id
            const desc = data.description || ''
            n.data('labelWithoutDescription', title)
            n.data('labelWithDescription', desc ? `${title}\n${desc}` : title)
        })
        cy.edges().forEach(e => {
            const data = e.data()
            const lbl = (data.label || '').trim()
            const desc = (data.description || '').trim()
            const composed = (!lbl && desc)
                ? desc
                : (desc && desc !== lbl && !lbl.includes(desc))
                    ? `${lbl}${lbl ? ' — ' : ''}${desc}`
                    : lbl
            e.data('labelWithDescription', composed)
        })
        const styles = getThemeStyles()
        cy.style(styles as any)
    } catch (e) {
        postError('applyTheme failed', e)
    }
}

// label visibility is handled via getThemeStyles + applyTheme

function persistPositions() {
    if (!cy) return
    try {
        const map: Record<string, { x: number; y: number }> = {}
        cy.nodes().forEach(n => {
            // Only persist leaf nodes; parents are computed from children
            if ((n as any).isParent && (n as any).isParent()) return
            const id = n.data('id')
            if (!id) return
            const p = n.position()
            map[String(id)] = { x: p.x, y: p.y }
        })
        vscode.postMessage({ type: 'savePositions', positions: map })
    } catch { /* noop */ }
}

function persistViewport() {
    if (!cy) return
    try {
        const pan = cy.pan ? cy.pan() : undefined
        const zoom = cy.zoom ? cy.zoom() : undefined
        if (pan && typeof zoom === 'number') {
            vscode.postMessage({ type: 'saveViewport', viewport: { pan, zoom } })
        }
    } catch { /* noop */ }
}
