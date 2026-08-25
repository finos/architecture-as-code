import { describe, it, expect } from 'vitest';
import { ipLiteralVersion } from './ip-literal';

describe('ipLiteralVersion', () => {
    it.each([
        ['127.0.0.1', 4], ['10.0.0.1', 4], ['192.168.1.1', 4], ['255.255.255.255', 4], ['0.0.0.0', 4],
        ['::1', 6], ['fe80::1', 6], ['fc00::', 6], ['2001:db8::ff00:42:8329', 6], ['::ffff:192.168.0.1', 6],
        ['localhost', 0], ['calm.finos.org', 0], ['256.1.1.1', 0], ['1.2.3', 0], ['1.2.3.4.5', 0],
        ['', 0], ['::g', 0], ['1234:5678', 0], ['1:2:3:4:5:6:7:8:9', 0], ['a::b::c', 0], ['::', 6],
    ])('classifies %s as %s', (host, expected) => {
        expect(ipLiteralVersion(host)).toBe(expected);
    });
});
