// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * zip.test.ts — Round-trip tests for the STORE-mode ZIP writer. Parses the
 * emitted archive back (local headers + EOCD) and compares to the inputs,
 * confirming it's a structurally valid, readable ZIP.
 */

import { describe, it, expect } from 'vitest';
import { buildZip } from '$lib/io/zip';

/** Independent CRC-32 (different implementation than the writer's) for cross-check. */
function crc32(bytes: Uint8Array): number {
	const table: number[] = [];
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		table[n] = c >>> 0;
	}
	let crc = 0xffffffff;
	for (let i = 0; i < bytes.length; i++) crc = table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
	return (crc ^ 0xffffffff) >>> 0;
}

/** Minimal STORE-mode reader: walk local file headers and pull names + data. */
function readStoreZip(bytes: Uint8Array): { name: string; content: string }[] {
	const view = new DataView(bytes.buffer);
	const dec = new TextDecoder();
	const out: { name: string; content: string }[] = [];
	let p = 0;
	while (p + 4 <= bytes.length && view.getUint32(p, true) === 0x04034b50) {
		const method = view.getUint16(p + 8, true);
		expect(method).toBe(0); // store
		const size = view.getUint32(p + 18, true);
		const nameLen = view.getUint16(p + 26, true);
		const extraLen = view.getUint16(p + 28, true);
		const nameStart = p + 30;
		const dataStart = nameStart + nameLen + extraLen;
		const name = dec.decode(bytes.subarray(nameStart, nameStart + nameLen));
		const content = dec.decode(bytes.subarray(dataStart, dataStart + size));
		out.push({ name, content });
		p = dataStart + size;
	}
	return out;
}

describe('buildZip', () => {
	it('emits a valid store-mode archive that round-trips', () => {
		const entries = [
			{ name: 'a.json', content: '{"hello":"world"}' },
			{ name: 'b.decorators.json', content: '{"decorators":[]}' },
		];
		const zip = buildZip(entries);

		// Local file header magic at the start, EOCD magic present.
		expect(zip[0]).toBe(0x50); // 'P'
		expect(zip[1]).toBe(0x4b); // 'K'
		const dv = new DataView(zip.buffer);
		// EOCD is the last 22 bytes; check its signature + entry count.
		const eocd = zip.length - 22;
		expect(dv.getUint32(eocd, true)).toBe(0x06054b50);
		expect(dv.getUint16(eocd + 10, true)).toBe(2); // total entries

		expect(readStoreZip(zip)).toEqual(entries);
	});

	it('handles an empty archive', () => {
		const zip = buildZip([]);
		const dv = new DataView(zip.buffer);
		expect(dv.getUint32(0, true)).toBe(0x06054b50); // straight to EOCD
		expect(readStoreZip(zip)).toEqual([]);
	});

	it('preserves UTF-8 content bytes', () => {
		const entries = [{ name: 'u.json', content: '{"n":"café ☕"}' }];
		expect(readStoreZip(buildZip(entries))).toEqual(entries);
	});

	it('sets the UTF-8 general-purpose flag (bit 11) in the local header', () => {
		const zip = buildZip([{ name: 'a.json', content: '{}' }]);
		const dv = new DataView(zip.buffer);
		expect(dv.getUint16(6, true) & 0x0800).toBe(0x0800);
	});

	it('writes a CRC-32 that matches an independent implementation', () => {
		const content = '{"hello":"world","n":42}';
		const zip = buildZip([{ name: 'a.json', content }]);
		const dv = new DataView(zip.buffer);
		const storedCrc = dv.getUint32(14, true); // local header CRC field
		expect(storedCrc).toBe(crc32(new TextEncoder().encode(content)));
	});

	it('central directory entry count and content match the local entries', () => {
		const entries = [
			{ name: 'a.json', content: '{"a":1}' },
			{ name: 'b.decorators.json', content: '{"decorators":[]}' },
		];
		const zip = buildZip(entries);
		const dv = new DataView(zip.buffer);
		// Find EOCD (last 22 bytes), read central-dir offset + count, walk it.
		const eocd = zip.length - 22;
		const count = dv.getUint16(eocd + 10, true);
		let p = dv.getUint32(eocd + 16, true);
		const names: string[] = [];
		const dec = new TextDecoder();
		for (let i = 0; i < count; i++) {
			expect(dv.getUint32(p, true)).toBe(0x02014b50); // central dir signature
			const nameLen = dv.getUint16(p + 28, true);
			names.push(dec.decode(zip.subarray(p + 46, p + 46 + nameLen)));
			p += 46 + nameLen; // no extra/comment fields
		}
		expect(names).toEqual(entries.map((e) => e.name));
	});
});
