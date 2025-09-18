import { LinesAndColumns } from 'lines-and-columns';

export type Seg = {
    full: string;
    body: string;
    start: number;
    end: number;
    line: number;
    column: number;
};

type SegmentDecision =
    | { kind: 'control'; seg: Seg }
    | { kind: 'leave'; seg: Seg; reason?: string }
    | { kind: 'rewrite'; seg: Seg; newText: string }
    | { kind: 'invalid'; seg: Seg; reason: string };


/**
 * # TemplatePreprocessor
 * ## Background & Design Decision
 *
 * This preprocessor exists because we want non-technical users to write intuitive template syntax
 * like `{{json-viewer nodes['load-balancer']}}` or `{{nodes['unique-id=="auth-service"'].name}}`,
 * even though Handlebars doesn't natively support bracket filtering or complex predicates in paths.
 *
 * See https://github.com/finos/architecture-as-code/issues/1556#issuecomment-3243213264
 *
 * ## High-level Approach
 * 1. **Segment discovery** – Regex scan for `{{ … }}`; each match is a `Seg`.
 * 2. **Tokenization** – Breaks `body` into identifiers, brackets, quoted strings, KVs,
 *    subexpressions, etc.
 * 3. **Interpretation** – Decide if it's a standalone path, helper call, block opener,
 *    control tag, reserved path, or subexpression.
 * 4. **Rewrite** – Only context paths get wrapped:
 *    - `{{foo.bar}}` → `{{convertFromDotNotation this "foo.bar"}}`
 *    - `{{#each items as |i|}}` → `{{#each (convertFromDotNotation this "items") as |i|}}`
 *    - `{{helper kv=1}}` → `{{helper this kv=1}}`
 *    - reserved, relative (`../`), subexpressions `(eq x y)` → left unchanged
 * 5. **Replacements** – Apply back into the template string from end → start.
 *
 * ## Why blocks vs non-blocks?
 * Handlebars blocks (`{{#each …}}…{{/each}}`) alter scope, may include block params (`as |…|`),
 * and have open/close/else sections. Only the *opener's* context path should be rewritten.
 * Non-blocks are simple value lookups or helper calls.
 *
 * ## Reserved / Special Cases
 * - Reserved: `this`, `.`, `true`, `false`, `null`, `undefined`, `lookup`, `@index`, `@root`, etc.
 * - Subexpressions: `(eq kind "Person")` are not rewritten.
 * - Relative paths: `../x`, `./y` are not rewritten.
 * - Control: `/each`, `! comment`, `> partial`, `else` are not rewritten.
 *
 * ## Error Handling
 * - Returns a `SegmentDecision` union for each segment:
 *   - `rewrite` → replaced with `newText`
 *   - `leave` → left unchanged, with a reason
 *   - `control` → block/control marker
 *   - `invalid` → malformed helper/path
 * - In the future a user would be able to build template and see live warnings/errors.
 *
 */
export class TemplatePreprocessor {
    private static readonly CONVERT_FN = 'convertFromDotNotation';

    /**
     * Scans template string for mustache segments `{{ ... }}` and extracts their positions.
     * Returns array of segments with body content, start/end indices, and line/column positions.
     */
    static findMustacheSegments(template: string): Seg[] {
        const out: Seg[] = [];
        const re = /{{\s*([^{}]+?)\s*}}/g;
        const lac = new LinesAndColumns(template);

        let m: RegExpExecArray | null;
        while ((m = re.exec(template)) !== null) {
            const start = m.index;
            const end = m.index + m[0].length;

            const loc = lac.locationForIndex(start) ?? { line: 0, column: 0 };

            out.push({
                full: m[0],
                body: m[1],
                start,
                end,
                line: loc.line + 1,     // 1-based if you prefer
                column: loc.column + 1,
            } as Seg & { line: number; column: number });
        }
        return out;
    }

