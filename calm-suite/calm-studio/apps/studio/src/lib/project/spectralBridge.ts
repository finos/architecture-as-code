// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Spectral bridge for project rulesets (R25 / #19).
 * Core CALM validation stays always-on in validation.svelte.ts.
 *
 * Supports JSON Spectral rulesets; YAML is parsed when the `yaml` package is available.
 * Missing ruleset files produce a warning issue (non-blocking).
 *
 * JSON/YAML rulesets reference built-in functions by name (`truthy`, `enumeration`, …).
 * Programmatic Spectral requires those functions to be resolved to callables — the CLI
 * does this automatically; we hydrate them from `@stoplight/spectral-functions`.
 */

import type { ValidationIssue } from '@calmstudio/calm-core';
import type { CalmArchitecture } from '@calmstudio/calm-core';
import type { CalmProjectConfig } from './types';
import { readProjectRelativeText } from './projectFs';

export type SpectralLintResult = {
	severity?: number | string;
	message: string;
	path?: unknown;
	code?: string;
};

function severityFromSpectral(s: number | string | undefined): ValidationIssue['severity'] {
	// Spectral: 0=error, 1=warn, 2=info, 3=hint
	if (s === 0 || s === 'error') return 'error';
	if (s === 1 || s === 'warn' || s === 'warning') return 'warning';
	return 'info';
}

async function parseRulesetDocument(text: string, path: string): Promise<unknown> {
	const trimmed = text.trim();
	if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
		return JSON.parse(trimmed);
	}
	try {
		const yaml = await import('yaml');
		return yaml.parse(trimmed);
	} catch {
		throw new Error(
			`Ruleset "${path}" is not JSON and YAML parser is unavailable. Convert to JSON or install yaml.`
		);
	}
}

type SpectralBuiltinFns = Record<string, unknown>;

async function loadBuiltinFunctions(): Promise<SpectralBuiltinFns> {
	const mod = await import('@stoplight/spectral-functions');
	return mod as unknown as SpectralBuiltinFns;
}

function resolveThen(
	then: unknown,
	fns: SpectralBuiltinFns
): unknown {
	if (Array.isArray(then)) {
		return then.map((t) => resolveThen(t, fns));
	}
	if (!then || typeof then !== 'object') return then;
	const t = then as { function?: unknown; [key: string]: unknown };
	if (typeof t.function === 'string') {
		const resolved = fns[t.function];
		if (!resolved) {
			throw new Error(`Unknown Spectral function "${t.function}"`);
		}
		return { ...t, function: resolved };
	}
	return then;
}

/**
 * Convert a JSON/YAML Spectral ruleset (string function names) into a definition
 * Spectral can run programmatically.
 */
export async function hydrateSpectralRuleset(raw: unknown): Promise<unknown> {
	if (!raw || typeof raw !== 'object') {
		throw new Error('Ruleset must be an object');
	}
	const doc = raw as { rules?: Record<string, { then?: unknown; [key: string]: unknown }> };
	if (!doc.rules || typeof doc.rules !== 'object') {
		throw new Error('Ruleset must contain a "rules" object');
	}
	const fns = await loadBuiltinFunctions();
	const rules: Record<string, unknown> = {};
	for (const [id, rule] of Object.entries(doc.rules)) {
		rules[id] = {
			...rule,
			then: resolveThen(rule.then, fns),
		};
	}
	return { ...doc, rules };
}

/**
 * Lint a document with a Spectral ruleset (JSON object with string function names OK).
 */
export async function runSpectralLint(
	document: unknown,
	rulesetRaw: unknown
): Promise<SpectralLintResult[]> {
	const mod = await import('@stoplight/spectral-core');
	const SpectralCtor = mod.Spectral as new () => {
		setRuleset: (r: unknown) => void;
		run: (input: unknown) => Promise<SpectralLintResult[]>;
	};
	const hydrated = await hydrateSpectralRuleset(rulesetRaw);
	const spectral = new SpectralCtor();
	spectral.setRuleset(hydrated);
	return spectral.run(document);
}

/**
 * Run enabled Spectral rulesets from project config against the architecture document.
 */
export async function runProjectSpectralRules(
	architecture: CalmArchitecture,
	projectConfig: CalmProjectConfig | null,
	rootHandle: FileSystemDirectoryHandle | null
): Promise<ValidationIssue[]> {
	if (!projectConfig || !rootHandle) return [];

	const enabled = projectConfig.validation.rulesets.filter((r) => r.enabled);
	if (enabled.length === 0) return [];

	const issues: ValidationIssue[] = [];

	try {
		await import('@stoplight/spectral-core');
		await import('@stoplight/spectral-functions');
	} catch {
		issues.push({
			severity: 'warning',
			message:
				'Project Spectral rulesets are enabled but @stoplight/spectral-core (or spectral-functions) is not available in this build.',
			path: 'validation.rulesets',
		});
		return issues;
	}

	const document = JSON.parse(JSON.stringify(architecture)) as unknown;

	for (const entry of enabled) {
		let rulesetRaw: unknown;
		try {
			const text = await readProjectRelativeText(rootHandle, entry.path);
			rulesetRaw = await parseRulesetDocument(text, entry.path);
		} catch (e) {
			issues.push({
				severity: 'warning',
				message: `Ruleset missing or unreadable: ${entry.path} (${(e as Error).message})`,
				path: entry.path,
			});
			continue;
		}

		try {
			const results = await runSpectralLint(document, rulesetRaw);
			for (const r of results) {
				issues.push({
					severity: severityFromSpectral(r.severity),
					message: `[${entry.path}] ${r.code ? `${r.code}: ` : ''}${r.message}`,
					path:
						typeof r.path === 'string'
							? r.path
							: Array.isArray(r.path)
								? r.path.join('.')
								: entry.path,
				});
			}
		} catch (e) {
			issues.push({
				severity: 'warning',
				message: `Failed to run ruleset ${entry.path}: ${(e as Error).message}`,
				path: entry.path,
			});
		}
	}

	return issues;
}
