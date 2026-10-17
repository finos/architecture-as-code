// Classification and parsing for the three control-reference formats plus the
// deterministic controls-map key derivation. Pure module — no VS Code or Node
// APIs. The three formats are, in classification order:
//   1. Canonical URL  https://{base}/calm/domains/{domain}/controls/{name}/requirement/versions/{version}
//   2. Hub CURIE       {domain}:controls:{name}[@{version}]  (unversioned in building blocks)
//   3. Local path      controls/....json (relative; `.requirement.json` is the convention)

export interface ControlCurieResult {
    domain: string;
    controlName: string;
    /** Undefined for an unversioned CURIE (the form used in building blocks). */
    version?: string;
}

// Hub version scheme — three numeric parts separated by dot or dash (VERSION_REGEX).
const VERSION_RE = /^(0|[1-9][0-9]*)[-.]?(0|[1-9][0-9]*)[-.]?(0|[1-9][0-9]*)$/;
// Control slug — lowercase kebab (CUSTOM_ID_REGEX).
const SLUG_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
// Domain — mixed-case alphanumeric with hyphens (DOMAIN_REGEX).
const DOMAIN_RE = /^[A-Za-z0-9-]+$/;

/** A canonical Hub control URL: absolute http(s) URL that targets `/calm/domains/`. */
export function isCanonicalControlUrl(ref: string): boolean {
    return /^https?:\/\//i.test(ref) && ref.includes('/calm/domains/');
}

/** A Hub control CURIE: contains `:controls:`. The `@version` suffix is optional (unversioned in building blocks). */
export function isControlCurie(ref: string): boolean {
    return ref.includes(':controls:') && !ref.includes('://');
}

/**
 * A local requirement path: any relative `*.json` with no scheme, no absolute
 * prefix, and no parent traversal. `.requirement.json` is the convention but any
 * `.json` is accepted.
 */
export function isLocalControlPath(ref: string): boolean {
    if (ref.includes('://')) return false;
    if (ref.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(ref)) return false;
    if (ref.includes('..')) return false;
    return /\.json$/.test(ref);
}

/** Parse a Hub CURIE `{domain}:controls:{name}[@{version}]`; `null` if not one. Version is optional. */
export function parseControlCurie(ref: string): ControlCurieResult | null {
    if (!isControlCurie(ref)) return null;
    const atIdx = ref.lastIndexOf('@');
    const version = atIdx === -1 ? undefined : ref.slice(atIdx + 1);
    const head = atIdx === -1 ? ref : ref.slice(0, atIdx);
    const parts = head.split(':');
    if (parts.length !== 3 || parts[1] !== 'controls') return null;
    const [domain, , controlName] = parts;
    if (!DOMAIN_RE.test(domain)) return null;
    if (!SLUG_RE.test(controlName)) return null;
    if (version !== undefined && !VERSION_RE.test(version)) return null;
    return { domain, controlName, version };
}

/** Build a control CURIE from parts. Omits the version when not given (building-block form). */
export function buildControlCurie(
    domain: string,
    controlName: string,
    version?: string
): string {
    return version
        ? `${domain}:controls:${controlName}@${version}`
        : `${domain}:controls:${controlName}`;
}

/** Return a control CURIE without its `@version` suffix. Non-CURIEs are returned unchanged. */
export function stripControlCurieVersion(ref: string): string {
    const parsed = parseControlCurie(ref);
    if (!parsed) return ref;
    return buildControlCurie(parsed.domain, parsed.controlName);
}

/**
 * Parse a canonical control URL into domain / control / version. Returns `null`
 * if the path does not match the expected control-requirement shape.
 */
export function parseCanonicalControlUrl(ref: string): ControlCurieResult | null {
    if (!isCanonicalControlUrl(ref)) return null;
    let url: URL;
    try {
        url = new URL(ref);
    } catch {
        return null;
    }
    if (url.search || url.hash) return null;
    const segs = url.pathname.split('/').filter((s) => s.length > 0);
    // .../calm/domains/{domain}/controls/{name}/requirement/versions/{version}
    const dIdx = segs.indexOf('domains');
    if (dIdx === -1) return null;
    const domain = decodeURIComponent(segs[dIdx + 1] ?? '');
    const controlsKw = segs[dIdx + 2];
    const controlName = decodeURIComponent(segs[dIdx + 3] ?? '');
    const requirementKw = segs[dIdx + 4];
    const versionsKw = segs[dIdx + 5];
    const version = decodeURIComponent(segs[dIdx + 6] ?? '');
    if (
        controlsKw !== 'controls' ||
        requirementKw !== 'requirement' ||
        versionsKw !== 'versions'
    ) {
        return null;
    }
    if (!DOMAIN_RE.test(domain) || !SLUG_RE.test(controlName)) return null;
    if (!VERSION_RE.test(version)) return null;
    return { domain, controlName, version };
}

/** True if `ref` is any of the three recognized control reference formats. */
export function isControlRef(ref: string): boolean {
    return (
        isCanonicalControlUrl(ref) ||
        isControlCurie(ref) ||
        isLocalControlPath(ref)
    );
}

/**
 * Derive a deterministic CALM controls-map key from a control reference. Keys
 * must match `^[a-zA-Z0-9-]+$` (no slashes), so path segments are joined with a
 * `--` separator. Hub slugs use single hyphens only, so `--` is unambiguous.
 *
 *  - Hub CURIE / canonical URL → `{domain}--{controlName}`
 *  - Local path → subdirectory segments (below `controls/`) + stem, joined `--`
 */
export function makeControlMapKey(ref: string): string {
    const hub = parseCanonicalControlUrl(ref) ?? parseControlCurie(ref);
    if (hub) return `${hub.domain}--${hub.controlName}`;

    // Local path — build the key from the full relative path to avoid collisions
    // between identical stems in different subdirectories.
    const normalized = ref.replace(/\\/g, '/');
    const stem = normalized
        .replace(/^.*\//, '')
        .replace(/(\.requirement)?\.json$/, '');
    const segments = normalized.split('/').filter((s) => s.length > 0);
    // Drop the leading `controls/` prefix and the filename itself.
    const start = segments[0] === 'controls' ? 1 : 0;
    const dirs = segments.slice(start, -1);
    const key = [...dirs, stem].join('--');
    return key.replace(/[^a-zA-Z0-9-]/g, '-');
}