    /**
     * Breaks mustache body text into semantic tokens like identifiers, paths, key-value pairs, and subexpressions.
     * Handles complex cases like bracket notation, quoted strings, and chained property access.
     */
    static tokenize(body: string): string[] {
        const s = body.trim();
        if (!s) return [];
        const IDENTIFIER = String.raw`@?[A-Za-z0-9_$-]+`;
        const DOUBLE_QUOTED = String.raw`"(?:[^"\\]|\\.)*"`;
        const SINGLE_QUOTED = String.raw`'(?:[^'\\]|\\.)*'`;
        const BRACKET_EXPR = String.raw`\[[^\]]*\]`;
        const PAREN_EXPR = String.raw`\([^)]*\)`;
        const PATH_SEGMENT = String.raw`(?:${IDENTIFIER}|${BRACKET_EXPR})`;
        const PATH_CHAIN = String.raw`${PATH_SEGMENT}(?:(?:\.${IDENTIFIER})|(?:\.${BRACKET_EXPR})|${BRACKET_EXPR})*`;
        const KEY_VALUE_PAIR = String.raw`${IDENTIFIER}\s*=\s*(?:${DOUBLE_QUOTED}|${SINGLE_QUOTED}|[^\s]+)`;

        const TOKEN_REGEX = new RegExp(
            `${KEY_VALUE_PAIR}|${PATH_CHAIN}|${PAREN_EXPR}|${DOUBLE_QUOTED}|${SINGLE_QUOTED}|\\S+`,
            'g'
        );

        const KV_NORMALIZE = new RegExp(
            `^(${IDENTIFIER})\\s*=\\s*(${DOUBLE_QUOTED}|${SINGLE_QUOTED}|[^\\s]+)$`
        );

        const tokens: string[] = [];
        for (const m of s.matchAll(TOKEN_REGEX)) {
            const raw = m[0];
            const kv = raw.match(KV_NORMALIZE);
            tokens.push(kv ? `${kv[1]}=${kv[2]}` : raw);
        }
        return tokens;
    }

    /**
     * Analyzes tokenized mustache content to determine if it's a standalone path, helper call, or has implied context.
     * Returns structured information about helper name, context path, extras, and path type classification.
     */
    static interpretTokens(tokens: string[]): {
        helper?: string;
        contextPath?: string;
        extras?: string;
        impliedThis: boolean;
        isStandalonePath: boolean;
    } {
        const isKV = (t: string) => /^@?[A-Za-z0-9_$-]+=/.test(t);
        if (tokens.length === 0) return { impliedThis: false, isStandalonePath: false };
        if (tokens.length === 1) {
            const singleToken = tokens[0];
            // Check if this is a known widget helper that needs implicit 'this'
            if (TemplatePreprocessor.isWidgetHelper(singleToken)) {
                return {
                    helper: singleToken,
                    contextPath: 'this',
                    impliedThis: true,
                    isStandalonePath: false
                };
            }
            return { contextPath: singleToken, impliedThis: false, isStandalonePath: true };
        }
        const [helper, second, ...rest] = tokens;
        if (isKV(second)) {
            return {
                helper,
                contextPath: 'this',
                extras: [second, ...rest].join(' '),
                impliedThis: true,
                isStandalonePath: false,
            };
        }
        if (tokens.length >= 2) {
            const extras = rest.length ? rest.join(' ') : undefined;
            return { helper, contextPath: second, extras, impliedThis: false, isStandalonePath: false };
        }
        return { impliedThis: false, isStandalonePath: false };
    }

    /**
     * Checks if a token is a known widget helper that requires implicit 'this' context.
     * Widget helpers are designed to work with architecture data and need the current context.
     */
    private static isWidgetHelper(token: string): boolean {
        const WIDGET_HELPERS = new Set([
            'block-architecture',
            'table',
            'list',
            'flow-sequence',
            'related-nodes',
            'json-viewer'
        ]);
        return WIDGET_HELPERS.has(token);
    }

    private static readonly RESERVED_PATHS = new Set<string>([
        'this',
        '.',
        'true',
        'false',
        'null',
        'undefined',
        'lookup',
        '@index',
        '@key',
        '@first',
        '@last',
        '@root',
    ]);

    private static readonly DOT_AFFINE_KEYS = new Set<string>(['filter', 'sort', 'limit']);

