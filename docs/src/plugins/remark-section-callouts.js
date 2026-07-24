/**
 * remark-section-callouts — build-time reading-experience layer for doc pages.
 *
 * Part of the docs redesign (#2873, phase 3). Content files under docs/docs
 * are never edited; this plugin rewrites the MDX AST at build time to:
 *
 *  1. Replace "well-known" section headings (Prerequisites, Learning
 *     Objectives, Next Steps, Tips, Resources, Key Concepts, …) with coloured
 *     callout cards that absorb the section body, so long tutorial pages read
 *     as scannable cards rather than a flat wall of text.
 *  2. Detect the tutorial difficulty line (`🟢 **Difficulty:** … | ⏱️
 *     **Time:** …`), remove it from the flow, and fold it into a meta chip.
 *  3. Inject a mono section kicker (Learn / Reference / Tools, derived from
 *     the doc's path) above the title, and a meta chips row (read time ·
 *     difficulty · edit link) directly below it.
 *
 * Wiring notes:
 *  - Registered ONLY on the main docs plugin — the 'talks' plugin is left
 *    untouched on purpose.
 *  - Must run via `beforeDefaultRemarkPlugins`: Docusaurus extracts heading
 *    anchors and the page TOC in its default remark plugins, so replacing the
 *    known headings before those run means they naturally disappear from
 *    "On this page" (matching the design prototype).
 *  - MDX partials (any path segment starting with `_`, e.g. the reveal.js
 *    slide fragments in tutorials/_calm-overview/) are compiled by the same
 *    loader when imported; they are skipped entirely.
 */

const EDIT_URL = 'https://github.com/finos/architecture-as-code/tree/main/docs';
const WORDS_PER_MINUTE = 220;

/** Normalised heading text -> [colour variant, icon, canonical label]. */
const KNOWN_SECTIONS = {
    'prerequisites': ['sky', '✓', 'Prerequisites'],
    'learning objectives': ['violet', '◎', 'Learning objectives'],
    'what youll learn': ['violet', '◎', 'What you’ll learn'],
    'next steps': ['blue', '→', 'Next steps'],
    'tips': ['green', '💡', 'Tips'],
    'tip': ['green', '💡', 'Tip'],
    'resources': ['slate', '🔗', 'Resources'],
    'key concepts': ['amber', '◆', 'Key concepts'],
    'skills youll acquire': ['violet', '◎', 'Skills you’ll acquire'],
};

