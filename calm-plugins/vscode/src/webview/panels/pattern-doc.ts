import { buildArchitecturePattern } from '../../extension/services/pattern-export';

export { slugify as generateId } from './control-doc';

export function exportAsPattern(
    doc: Record<string, unknown>,
    patternName: string
): { json: string; fileName: string } {
    return buildArchitecturePattern(doc, patternName);
}
