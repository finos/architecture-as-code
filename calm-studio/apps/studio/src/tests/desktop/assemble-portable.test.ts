// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const assemblerUrl = pathToFileURL(
	path.resolve(here, '../../../../../scripts/assemble-portable.mjs')
).href;

const { assemblePortable } = (await import(assemblerUrl)) as {
	assemblePortable: (options: {
		buildDir: string;
		shellDir: string;
		outDir: string;
		iconPath: string;
		iconName?: string;
		extraIcons?: string[];
		zipPath?: string;
		unixZip?: boolean;
		channel?: string;
		notes?: string;
		normalizeLf?: boolean;
		meta?: { built?: string; commit?: string; branch?: string };
	}) => { outDir: string };
};

const temps: string[] = [];

function tempDir(): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'calm-portable-'));
	temps.push(dir);
	return dir;
}

afterEach(() => {
	for (const dir of temps.splice(0)) {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

describe('assemblePortable', () => {
	it('copies the static build and shell into the portable folder', () => {
		const root = tempDir();
		const buildDir = path.join(root, 'build');
		const shellDir = path.join(root, 'shell');
		const outDir = path.join(root, 'CalmStudio-portable');
		const iconPath = path.join(root, 'icon.ico');
		fs.mkdirSync(path.join(buildDir, 'demos'), { recursive: true });
		fs.writeFileSync(path.join(buildDir, 'index.html'), '<html>studio</html>');
		fs.writeFileSync(path.join(buildDir, 'demos', 'sample.calm.json'), '{}');
		fs.mkdirSync(path.join(shellDir, 'scripts'), { recursive: true });
		fs.writeFileSync(path.join(shellDir, 'Start-CalmStudio.cmd'), '@echo off\n');
		fs.writeFileSync(path.join(shellDir, 'scripts', 'serve-spa.ps1'), '# server\n');
		fs.writeFileSync(iconPath, 'ico');

		assemblePortable({
			buildDir,
			shellDir,
			outDir,
			iconPath,
			meta: { built: '2026-10-02', commit: 'abc1234', branch: 'test' },
		});

		expect(fs.readFileSync(path.join(outDir, 'app', 'index.html'), 'utf8')).toBe('<html>studio</html>');
		expect(fs.existsSync(path.join(outDir, 'app', 'demos', 'sample.calm.json'))).toBe(true);
		expect(fs.existsSync(path.join(outDir, 'Start-CalmStudio.cmd'))).toBe(true);
		expect(fs.existsSync(path.join(outDir, 'scripts', 'serve-spa.ps1'))).toBe(true);
		expect(fs.readFileSync(path.join(outDir, 'CalmStudio.ico'), 'utf8')).toBe('ico');
		const version = fs.readFileSync(path.join(outDir, 'VERSION.txt'), 'utf8');
		expect(version).toContain('built=2026-10-02');
		expect(version).toContain('commit=abc1234');
		expect(version).toContain('branch=test');
	});

	it('builds the macOS package with LF scripts and an executable zip entry', () => {
		const root = tempDir();
		const buildDir = path.join(root, 'build');
		const shellDir = path.join(root, 'shell');
		const outDir = path.join(root, 'CalmStudio-portable-mac');
		const iconPath = path.join(root, 'icon.icns');
		const zipPath = path.join(root, 'CalmStudio-portable-mac.zip');
		fs.mkdirSync(buildDir, { recursive: true });
		fs.writeFileSync(path.join(buildDir, 'index.html'), '<html>studio</html>');
		fs.mkdirSync(path.join(shellDir, 'CalmStudio.app', 'Contents', 'MacOS'), { recursive: true });
		fs.writeFileSync(path.join(shellDir, 'Start-CalmStudio.command'), '#!/bin/bash\r\necho hi\r\n');
		fs.writeFileSync(path.join(shellDir, 'CalmStudio.app', 'Contents', 'MacOS', 'CalmStudio'), '#!/bin/bash\r\n');
		fs.writeFileSync(iconPath, 'icns');

		assemblePortable({
			buildDir,
			shellDir,
			outDir,
			iconPath,
			iconName: 'CalmStudio.icns',
			extraIcons: ['CalmStudio.app/Contents/Resources/CalmStudio.icns'],
			zipPath,
			unixZip: true,
			channel: 'portable-mac',
			notes: 'Static SPA + Python localhost server; no admin required',
			normalizeLf: true,
			meta: { built: '2026-10-06', commit: 'abc1234', branch: 'test' },
		});

		const start = fs.readFileSync(path.join(outDir, 'Start-CalmStudio.command'), 'utf8');
		expect(start).toBe('#!/bin/bash\necho hi\n');
		expect(fs.readFileSync(path.join(outDir, 'CalmStudio.icns'), 'utf8')).toBe('icns');
		expect(fs.readFileSync(path.join(outDir, 'CalmStudio.app', 'Contents', 'Resources', 'CalmStudio.icns'), 'utf8')).toBe(
			'icns'
		);
		const version = fs.readFileSync(path.join(outDir, 'VERSION.txt'), 'utf8');
		expect(version).toContain('channel=portable-mac');
		expect(version).toContain('Python localhost server');

		const modes = zipUnixModes(fs.readFileSync(zipPath));
		expect(modes.get('CalmStudio-portable-mac/Start-CalmStudio.command')).toBe(0o100755);
		expect(modes.get('CalmStudio-portable-mac/CalmStudio.app/Contents/MacOS/CalmStudio')).toBe(0o100755);
		expect(modes.get('CalmStudio-portable-mac/app/index.html')).toBe(0o100644);
		expect(inflateZipEntry(fs.readFileSync(zipPath), 'CalmStudio-portable-mac/app/index.html').toString('utf8')).toBe(
			'<html>studio</html>'
		);
	});

	it('fails when the studio build has no index.html', () => {
		const root = tempDir();
		const buildDir = path.join(root, 'build');
		fs.mkdirSync(buildDir);
		expect(() =>
			assemblePortable({
				buildDir,
				shellDir: root,
				outDir: path.join(root, 'out'),
				iconPath: path.join(root, 'missing.ico'),
			})
		).toThrow(/index\.html/);
	});
});

function zipUnixModes(buf: Buffer): Map<string, number> {
	const modes = new Map<string, number>();
	const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
	const count = buf.readUInt16LE(eocd + 8);
	let offset = buf.readUInt32LE(eocd + 16);
	for (let i = 0; i < count; i++) {
		const nameLen = buf.readUInt16LE(offset + 28);
		const extraLen = buf.readUInt16LE(offset + 30);
		const commentLen = buf.readUInt16LE(offset + 32);
		const mode = buf.readUInt32LE(offset + 38) >>> 16;
		const name = buf.subarray(offset + 46, offset + 46 + nameLen).toString('utf8');
		modes.set(name, mode);
		offset += 46 + nameLen + extraLen + commentLen;
	}
	return modes;
}

function inflateZipEntry(buf: Buffer, name: string): Buffer {
	let offset = 0;
	while (offset + 30 < buf.length && buf.readUInt32LE(offset) === 0x04034b50) {
		const nameLen = buf.readUInt16LE(offset + 26);
		const extraLen = buf.readUInt16LE(offset + 28);
		const method = buf.readUInt16LE(offset + 8);
		const compSize = buf.readUInt32LE(offset + 18);
		const entryName = buf.subarray(offset + 30, offset + 30 + nameLen).toString('utf8');
		const dataStart = offset + 30 + nameLen + extraLen;
		const compressed = buf.subarray(dataStart, dataStart + compSize);
		if (entryName === name) {
			if (method !== 8) throw new Error(`unexpected method ${method}`);
			return zlib.inflateRawSync(compressed);
		}
		offset = dataStart + compSize;
	}
	throw new Error(`missing zip entry ${name}`);
}
