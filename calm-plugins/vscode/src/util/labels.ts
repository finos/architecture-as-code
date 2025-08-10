export function composeLabelWithDescription(label?: string, description?: string): string {
    const lbl = (label || '').trim()
    const desc = (description || '').trim()
    if (!lbl && desc) return desc
    if (desc && desc !== lbl && !lbl.includes(desc)) return `${lbl}${lbl ? ' — ' : ''}${desc}`
    return lbl
}
