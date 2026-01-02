import { CalmModel } from "./model";

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
    getNodes() {
        return this.model.nodes || []
    }

    get nodes() {
        return (this.model.nodes || []).map(n => ({
            id: n.id,
            label: n.label || n.name || n.id,
            nodeType: n.type
        }))
    }
    get relationships() {
        const rels: any[] = Array.isArray(this.model.relationships) ? (this.model.relationships as any[]) : []
        const grouped = new Map<string, { id: string; label: string }>()
        for (const r of rels) {
            const raw = r.raw || {}
            const rt = raw['relationship-type'] ?? r.type
            const hasMultipleTargets = rt && typeof rt === 'object' && (rt['deployed-in'] || rt['composed-of'] || rt.interacts)
            const rawId = raw['unique-id'] ?? raw.id
            const groupId = (hasMultipleTargets && rawId) ? String(rawId) : String(r.id)
            if (grouped.has(groupId)) continue
            const label = (raw.label ?? raw.description ?? r.label ?? groupId) as string
            grouped.set(groupId, { id: groupId, label })
        }
        return Array.from(grouped.values())
    }
    get flows() { return (this.model.flows || []).map(f => ({ id: f.id, label: f.label || f.description || f.id })) }
}