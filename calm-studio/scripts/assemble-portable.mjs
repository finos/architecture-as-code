// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0
//
// Refresh CalmStudio portable packages from the SvelteKit static build:
//   calm-studio/dist/CalmStudio-portable      (Windows, PowerShell)
//   calm-studio/dist/CalmStudio-portable-mac  (macOS, Python 3)
// Invoked by `npm run build` in @calmstudio/studio (cwd = apps/studio).

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const studioRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(studioRoot, '..');

/**
 * @param {string} cwd
 * @param {string[]} args
 */
function git(cwd, args) {
	try {
		return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
	} catch {
		return '';
	}
}

/**
 * @param {{
 *   buildDir: string,
 *   shellDir: string,
 *   outDir: string,
 *   iconPath: string,
 *   iconName?: string,
 *   extraIcons?: string[],
 *   zipPath?: string,
 *   unixZip?: boolean,
 *   channel?: string,
 *   notes?: string,
 *   normalizeLf?: boolean,
 *   repoRoot?: string,
 *   meta?: { built?: string, commit?: string, branch?: string }
 * }} options
 */
export function assemblePortable(options) {
	const { buildDir, shellDir, outDir, iconPath } = options;
	const iconName = options.iconName ?? 'CalmStudio.ico';
	const indexHtml = path.join(buildDir, 'index.html');
	if (!fs.existsSync(indexHtml)) {
		throw new Error(`Studio build is missing ${indexHtml}. Run the studio build first.`);
	}
	if (!fs.existsSync(shellDir)) {
		throw new Error(`Portable shell not found: ${shellDir}`);
	}
	if (!fs.existsSync(iconPath)) {
		throw new Error(`Icon not found: ${iconPath}`);
	}

	const gitRoot = options.repoRoot ?? repoRoot;
	const built = options.meta?.built ?? new Date().toISOString().slice(0, 10);
	const commit = options.meta?.commit ?? git(gitRoot, ['rev-parse', '--short', 'HEAD']);
	const branch = options.meta?.branch ?? git(gitRoot, ['rev-parse', '--abbrev-ref', 'HEAD']);

	fs.rmSync(outDir, { recursive: true, force: true });
	fs.cpSync(shellDir, outDir, { recursive: true });
	fs.cpSync(buildDir, path.join(outDir, 'app'), { recursive: true });
	fs.copyFileSync(iconPath, path.join(outDir, iconName));
	for (const rel of options.extraIcons ?? []) {
		const dest = path.join(outDir, rel);
		fs.mkdirSync(path.dirname(dest), { recursive: true });
		fs.copyFileSync(iconPath, dest);
	}
	if (options.normalizeLf) normalizeLineEndings(outDir);

	const channel = options.channel ?? 'portable-win';
	const notes = options.notes ?? 'Static SPA + PowerShell localhost server; no admin required';
	const version = [
		'product=CalmStudio',
		`channel=${channel}`,
		`built=${built}`,
		`commit=${commit}`,
		`branch=${branch}`,
		'port_default=17890',
		'source=architecture-as-code / calm-studio',
		`notes=${notes}`,
		'',
	].join('\n');
	fs.writeFileSync(path.join(outDir, 'VERSION.txt'), version, 'utf8');

	if (options.zipPath) {
		if (options.unixZip) writeUnixZip(outDir, options.zipPath);
		else writeZip(outDir, options.zipPath);
	}

	return { outDir, zipPath: options.zipPath, built, commit, branch };
}

/**
 * @param {string} outDir
 * @param {string} zipPath
 */
function writeZip(outDir, zipPath) {
	fs.mkdirSync(path.dirname(zipPath), { recursive: true });
	if (fs.existsSync(zipPath)) fs.rmSync(zipPath);

	if (process.platform === 'win32') {
		execFileSync(
			'powershell.exe',
			[
				'-NoProfile',
				'-Command',
				'Compress-Archive -LiteralPath $env:CALM_PORTABLE_DIR -DestinationPath $env:CALM_PORTABLE_ZIP -Force',
			],
			{
				env: {
					...process.env,
					CALM_PORTABLE_DIR: outDir,
					CALM_PORTABLE_ZIP: zipPath,
				},
				stdio: 'inherit',
			}
		);
		return;
	}

	try {
		execFileSync('zip', ['-r', '-q', zipPath, path.basename(outDir)], {
			cwd: path.dirname(outDir),
			stdio: 'inherit',
		});
	} catch (error) {
		const err = /** @type {NodeJS.ErrnoException} */ (error);
		if (err.code === 'ENOENT') {
			console.log('zip is not installed; portable folder written without an archive');
			return;
		}
		throw error;
	}
}

/**
 * Shell scripts edited on Windows must ship with LF so macOS accepts the shebang.
 * Skips the copied SPA under app/.
 * @param {string} dir
 */
function normalizeLineEndings(dir) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		if (entry.name === 'app') continue;
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			normalizeLineEndings(full);
			continue;
		}
		if (!shouldNormalize(full)) continue;
		const text = fs.readFileSync(full, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
		fs.writeFileSync(full, text);
	}
}

/**
 * @param {string} filePath
 */
function shouldNormalize(filePath) {
	const ext = path.extname(filePath).toLowerCase();
	if (['.command', '.sh', '.py', '.plist', '.md'].includes(ext)) return true;
	return path.basename(path.dirname(filePath)) === 'MacOS';
}

