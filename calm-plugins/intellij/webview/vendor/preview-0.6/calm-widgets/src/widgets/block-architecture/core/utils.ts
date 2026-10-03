import {CalmNodeCanonicalModel, CalmNodeInterfaceCanonicalModel} from '@finos/calm-models/canonical';

/**
 * Convert an identifier (e.g. "my_service-id") into a human-friendly label. Useful for rendering node names when an explicit label is not provided.
 */
export const prettyLabel = (id: string) =>
    (id || '')
        .replace(new RegExp(String.raw`[_\-]+`, 'g'), ' ')
        .replace(new RegExp(String.raw`\s+`, 'g'), ' ')
        .trim()
        .replace(new RegExp(String.raw`\b\w`, 'g'), c => c.toUpperCase());

/**
 * Resolve a display label for a node.Replaces any character that is not a word char, hyphen, colon or dot with an underscore.
 * This keeps IDs safe for use in HTML attributes and CSS selectors while preserving
 * common separator characters.
 */
export const sanitizeId = (s: string) => s.replace(new RegExp(String.raw`[^\w\-:.]`, 'g'), '_');

/**
 * Sanitize an identifier for safe use in Mermaid diagrams.
 * Replaces special characters and prefixes reserved words to avoid conflicts.
 * Checks if any reserved word appears as a word boundary within the ID.
 * 
 * Note: Implementation is in widget-helpers.ts as it's also used as a Handlebars helper.
 * This re-export provides a TypeScript-friendly interface for programmatic use.
 */
export const mermaidId = (s: string): string => {
    if (!s) return 'node_empty';

    // Sanitize: replace non-word chars (except hyphen, colon, dot) with underscore
    const sanitized = sanitizeId(s);

    // Mermaid reserved words that need prefixing
    const reservedWords = ['graph', 'subgraph', 'end', 'click', 'call', 'class', 'classDef',
        'style', 'linkStyle', 'direction', 'TB', 'BT', 'RL', 'LR', 'TD', 'BR'];

    // Check if any reserved word appears as a complete word in the ID
    for (const reserved of reservedWords) {
        // Create regex to match the reserved word at word boundaries
        const pattern = new RegExp(
            `(^|[-_.:])${reserved.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[-_.:])`,
            'i'
        );

        if (pattern.test(sanitized)) {
            return `node_${sanitized}`;
        }
    }

    return sanitized;
};

/**
 * Build a unique id for a node-interface pair. Combines the node id and interface key using a stable separator and sanitizes
 * the interface key portion so the resulting id is safe for use in DOM/keys.
 */
export const ifaceId = (nodeId: string, ifaceKey: string) => `${nodeId}__iface__${sanitizeId(ifaceKey)}`;

/**
 * Pick the first interface key from a CalmNodeInterfaceCanonicalModel. The canonical model may list interfaces as an array; this helper returns the
 * first entry or undefined if none exist. This is a convenience helper for simple UI flows where only the primary interface is required to render connects relationships.
 */
export const pickIface = (ni: CalmNodeInterfaceCanonicalModel): string | undefined =>
    ni.interfaces?.[0];

type WithOptionalLabel = CalmNodeCanonicalModel & { label?: string };

/** Resolve a display label for a node, falling back to name, unique-id, or a prettified version of the provided id.
 */
export const labelFor = (n?: WithOptionalLabel, id?: string) =>
    n?.name || n?.label || n?.['unique-id'] || (id ? prettyLabel(id) : '');