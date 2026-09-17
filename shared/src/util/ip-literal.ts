const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const IPV4_TAIL = /(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const HEXTET = /^[0-9a-f]{1,4}$/i;
// Node's net.isIP accepts a broad zone-id charset (interface names, numeric zone ids, etc.);
// confirmed against net.isIP('fe80::1%eth0'), ('::1%25'), ('fe80::1%'), ('fe80::1%eth0%x').
const ZONE_ID = /^[0-9a-zA-Z.:_-]+$/;

/**
 * Is `candidate` (with any `%zone` suffix already stripped) an IPv6 literal? Never true for an
 * IPv4-only string on its own — the IPv4-mapped-tail branch below only recognises the tail as
 * part of a `::`-style IPv6 address, not a bare dotted-quad.
 */
function isIPv6Literal(host: string): boolean {
    let candidate = host;
    const mapped = candidate.match(IPV4_TAIL);
    if (mapped && (mapped.index === 0 || candidate[(mapped.index ?? 0) - 1] === ':')) {
        // IPv4-mapped tail counts as two hextets. Must be immediately preceded by ':' (or start
        // the string) — otherwise the dotted-quad regex may have partial-matched into the middle
        // of a hextet (e.g. the "1.2.3.4" inside "a1.2.3.4"), which is not a real mapped tail.
        candidate = candidate.slice(0, mapped.index) + '0:0';
    }
    const parts = candidate.split('::');
    if (parts.length > 2) {
        return false;
    }
    const groups = (segment: string) => (segment === '' ? [] : segment.split(':'));
    const head = groups(parts[0]);
    const tail = parts.length === 2 ? groups(parts[1]) : [];
    if (![...head, ...tail].every((g) => HEXTET.test(g))) {
        return false;
    }
    const count = head.length + tail.length;
    if (parts.length === 2) {
        return count < 8;
    }
    return count === 8;
}

/**
 * Browser-safe replacement for Node's `net.isIP`: returns 4 for an IPv4 literal, 6 for an IPv6
 * literal, otherwise 0. Handles `::` compression, IPv4-mapped tails (`::ffff:1.2.3.4`), and IPv6
 * zone identifiers (`fe80::1%eth0`) — a zone id is only accepted when the part before `%`
 * classifies as IPv6 (an IPv4 address with a zone id, e.g. `1.2.3.4%eth0`, is not an IP literal).
 */
export function ipLiteralVersion(host: string): 0 | 4 | 6 {
    const zoneIndex = host.indexOf('%');
    if (zoneIndex !== -1) {
        const zone = host.slice(zoneIndex + 1);
        if (!ZONE_ID.test(zone)) {
            return 0;
        }
        return isIPv6Literal(host.slice(0, zoneIndex)) ? 6 : 0;
    }
    if (IPV4.test(host)) {
        return 4;
    }
    if (!host.includes(':')) {
        return 0;
    }
    return isIPv6Literal(host) ? 6 : 0;
}
