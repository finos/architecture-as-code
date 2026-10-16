// Colour syntax only. A CSS shorthand such as `background` also accepts `url(...)`, which
// would make every viewer's browser fetch whatever URL a document's metadata names.
const COLOR_SYNTAX = /^(#[0-9a-f]{3,8}|(rgb|hsl)a?\([^()]*\)|[a-z]+)$/i;

export function usableColor(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const color = value.trim();
    return COLOR_SYNTAX.test(color) ? color : undefined;
}