    /**
     * Separates extra tokens into key-value pairs and positional arguments.
     * Used to distinguish between helper parameters that need special handling vs simple arguments.
     */
    private static splitExtrasFromString(extras: string | undefined): { kvs: string[]; positionals: string[] } {
        if (!extras) return { kvs: [], positionals: [] };
        const tokens = TemplatePreprocessor.tokenize(extras);
        const kvs: string[] = [];
        const positionals: string[] = [];
        for (const t of tokens) {
            if (/^@?[A-Za-z0-9_$-]+=/.test(t)) kvs.push(t);
            else positionals.push(t);
        }
        return { kvs, positionals };
    }

    /**
     * Checks if extras contain dot-notation related hash parameters like filter, sort, or limit.
     * These parameters indicate the path needs convertFromDotNotation wrapping even for simple paths.
     */
    private static hasDotNotationHash(extras?: string): boolean {
        if (!extras) return false;
        const tokens = TemplatePreprocessor.tokenize(extras);
        for (const t of tokens) {
            const m = /^(@?[A-Za-z0-9_$-]+)=/.exec(t);
            if (m && TemplatePreprocessor.DOT_AFFINE_KEYS.has(m[1])) return true;
        }
        return false;
    }

    /**
     * Identifies Handlebars control structures like comments, partials, closers, and else blocks.
     * These segments should never be rewritten and are left unchanged.
     */
    private static isControlStructure(body: string): boolean {
        return /^else\b/i.test(body) || /^[/>!]/.test(body);
    }

