import { parse as parseYaml } from 'yaml'

export type CalmModel = {
    nodes?: Array<{ id: string; type?: string; name?: string; label?: string }>
    relationships?: Array<{ id: string; type?: string; source: string; target: string; label?: string }>
    flows?: Array<{ id: string; source: string; target: string; label?: string }>
}

export function detectCalmModel(text: string): boolean {
    try {
        const json = tryParse(text)
        if (!json || typeof json !== 'object') return false
        return Array.isArray((json as any).nodes) || Array.isArray((json as any).relationships) || Array.isArray((json as any).flows)
    } catch { return false }
}

export function loadCalmModel(text: string): CalmModel {
    const json = tryParse(text)
    return normalizeModel(json)
}

function tryParse(text: string): any {
    const trimmed = text.trim()
    if (!trimmed) return {}
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) return JSON.parse(text)
    return parseYaml(text)
}

export class ModelIndex {
    private idToRange = new Map<string, any>()
    constructor(private doc: any, private model: CalmModel) {
        this.indexDocument()
    }
    private indexDocument() {
        const text = this.doc.getText()
        // JSON: match both "id" and "unique-id"
        const rx = /"(?:id|unique-id)"\s*:\s*"([^"]+)"/g
        let m: RegExpExecArray | null
        while ((m = rx.exec(text))) {
            const id = m[1]
            const start = this.doc.positionAt(m.index)
            const end = this.doc.positionAt(m.index + m[0].length)
            this.idToRange.set(id, new (require('vscode').Range)(start, end))
        }
        // YAML: id: value OR unique-id: value (quoted or unquoted)
        const ry = /(^|\s)(?:id|unique-id)\s*:\s*([\w.-]+|\"[^\"]+\"|'[^']+')/gm
        while ((m = ry.exec(text))) {
            let raw = m[2]
            if (raw.startsWith('"') || raw.startsWith("'")) raw = raw.slice(1, -1)
            const id = raw
            if (!this.idToRange.has(id)) {
                const start = this.doc.positionAt(m.index)
                const end = this.doc.positionAt(m.index + m[0].length)
                this.idToRange.set(id, new (require('vscode').Range)(start, end))
            }
        }
    }
    idAt(doc: any, pos: any): string | undefined {
        // naive: find nearest id occurrence covering pos
        for (const [id, range] of this.idToRange) {
            if (range.contains(pos)) return id
        }
        return undefined
    }
    rangeOf(id: string): any | undefined {
        return this.idToRange.get(id)
    }
    get nodes() { return (this.model.nodes || []).map(n => ({ id: n.id, label: n.label || n.name || n.id })) }
    get relationships() { return (this.model.relationships || []).map(r => ({ id: r.id, label: r.label })) }
    get flows() { return (this.model.flows || []).map(f => ({ id: f.id, label: f.label })) }
}

export function toGraph(model: CalmModel, _cfg?: any) {
    const nodes = (model.nodes || [])
        .filter(n => !!n.id)
        .map(n => ({ id: n.id, label: n.label || n.name || n.id, type: n.type }))
    const relEdges = (model.relationships || [])
        .filter(r => !!r.source && !!r.target)
        .map(r => ({ id: r.id || `${r.source}->${r.target}`, source: r.source, target: r.target, label: r.label, type: r.type }))
    const flowEdges = (model.flows || [])
        .filter(f => !!f.source && !!f.target)
        .map(f => ({ id: f.id || `${f.source}->${f.target}`, source: f.source, target: f.target, label: f.label, type: 'flow' }))
    return { nodes, edges: [...relEdges, ...flowEdges] }
}

// Normalize various CALM JSON/YAML shapes to the internal CalmModel
function normalizeModel(input: any): CalmModel {
    if (!input || typeof input !== 'object') return {}

    const rawNodes: any[] = Array.isArray(input.nodes) ? input.nodes : []
    const nodes = rawNodes.map(n => ({
        id: n['unique-id'] ?? n.id,
        type: n['node-type'] ?? n.type,
        name: n.name,
        label: n.label ?? n.name ?? (n['unique-id'] ?? n.id)
    })).filter(n => !!n.id)

    const rels: any[] = Array.isArray(input.relationships) ? input.relationships : []
    const relationships: CalmModel['relationships'] = []

    for (const r of rels) {
        const relId = r['unique-id'] ?? r.id
        const label = r.label ?? r.description ?? r.protocol
        const rt = r['relationship-type'] ?? r.type
        if (rt && typeof rt === 'object' && rt.connects) {
            const src = rt.connects?.source?.node ?? r.source
            const dst = rt.connects?.destination?.node ?? r.target
            if (src && dst) relationships!.push({ id: relId ?? `${src}->${dst}`, source: src, target: dst, label, type: 'connects' })
        } else if (rt && typeof rt === 'object' && rt['deployed-in']) {
            const container = rt['deployed-in']?.container
            const ns: string[] = Array.isArray(rt['deployed-in']?.nodes) ? rt['deployed-in'].nodes : []
            for (const n of ns) {
                // direction: node -> container (deployed in)
                const id = relId ? `${relId}:${n}` : `${n}->${container}`
                if (n && container) relationships!.push({ id, source: n, target: container, label: 'deployed-in', type: 'deployed-in' })
            }
        } else if (r.source && r.target) {
            relationships!.push({ id: relId ?? `${r.source}->${r.target}`, source: r.source, target: r.target, label, type: typeof rt === 'string' ? rt : undefined })
        }
    }

    const flows: any[] = Array.isArray(input.flows) ? input.flows : []
    const normFlows = flows.map(f => ({
        id: f['unique-id'] ?? f.id,
        source: f.source,
        target: f.target,
        label: f.label ?? f.description
    })).filter(f => !!f.source && !!f.target)

    return { nodes, relationships, flows: normFlows }
}