/**
 * Zip that stores Unix permissions so .command / .app launchers stay executable
 * after unzip on macOS. Compress-Archive on Windows does not keep those bits.
 * @param {string} outDir
 * @param {string} zipPath
 */
export function writeUnixZip(outDir, zipPath) {
	fs.mkdirSync(path.dirname(zipPath), { recursive: true });
	if (fs.existsSync(zipPath)) fs.rmSync(zipPath);

	/** @type {{ name: string, data: Buffer, mode: number }[]} */
	const files = [];
	const prefix = path.basename(outDir);
	collectFiles(outDir, prefix, files);

	/** @type {Buffer[]} */
	const locals = [];
	/** @type {Buffer[]} */
	const centrals = [];
	let offset = 0;
	for (const file of files) {
		const name = Buffer.from(file.name, 'utf8');
		const compressed = zlib.deflateRawSync(file.data);
		const crc = zlib.crc32(file.data) >>> 0;
		const local = Buffer.alloc(30);
		local.writeUInt32LE(0x04034b50, 0);
		local.writeUInt16LE(20, 4);
		local.writeUInt16LE(0x0800, 6);
		local.writeUInt16LE(8, 8);
		local.writeUInt32LE(crc, 14);
		local.writeUInt32LE(compressed.length, 18);
		local.writeUInt32LE(file.data.length, 22);
		local.writeUInt16LE(name.length, 26);
		const localRecord = Buffer.concat([local, name, compressed]);

		const central = Buffer.alloc(46);
		central.writeUInt32LE(0x02014b50, 0);
		central.writeUInt16LE(0x0314, 4);
		central.writeUInt16LE(20, 6);
		central.writeUInt16LE(0x0800, 8);
		central.writeUInt16LE(8, 10);
		central.writeUInt32LE(crc, 16);
		central.writeUInt32LE(compressed.length, 20);
		central.writeUInt32LE(file.data.length, 24);
		central.writeUInt16LE(name.length, 28);
		central.writeUInt32LE((file.mode << 16) >>> 0, 38);
		central.writeUInt32LE(offset, 42);
		centrals.push(Buffer.concat([central, name]));
		locals.push(localRecord);
		offset += localRecord.length;
	}

	const centralDir = Buffer.concat(centrals);
	const end = Buffer.alloc(22);
	end.writeUInt32LE(0x06054b50, 0);
	end.writeUInt16LE(files.length, 8);
	end.writeUInt16LE(files.length, 10);
	end.writeUInt32LE(centralDir.length, 12);
	end.writeUInt32LE(offset, 16);
	fs.writeFileSync(zipPath, Buffer.concat([...locals, centralDir, end]));
}

/**
 * @param {string} dir
 * @param {string} prefix
 * @param {{ name: string, data: Buffer, mode: number }[]} files
 */
function collectFiles(dir, prefix, files) {
	for (const name of fs.readdirSync(dir).sort()) {
		const abs = path.join(dir, name);
		const rel = `${prefix}/${name}`;
		const stat = fs.statSync(abs);
		if (stat.isDirectory()) collectFiles(abs, rel, files);
		else files.push({ name: rel, data: fs.readFileSync(abs), mode: unixMode(rel) });
	}
}

/**
 * @param {string} rel
 */
function unixMode(rel) {
	const base = path.posix.basename(rel);
	const ext = path.posix.extname(base);
	const parent = path.posix.basename(path.posix.dirname(rel));
	if (ext === '.command' || ext === '.sh' || parent === 'MacOS') return 0o100755;
	return 0o100644;
}

function isDirectRun() {
	const entry = process.argv[1];
	if (!entry) return false;
	return import.meta.url === pathToFileURL(path.resolve(entry)).href;
}

/**
 * @param {{ outDir: string, zipPath?: string }} result
 * @param {string} label
 */
function logPackage(result, label) {
	console.log(`CalmStudio ${label}: ${result.outDir}`);
	if (result.zipPath && fs.existsSync(result.zipPath)) {
		console.log(`Archive: ${result.zipPath}`);
	}
}

if (isDirectRun()) {
	const buildDir = path.join(studioRoot, 'apps', 'studio', 'build');
	const icons = path.join(studioRoot, 'apps', 'studio', 'src-tauri', 'icons');
	const win = assemblePortable({
		buildDir,
		shellDir: path.join(scriptDir, 'portable'),
		outDir: path.join(studioRoot, 'dist', 'CalmStudio-portable'),
		iconPath: path.join(icons, 'icon.ico'),
		zipPath: path.join(studioRoot, 'dist', 'CalmStudio-portable-win.zip'),
		repoRoot,
	});
	const mac = assemblePortable({
		buildDir,
		shellDir: path.join(scriptDir, 'portable-mac'),
		outDir: path.join(studioRoot, 'dist', 'CalmStudio-portable-mac'),
		iconPath: path.join(icons, 'icon.icns'),
		iconName: 'CalmStudio.icns',
		extraIcons: ['CalmStudio.app/Contents/Resources/CalmStudio.icns'],
		zipPath: path.join(studioRoot, 'dist', 'CalmStudio-portable-mac.zip'),
		unixZip: true,
		channel: 'portable-mac',
		notes: 'Static SPA + Python localhost server; no admin required',
		normalizeLf: true,
		repoRoot,
	});
	logPackage(win, 'portable (Windows)');
	logPackage(mac, 'portable (macOS)');
}
