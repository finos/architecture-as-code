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

function init() {
    const container = document.getElementById('cy')!
    try {
        cy = cytoscape({
            container,
            elements: [],
            layout: { name: 'fcose' },
            style: getThemeStyles()
        })
    } catch (e: any) {
        postError('Cytoscape init failed', e)
    }

    cy?.on('select', 'node,edge', (e) => {
        const id = e.target.data('id')
        selectedId = id
        updateDetails(id)
        vscode.postMessage({ type: 'revealInEditor', id })
        cy?.elements().removeClass('selected')
        e.target.addClass('selected')
    })

    document.getElementById('fit')!.addEventListener('click', () => cy?.fit())
    document.getElementById('refresh')!.addEventListener('click', () => render(currentData))
    document.getElementById('goto')!.addEventListener('click', () => { if (selectedId) vscode.postMessage({ type: 'revealInEditor', id: selectedId }) })
    document.getElementById('layout')!.addEventListener('change', (e) => {
        const name = (e.target as HTMLSelectElement).value
        safeLayout(name)
    })
    document.getElementById('labels')!.addEventListener('change', (e) => {
        const show = (e.target as HTMLInputElement).checked
        currentShowLabels = show
        applyLabelVisibility(show)
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
        safeLayout('fcose')
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
    if (s.layout) safeLayout(s.layout)
    if (typeof s.showLabels === 'boolean') {
    currentShowLabels = s.showLabels
    applyLabelVisibility(s.showLabels)
    }
}

function updateDetails(id: string) {
    const pre = document.getElementById('detailsPre')!
    const node = currentData.nodes.find((n: any) => n.id === id)
    const edge = currentData.edges.find((e: any) => e.id === id)
    const selected = node || edge
    pre.textContent = JSON.stringify(selected, null, 2)
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
    const order = Array.from(new Set([preferred, 'fcose', 'dagre', 'cose'].filter(Boolean))) as string[]
    for (const name of order) {
        try {
            cy.layout({ name }).run()
            vscode.postMessage({ type: 'log', message: `Applied layout: ${name}` })
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
        text: '#e5e7eb',
        edge: '#9ca3af',
        selection: '#f59e0b'
    } : {
        nodeBg: '#4e79a7',
        text: '#222222',
        edge: '#aaaaaa',
        selection: '#f28e2b'
    }
    return [
        { selector: 'node', style: { 'label': currentShowLabels ? 'data(label)' : '', 'text-opacity': 0.95, 'background-color': palette.nodeBg, 'color': palette.text, 'font-size': 10 } },
        { selector: 'edge', style: { 'curve-style': 'bezier', 'target-arrow-shape': 'triangle', 'width': 1.5, 'line-color': palette.edge, 'target-arrow-color': palette.edge, 'label': currentShowLabels ? 'data(label)' : '', 'color': palette.text, 'font-size': 8 } },
        { selector: '.selected', style: { 'border-width': 3, 'border-color': palette.selection } }
    ]
}

function applyTheme() {
    if (!cy) return
    try {
        const styles = getThemeStyles()
        // Overwrite key styles based on theme
        const node = styles[0].style as any
        const edge = styles[1].style as any
        const st = cy.style()
        st.selector('node').style(node)
        st.selector('edge').style(edge)
        st.selector('.selected').style((styles[2].style as any))
        st.update()
    } catch (e) {
        postError('applyTheme failed', e)
    }
}

function applyLabelVisibility(show: boolean) {
    if (!cy) return
    try {
        cy.style().selector('node').style('label', show ? 'data(label)' : '').update()
        cy.style().selector('edge').style('label', show ? 'data(label)' : '').update()
    } catch (e) {
        // ignore
    }
}
