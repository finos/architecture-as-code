import { parse as parseYaml } from 'yaml'

export type CalmModel = {
    nodes?: Array<{ id: string; type?: string; name?: string; label?: string; description?: string; raw?: any }>
    relationships?: Array<{ id: string; type?: string; source: string; target: string; label?: string; description?: string; raw?: any }>
    flows?: Array<{ id: string; source?: string; target?: string; label?: string; description?: string; raw?: any }>
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



export function toGraph(model: CalmModel, _cfg?: any) {
    // Build parent mapping from 'deployed-in' relationships (node -> container)
    const parentMap = new Map<string, string>()
    for (const r of (model.relationships || []) as any[]) {
        if (r && (r.type === 'deployed-in' || r.type === 'composed-of') && r.source && r.target) {
            parentMap.set(r.source, r.target)
        }
    }

    // Start with declared nodes
    const nodes = (model.nodes || [])
        .filter(n => !!n.id)
        .map((n: any) => ({ id: n.id, label: n.label || n.name || n.id, type: n.type, description: n.description, parent: parentMap.get(n.id), raw: n.raw }))

    // Ensure container nodes referenced by containment relationships exist as compound parents too
    const knownIds = new Set(nodes.map(n => String(n.id)))
    for (const containerId of parentMap.values()) {
        const id = String(containerId)
        if (!knownIds.has(id)) {
            nodes.push({ id, label: id, type: undefined, description: undefined, parent: parentMap.get(id), raw: { synthesized: true } })
            knownIds.add(id)
        }
    }

    const relEdges = (model.relationships || [])
        .filter((r: any) => !!r.source && !!r.target && r.type !== 'deployed-in' && r.type !== 'composed-of')
        .map((r: any) => ({ id: r.id || `${r.source}->${r.target}`, source: r.source, target: r.target, label: r.label, type: r.type, description: r.description, raw: r.raw }))
    const flowEdges = (model.flows || [])
        .filter(f => !!f.source && !!f.target)
        .map((f: any) => ({ id: f.id || `${f.source}->${f.target}`, source: f.source, target: f.target, label: f.label, type: 'flow', description: f.description, raw: f.raw }))
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
        label: n.label ?? n.name ?? (n['unique-id'] ?? n.id),
        description: n.description,
        raw: n
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
            if (src && dst) relationships!.push({ id: relId ?? `${src}->${dst}`, source: src, target: dst, label, type: 'connects', description: r.description, raw: r })
        } else if (rt && typeof rt === 'object' && rt.interacts) {
            const actor = rt.interacts?.actor
            const ns: string[] = Array.isArray(rt.interacts?.nodes) ? rt.interacts.nodes : []
            for (const n of ns) {
                // direction: actor -> node (interacts with)
                const id = relId ? `${relId}:${n}` : `${actor}->${n}`
                if (n && actor) relationships!.push({ id, source: actor, target: n, label: 'interacts', type: 'interacts', description: r.description, raw: r })
            }
        } else if (rt && typeof rt === 'object' && rt['deployed-in']) {
            const container = rt['deployed-in']?.container
            const ns: string[] = Array.isArray(rt['deployed-in']?.nodes) ? rt['deployed-in'].nodes : []
            for (const n of ns) {
                // direction: node -> container (deployed in)
                const id = relId ? `${relId}:${n}` : `${n}->${container}`
                if (n && container) relationships!.push({ id, source: n, target: container, label: 'deployed-in', type: 'deployed-in', description: r.description, raw: r })
            }
        } else if (rt && typeof rt === 'object' && rt['composed-of']) {
            const container = rt['composed-of']?.container
            const ns: string[] = Array.isArray(rt['composed-of']?.nodes) ? rt['composed-of'].nodes : []
            for (const n of ns) {
                // Treat composed-of the same as deployed-in for containment
                const id = relId ? `${relId}:${n}` : `${n}->${container}`
                if (n && container) relationships!.push({ id, source: n, target: container, label: 'composed-of', type: 'composed-of', description: r.description, raw: r })
            }
        } else if (r.source && r.target) {
            relationships!.push({ id: relId ?? `${r.source}->${r.target}`, source: r.source, target: r.target, label, type: typeof rt === 'string' ? rt : undefined, description: r.description, raw: r })
        }
    }

    const flows: any[] = Array.isArray(input.flows) ? input.flows : []
    const normFlows = flows.map(f => ({
        id: f['unique-id'] ?? f.id,
        source: f.source,
        target: f.target,
        label: f.label ?? f.name ?? f.description,
        description: f.description,
        raw: f
    })).filter(f => !!f.id)

    return { nodes, relationships, flows: normFlows }
}

export interface GraphData {
    nodes: ReadonlyArray<{ id: string; label: string; type?: string }>
    edges: ReadonlyArray<{ id: string; source: string; target: string; label?: string; type?: string }>
}

export type LastData = {
    graph: GraphData
    selectedId?: string
} | undefined
