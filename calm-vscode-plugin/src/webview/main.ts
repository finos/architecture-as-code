/* global acquireVsCodeApi */
import cytoscape from 'cytoscape'
import fcose from 'cytoscape-fcose'
import dagre from 'cytoscape-dagre'

cytoscape.use(fcose)
cytoscape.use(dagre)

const vscode = (typeof window !== 'undefined' && (window as any).acquireVsCodeApi) ? (window as any).acquireVsCodeApi() : { postMessage: (_: any) => { } }

let cy: cytoscape.Core | undefined
let currentData: any
let selectedId: string | undefined
let currentShowLabels = true
let showDescriptions = false
let currentLayout: string = 'dagre'

function init() {
    const container = document.getElementById('cy')!
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
        if (id) vscode.postMessage({ type: 'revealInEditor', id })
    })

    document.getElementById('fit')!.addEventListener('click', () => cy?.fit())
    document.getElementById('refresh')!.addEventListener('click', () => render(currentData))
    document.getElementById('goto')!.addEventListener('click', () => { if (selectedId) vscode.postMessage({ type: 'revealInEditor', id: selectedId }) })
    document.getElementById('labels')!.addEventListener('change', (e) => {
        const show = (e.target as HTMLInputElement).checked
        currentShowLabels = show
        applyTheme()
        safeLayout(currentLayout)
    })
    document.getElementById('descriptions')!.addEventListener('change', (e) => {
        showDescriptions = (e.target as HTMLInputElement).checked
        applyTheme() // recompose label fields
        safeLayout(currentLayout)
    })

    window.addEventListener('message', (event) => {
        const msg = event.data
        if (msg.type === 'setData') {
            render(msg.graph)
            if (msg.selectedId) selectById(msg.selectedId)
            if (msg.settings) applySettings(msg.settings)
        } else if (msg.type === 'select') {
            selectById(msg.id)
        }
    })
    // notify ready
    vscode.postMessage({ type: 'ready' })

    // Apply theme and listen for changes (VS Code toggles body classes)
    applyTheme()
    const mo = new MutationObserver(() => applyTheme())
    mo.observe(document.body, { attributes: true, attributeFilter: ['class'] })
}

function render(graph: any) {
    try {
        currentData = graph || { nodes: [], edges: [] }
        if (!cy) return
        const nodes = Array.isArray(currentData.nodes) ? currentData.nodes : []
        const edges = Array.isArray(currentData.edges) ? currentData.edges : []
        const elements = [
            ...nodes.map((n: any) => ({ data: n })),
            ...edges.map((e: any) => ({ data: e }))
        ]
        cy.elements().remove()
        if (elements.length === 0) {
            vscode.postMessage({ type: 'log', message: 'No elements to render' })
        }
        cy.add(elements)
        // Ensure composed labels/styles before layout for correct sizing
        applyTheme()
        safeLayout(currentLayout)
        cy.fit()
        vscode.postMessage({ type: 'log', message: `Rendered ${nodes.length} nodes and ${edges.length} edges` })
    } catch (e: any) {
        postError('Render failed', e)
    }
}

function selectById(id: string) {
    const ele = cy?.elements().filter((e) => e.data('id') === id)
    if (ele && ele.length > 0) {
        cy?.elements().unselect()
        ele.select()
        cy?.center(ele)
        updateDetails(id)
    }
}

function applySettings(s: any) {
    if (!cy) return
    if (s.layout) {
        currentLayout = s.layout
        safeLayout(currentLayout)
    }
    if (typeof s.showLabels === 'boolean') {
        currentShowLabels = s.showLabels
        applyTheme()
        safeLayout(currentLayout)
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
            const lbl = data.label || ''
            const desc = data.description || ''
            e.data('labelWithDescription', desc ? `${lbl ? lbl + ' — ' : ''}${desc}` : lbl)
        })
        const styles = getThemeStyles()
        cy.style(styles as any)
    } catch (e) {
        postError('applyTheme failed', e)
    }
}

// label visibility is handled via getThemeStyles + applyTheme
