// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * zip.ts — Minimal STORE-mode (uncompressed) ZIP writer.
 *
 * Used to bundle a design (an architecture + its `*.decorators.json` /
 * `*.calmstudio.json` sidecars) into a single downloadable `.zip`. The files
 * are small JSON, so compression isn't worth a third-party dependency — and
 * avoiding one keeps the monorepo lockfile untouched. Output is a valid ZIP
 * readable by any archiver.
 *
 * Format: one local-file-header + data per entry, a central directory, then the
 * end-of-central-directory record (PKZIP APPNOTE, store method 0, no Zip64).
 */

export interface ZipEntry {
	name: string;
	/** UTF-8 text content (our entries are always JSON). */
	content: string;
}

/** CRC-32 (IEEE 802.3 polynomial) over the bytes — required by the ZIP format. */
function crc32(bytes: Uint8Array): number {
	let crc = ~0;
	for (let i = 0; i < bytes.length; i++) {
		crc ^= bytes[i];
		for (let j = 0; j < 8; j++) {
			crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
		}
	}
	return (~crc) >>> 0;
}

/** Build a STORE-mode ZIP archive from text entries. Returns the raw bytes. */
export function buildZip(entries: ZipEntry[]): Uint8Array {
	const enc = new TextEncoder();
	// Fixed DOS timestamp (1980-01-01 00:00:00) keeps output deterministic.
	const DOS_TIME = 0;
	const DOS_DATE = 0x21; // day=1, month=1, year=0 (1980)
	// General-purpose bit 11: filenames/content are UTF-8 (so archivers decode
	// non-ASCII names correctly).
	const FLAGS = 0x0800;

	const locals: Uint8Array[] = [];
	const centrals: Uint8Array[] = [];
	let offset = 0;

	for (const entry of entries) {
		const nameBytes = enc.encode(entry.name);
		const data = enc.encode(entry.content);
		const crc = crc32(data);
		const size = data.length;

		const local = new Uint8Array(30 + nameBytes.length);
		const lv = new DataView(local.buffer);
		lv.setUint32(0, 0x04034b50, true); // local file header signature
		lv.setUint16(4, 20, true); // version needed
		lv.setUint16(6, FLAGS, true); // flags (UTF-8)
		lv.setUint16(8, 0, true); // method = store
		lv.setUint16(10, DOS_TIME, true);
		lv.setUint16(12, DOS_DATE, true);
		lv.setUint32(14, crc, true);
		lv.setUint32(18, size, true); // compressed size
		lv.setUint32(22, size, true); // uncompressed size
		lv.setUint16(26, nameBytes.length, true);
		lv.setUint16(28, 0, true); // extra length
		local.set(nameBytes, 30);

		const central = new Uint8Array(46 + nameBytes.length);
		const cv = new DataView(central.buffer);
		cv.setUint32(0, 0x02014b50, true); // central directory header signature
		cv.setUint16(4, 20, true); // version made by
		cv.setUint16(6, 20, true); // version needed
		cv.setUint16(8, FLAGS, true); // flags (UTF-8)
		cv.setUint16(10, 0, true); // method = store
		cv.setUint16(12, DOS_TIME, true);
		cv.setUint16(14, DOS_DATE, true);
		cv.setUint32(16, crc, true);
		cv.setUint32(20, size, true);
		cv.setUint32(24, size, true);
		cv.setUint16(28, nameBytes.length, true);
		cv.setUint16(30, 0, true); // extra length
		cv.setUint16(32, 0, true); // comment length
		cv.setUint16(34, 0, true); // disk number start
		cv.setUint16(36, 0, true); // internal attrs
		cv.setUint32(38, 0, true); // external attrs
		cv.setUint32(42, offset, true); // local header offset
		central.set(nameBytes, 46);

		locals.push(local, data);
		centrals.push(central);
		offset += local.length + data.length;
	}

	const centralSize = centrals.reduce((n, c) => n + c.length, 0);
	const eocd = new Uint8Array(22);
	const ev = new DataView(eocd.buffer);
	ev.setUint32(0, 0x06054b50, true); // EOCD signature
	ev.setUint16(4, 0, true); // disk number
	ev.setUint16(6, 0, true); // central dir start disk
	ev.setUint16(8, entries.length, true); // entries on this disk
	ev.setUint16(10, entries.length, true); // total entries
	ev.setUint32(12, centralSize, true); // central dir size
	ev.setUint32(16, offset, true); // central dir offset
	ev.setUint16(20, 0, true); // comment length

	const parts = [...locals, ...centrals, eocd];
	const total = parts.reduce((n, p) => n + p.length, 0);
	const out = new Uint8Array(total);
	let pos = 0;
	for (const p of parts) {
		out.set(p, pos);
		pos += p.length;
	}
	return out;
}