    /**
     * Determines if a mustache segment is a block opener (starts with # or ^).
     * Block openers require special handling for context paths and block parameters.
     */
    private static isBlockOpener(body: string): boolean {
        return /^[#^]/.test(body);
    }

    /**
     * Extracts block parameters (e.g., "as |item|") from the end of block helper content.
     * Returns clean content without parameters and the extracted parameter string separately.
     */
    private static stripTrailingBlockParams(rest: string): { restNoParams: string; blockParams: string } {
        let blockParams = '';
        let restNoParams = rest;
        const bpMatch = rest.match(/\s+as\s+\|[^|]*\|\s*$/);
        if (bpMatch) {
            blockParams = bpMatch[0];
            restNoParams = rest.slice(0, -bpMatch[0].length).trim();
        }
        return { restNoParams, blockParams };
    }

    /**
     * Constructs rewritten block helper with convertFromDotNotation wrapper for the context path.
     * Preserves prefix (#/^), helper name, parameters, and block parameter syntax.
     */
    private static buildBlockRewrite(prefix: string, helper: string, safePath: string, kvsPart: string, posPart: string, blockParams: string): string {
        return `{{${prefix}${helper} (${TemplatePreprocessor.CONVERT_FN} this "${safePath}"${kvsPart})${posPart}${kvsPart}${blockParams}}}`;
    }

    /**
     * Creates convertFromDotNotation wrapper for standalone path expressions.
     * Transforms simple paths like {{foo.bar}} into {{convertFromDotNotation this "foo.bar"}}.
     */
    private static buildStandalonePathRewrite(safe: string): string {
        return `{{${TemplatePreprocessor.CONVERT_FN} this "${safe}"}}`;
    }

    /**
     * Adds explicit "this" context to helpers that have implied this (when second token is key-value).
     * Transforms {{helper key=value}} into {{helper this key=value}}.
     */
    private static buildImpliedThisHelperRewrite(helper: string, extras?: string): string {
        const extrasPart = extras ? ` ${extras}` : '';
        return `{{${helper} this${extrasPart}}}`;
    }

    /**
     * Constructs helper call with convertFromDotNotation wrapper for complex context paths.
     * Maintains helper name while wrapping the context path and preserving all parameters.
     */
    private static buildHelperRewrite(helper: string, safePath: string, kvsPart: string, posPart: string): string {
        return `{{${helper} (${TemplatePreprocessor.CONVERT_FN} this "${safePath}"${kvsPart})${posPart}${kvsPart}}}`;
    }

    /**
     * Checks if a path is reserved (like @index, true, null) but excludes "this" and ".".
     * Reserved paths should not be wrapped with convertFromDotNotation.
     */
    private static isReservedContextExceptThisOrDot(path: string): boolean {
        return TemplatePreprocessor.RESERVED_PATHS.has(path) && path !== 'this' && path !== '.';
    }

    /**
     * Determines if a token is a subexpression wrapped in parentheses.
     * Subexpressions like (eq a b) should not be rewritten as they have their own evaluation context.
     */
    private static isSubexpressionToken(t: string | undefined): boolean {
        if (!t) return false;
        const s = t.trim();
        return s.startsWith('(') && s.endsWith(')');
    }

    /**
     * Checks if a path uses relative navigation (../ or ./).
     * Relative paths should not be wrapped as they have special Handlebars scope semantics.
     */
    private static isRelativePath(p: string): boolean {
        const s = p.trim();
        return s.startsWith('../') || s.startsWith('./');
    }

    /**
     * Tests if a path uses only native Handlebars syntax (simple dots and literal segments).
     * Native paths don't need convertFromDotNotation unless they have special hash parameters.
     */
    private static isNativeHBPath(path: string): boolean {
        const p = path.trim();
        if (p === 'this' || p === '.') return true;
        const IDENT = String.raw`@?[A-Za-z0-9_$-]+`;
        const LIT_STR = String.raw`"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'`;
        const LIT_NUM = String.raw`\d+`;
        const LIT_SEG = String.raw`\[(?:${LIT_STR}|${LIT_NUM})\]`;
        const DOT_SEG = String.raw`\.(?:${IDENT}|${LIT_SEG})`;
        const RE = new RegExp(`^(?:${IDENT})(?:${DOT_SEG})*$`);
        return RE.test(p);
    }

    /**
     * Processes entire template to generate rewrite decisions for each mustache segment.
     * Returns array of decisions indicating whether each segment should be rewritten, left alone, or marked as control.
     */
    static analyzeTemplate(template: string): SegmentDecision[] {
        const segs = TemplatePreprocessor.findMustacheSegments(template);
        return segs.map(seg => TemplatePreprocessor.analyzeSegment(seg));
    }

    /**
     * Analyzes single mustache segment to determine appropriate preprocessing action.
     * Routes to specialized handlers for control structures, block openers, or regular expressions.
     */
    static analyzeSegment(seg: Seg): SegmentDecision {
        const body = seg.body.trim();

        if (TemplatePreprocessor.isControlStructure(body)) return { kind: 'control', seg };

        if (TemplatePreprocessor.isBlockOpener(body)) {
            return TemplatePreprocessor.analyzeBlockOpener(seg, body);
        }

        return TemplatePreprocessor.analyzeNonBlockExpression(seg, body);
    }

    /**
     * Evaluates whether a context path needs convertFromDotNotation wrapping based on syntax and parameters.
     * Returns either a leave decision with reason or prepared components for rewrite construction.
     */
    private static prepareRewriteContext(seg: Seg, path: string, extras?: string): { decision?: SegmentDecision; safePath?: string; kvsPart?: string; posPart?: string } {
        if (TemplatePreprocessor.isSubexpressionToken(path) || TemplatePreprocessor.isRelativePath(path)) {
            return { decision: { kind: 'leave', seg, reason: 'subexpression-or-relative' } };
        }
        if (TemplatePreprocessor.isReservedContextExceptThisOrDot(path)) {
            return { decision: { kind: 'leave', seg, reason: 'reserved-context' } };
        }
        if (path === 'this' || path === '.') {
            return { decision: { kind: 'leave', seg, reason: 'explicit-this' } };
        }

        const needsDotAccessor =
            !TemplatePreprocessor.isNativeHBPath(path) ||
            TemplatePreprocessor.hasDotNotationHash(extras);

        if (!needsDotAccessor) {
            return { decision: { kind: 'leave', seg, reason: 'native-handlebars-path' } };
        }

        const safePath = path.replace(/"/g, '\\"');
        const { kvs, positionals } = TemplatePreprocessor.splitExtrasFromString(extras);
        const kvsPart = kvs.length ? ` ${kvs.join(' ')}` : '';
        const posPart = positionals.length ? ` ${positionals.join(' ')}` : '';
        return { safePath, kvsPart, posPart };
    }

    /**
     * Handles analysis and potential rewriting of block opener expressions like {{#each items}}.
     * Extracts helper, context path, and parameters while preserving block syntax and parameters.
     */
    private static analyzeBlockOpener(seg: Seg, body: string): SegmentDecision {
        const prefix = body[0];
        const rest = body.slice(1).trim();
        const { restNoParams, blockParams } = TemplatePreprocessor.stripTrailingBlockParams(rest);
        const tokens = TemplatePreprocessor.tokenize(restNoParams);
        if (tokens.length === 0) return { kind: 'control', seg };

        const { helper, contextPath, extras } = TemplatePreprocessor.interpretTokens(tokens);
        if (!helper) return { kind: 'invalid', seg, reason: 'no-helper' };

        const path = (contextPath ?? 'this').trim();
        const prep = TemplatePreprocessor.prepareRewriteContext(seg, path, extras);
        if (prep.decision) return prep.decision;

        const safePath = prep.safePath!;
        const kvsPart = prep.kvsPart!;
        const posPart = prep.posPart!;
        const newText = TemplatePreprocessor.buildBlockRewrite(prefix, helper, safePath, kvsPart, posPart, blockParams);
        return { kind: 'rewrite', seg, newText };
    }

    /**
     * Processes non-block mustache expressions including standalone paths and helper calls.
     * Determines if rewriting is needed and constructs appropriate replacement text.
     */
    private static analyzeNonBlockExpression(seg: Seg, body: string): SegmentDecision {
        const tokens = TemplatePreprocessor.tokenize(body);
        if (tokens.length === 0) return { kind: 'leave', seg, reason: 'empty' };

        // Always use interpretTokens first to check for widget helpers
        const { helper, contextPath, extras, impliedThis } = TemplatePreprocessor.interpretTokens(tokens);

        if (tokens.length === 1) {
            // If it's a widget helper with implied this, handle it as such
            if (impliedThis && helper) {
                const newText = TemplatePreprocessor.buildImpliedThisHelperRewrite(helper, extras);
                return { kind: 'rewrite', seg, newText };
            }

            // Otherwise, handle as a standalone path
            const path = tokens[0].trim();
            const prepSingle = TemplatePreprocessor.prepareRewriteContext(seg, path, undefined);
            if (prepSingle.decision) {
                return prepSingle.decision;
            }
            const safe = prepSingle.safePath!;
            return { kind: 'rewrite', seg, newText: TemplatePreprocessor.buildStandalonePathRewrite(safe) };
        }

        if (!helper) return { kind: 'invalid', seg, reason: 'no-helper' };

        const path = (contextPath ?? 'this').trim();

        if (impliedThis) {
            const newText = TemplatePreprocessor.buildImpliedThisHelperRewrite(helper, extras);
            return { kind: 'rewrite', seg, newText };
        }

        const prep = TemplatePreprocessor.prepareRewriteContext(seg, path, extras);
        if (prep.decision) return prep.decision;

        const safePath = prep.safePath!;
        const kvsPart = prep.kvsPart!;
        const posPart = prep.posPart!;
        const newText = TemplatePreprocessor.buildHelperRewrite(helper, safePath, kvsPart, posPart);
        return { kind: 'rewrite', seg, newText };
    }

    /**
     * Type guard to filter segment decisions that require rewriting.
     * Used in preprocessing pipeline to identify segments that need text replacement.
     */
    private static isRewrite(d: SegmentDecision): d is Extract<SegmentDecision, { kind: 'rewrite' }> {
        return d.kind === 'rewrite';
    }

    /**
     * Main entry point that transforms template by applying all necessary rewrites.
     * Processes segments from right to left to maintain correct string indices during replacement.
     */
    static preprocessTemplate(template: string): string {
        const decisions = TemplatePreprocessor.analyzeTemplate(template);
        const replacements = decisions
            .filter(TemplatePreprocessor.isRewrite)
            .map(d => ({ start: d.seg.start, end: d.seg.end, newText: d.newText }))
            .sort((a, b) => b.start - a.start);

        let out = template;
        for (const r of replacements) {
            out = out.slice(0, r.start) + r.newText + out.slice(r.end);
        }
        return out;
    }
}