/** Doc path (relative to docs/docs) -> navbar section the page belongs to. */
const SECTION_KICKERS = [
    [/^(tutorials|introduction)\//, 'Learn'],
    [/^core-concepts\//, 'Reference'],
    [/^(working-with-calm|calm-hub)\//, 'Tools'],
];

const text = (value) => ({type: 'text', value});

const attr = (name, value) => ({type: 'mdxJsxAttribute', name, value});

const jsxElement = (type, name, className, children, extraAttributes = []) => ({
    type,
    name,
    attributes: [attr('className', className), ...extraAttributes],
    children,
});

const jsxFlow = (name, className, children, extraAttributes) =>
    jsxElement('mdxJsxFlowElement', name, className, children, extraAttributes);

const jsxText = (name, className, children, extraAttributes) =>
    jsxElement('mdxJsxTextElement', name, className, children, extraAttributes);

/** Concatenated plain text of a node (headings, paragraphs, …). */
function nodeText(node) {
    if (typeof node.value === 'string') {
        return node.value;
    }
    return (node.children ?? []).map(nodeText).join('');
}

/** Mirrors the design prototype: lowercase, letters and spaces only. */
function normaliseHeading(headingText) {
    return headingText
        .toLowerCase()
        .replace(/[^a-z ]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Word count outside fenced code blocks, per the prototype's read-time formula. */
function countWords(node) {
    if (node.type === 'code' || node.type === 'yaml' || node.type === 'mdxjsEsm') {
        return 0;
    }
    let words = 0;
    if (typeof node.value === 'string') {
        words += node.value.match(/[A-Za-z0-9']+/g)?.length ?? 0;
    }
    for (const child of node.children ?? []) {
        words += countWords(child);
    }
    return words;
}

/**
 * Finds the tutorial difficulty paragraph (`🟢 **Difficulty:** Beginner |
 * ⏱️ **Time:** 15-20 minutes`), removes it from the tree, and returns a chip
 * label like "🟢 Beginner · 15-20 minutes" (or null when the page has none).
 */
function extractDifficulty(root) {
    for (let i = 0; i < root.children.length; i++) {
        const node = root.children[i];
        if (node.type !== 'paragraph') {
            continue;
        }
        const paragraphText = nodeText(node).replace(/\s+/g, ' ').trim();
        const match = paragraphText.match(/^(.{0,6}?)\s*Difficulty:\s*(.+?)\s*\|.*?Time:\s*(.+)$/);
        if (match) {
            root.children.splice(i, 1);
            const emoji = match[1].trim();
            return `${emoji ? `${emoji} ` : ''}${match[2].trim()} · ${match[3].trim()}`;
        }
    }
    return null;
}

/**
 * Replaces each known section heading (depth 2-4) with a coloured callout
 * card containing the section body — every following sibling up to the next
 * heading of the same or shallower depth.
 */
function wrapKnownSections(root) {
    const children = root.children;
    for (let i = 0; i < children.length; i++) {
        const node = children[i];
        if (node.type !== 'heading' || node.depth < 2 || node.depth > 4) {
            continue;
        }
        const spec = KNOWN_SECTIONS[normaliseHeading(nodeText(node))];
        if (!spec) {
            continue;
        }
        let end = i + 1;
        while (end < children.length && !(children[end].type === 'heading' && children[end].depth <= node.depth)) {
            end++;
        }
        const [variant, icon, label] = spec;
        const callout = jsxFlow('div', `calm-callout calm-callout--${variant}`, [
            jsxFlow('div', 'calm-callout__h', [
                jsxText('span', 'calm-callout__ic', [text(icon)]),
                text(label),
            ]),
            ...children.slice(i + 1, end),
        ]);
        children.splice(i, end - i, callout);
    }
}

function buildChipsRow({readTime, difficulty, sectionChip}) {
    const chips = [];
    if (sectionChip) {
        chips.push(jsxText('span', 'calm-dm calm-dm-sec', [text(sectionChip)]));
    }
    chips.push(jsxText('span', 'calm-dm', [text(`⏱ ${readTime} min read`)]));
    if (difficulty) {
        chips.push(jsxText('span', 'calm-dm calm-dm-diff', [text(difficulty)]));
    }
    chips.push(jsxText('a', 'calm-dm calm-dm-edit', [text('Edit on GitHub ↗')], [
        attr('href', EDIT_URL),
        attr('target', '_blank'),
        attr('rel', 'noopener noreferrer'),
    ]));
    return jsxFlow('div', 'calm-doc-meta', chips);
}

/** Path of the doc relative to its docs root, using forward slashes. */
function relativeDocPath(file) {
    const filePath = (file.path ?? '').split('\\').join('/');
    const marker = '/docs/';
    const index = filePath.lastIndexOf(marker);
    return index === -1 ? null : filePath.slice(index + marker.length);
}

export default function remarkSectionCallouts() {
    return (root, file) => {
        const docPath = relativeDocPath(file);
        // Skip MDX partials (_-prefixed) — they render inside other pages.
        if (!docPath || docPath.split('/').some((segment) => segment.startsWith('_'))) {
            return;
        }

        const difficulty = extractDifficulty(root);
        const readTime = Math.max(1, Math.round(countWords(root) / WORDS_PER_MINUTE));
        wrapKnownSections(root);

        const section = SECTION_KICKERS.find(([pattern]) => pattern.test(docPath))?.[1] ?? null;
        const h1Index = root.children.findIndex((node) => node.type === 'heading' && node.depth === 1);

        if (h1Index !== -1) {
            // Kicker above the title, chips row directly below it.
            const chipsRow = buildChipsRow({readTime, difficulty, sectionChip: null});
            if (section) {
                root.children.splice(h1Index, 0, jsxFlow('div', 'calm-doc-kicker', [text(section)]));
                root.children.splice(h1Index + 2, 0, chipsRow);
            } else {
                root.children.splice(h1Index + 1, 0, chipsRow);
            }
        } else {
            // No body H1: the theme renders the frontmatter title itself, so the
            // chips row goes at the top of the content, carrying the section as
            // a chip instead of a kicker (which would render below the title).
            const chipsRow = buildChipsRow({readTime, difficulty, sectionChip: section});
            let insertAt = 0;
            while (
                insertAt < root.children.length &&
                (root.children[insertAt].type === 'yaml' || root.children[insertAt].type === 'mdxjsEsm')
            ) {
                insertAt++;
            }
            root.children.splice(insertAt, 0, chipsRow);
        }
    };
}
