const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const IPV4_TAIL = /(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const HEXTET = /^[0-9a-f]{1,4}$/i;

/**
 * Browser-safe replacement for Node's `net.isIP`: returns 4 for an IPv4 literal, 6 for an IPv6
 * literal, otherwise 0. Handles `::` compression and IPv4-mapped tails (`::ffff:1.2.3.4`).
 */
export function ipLiteralVersion(host: string): 0 | 4 | 6 {
    if (IPV4.test(host)) {
        return 4;
    }
    if (!host.includes(':')) {
        return 0;
    }
    let candidate = host;
    const mapped = candidate.match(IPV4_TAIL);
    if (mapped && candidate.lastIndexOf(':') < (mapped.index ?? 0)) {
        // IPv4-mapped tail counts as two hextets.
        candidate = candidate.slice(0, mapped.index) + '0:0';
    }
    const parts = candidate.split('::');
    if (parts.length > 2) {
        return 0;
    }
    const groups = (segment: string) => (segment === '' ? [] : segment.split(':'));
    const head = groups(parts[0]);
    const tail = parts.length === 2 ? groups(parts[1]) : [];
    if (![...head, ...tail].every((g) => HEXTET.test(g))) {
        return 0;
    }
    const count = head.length + tail.length;
    if (parts.length === 2) {
        return count < 8 ? 6 : 0;
    }
    return count === 8 ? 6 : 0;
}
