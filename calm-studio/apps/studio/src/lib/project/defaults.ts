// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import type { CalmProjectConfig } from './types';

/** Bundled default profile inspired by CEngineering naming conventions (R26 / #20). */
export const CENGINEERING_ARCHIMATE_PROFILE = 'cengineering-archimate';

export function createDefaultProjectConfig(name = 'project'): CalmProjectConfig {
	return {
		$schema: 'https://calmstudio.local/schemas/calmrj-1.0.json',
		version: 1,
		name,
		validation: {
			rulesets: [],
		},
		naming: {
			profile: CENGINEERING_ARCHIMATE_PROFILE,
			rootDirs: {
				'application-component': 'application-components',
			},
			// `dir` is a single subfolder under the current diagram (stereotype.slug).
			// Templates use {{name}} = slugified element display name.
			patterns: {
				'archimate:applicationComponent': {
					dir: 'appcomp.{{name}}',
					file: '{{name}}.appcomp.json',
				},
				system: {
					dir: 'appcomp.{{name}}',
					file: '{{name}}.appcomp.json',
				},
				'archimate:applicationService': {
					dir: 'appserv.{{name}}',
					file: '{{name}}.appserv.json',
				},
				service: {
					dir: 'appserv.{{name}}',
					file: '{{name}}.appserv.json',
				},
				'archimate:applicationInterface': {
					dir: 'ep.{{name}}',
					file: '{{name}}.ep.json',
				},
			},
		},
		diagrams: {},
		neighbors: {
			searchRoots: [],
		},
	};
}

export function isCalmProjectConfig(value: unknown): value is CalmProjectConfig {
	if (!value || typeof value !== 'object') return false;
	const v = value as Record<string, unknown>;
	if (typeof v['version'] !== 'number') return false;
	if (typeof v['name'] !== 'string') return false;
	if (!v['validation'] || typeof v['validation'] !== 'object') return false;
	if (!v['naming'] || typeof v['naming'] !== 'object') return false;
	const naming = v['naming'] as Record<string, unknown>;
	if (typeof naming['profile'] !== 'string') return false;
	if (!naming['patterns'] || typeof naming['patterns'] !== 'object') return false;
	if (v['templates'] !== undefined) {
		if (!v['templates'] || typeof v['templates'] !== 'object') return false;
		const templates = v['templates'] as Record<string, unknown>;
		if (typeof templates['dir'] !== 'string') return false;
	}
	if (v['patterns'] !== undefined) {
		if (!v['patterns'] || typeof v['patterns'] !== 'object') return false;
		const patterns = v['patterns'] as Record<string, unknown>;
		if (typeof patterns['dir'] !== 'string') return false;
	}
	if (v['extensions'] !== undefined) {
		if (!v['extensions'] || typeof v['extensions'] !== 'object' || Array.isArray(v['extensions'])) {
			return false;
		}
		const extensions = v['extensions'] as Record<string, unknown>;
		if (extensions['dir'] !== undefined && typeof extensions['dir'] !== 'string') return false;
		if (extensions['disabled'] !== undefined) {
			if (!Array.isArray(extensions['disabled'])) return false;
			if (extensions['disabled'].some((id) => typeof id !== 'string')) return false;
		}
	}
	if (v['hub'] !== undefined) {
		if (!v['hub'] || typeof v['hub'] !== 'object') return false;
		const hub = v['hub'] as Record<string, unknown>;
		if (typeof hub['url'] !== 'string') return false;
	}
	if (v['urlMapping'] !== undefined) {
		if (!v['urlMapping'] || typeof v['urlMapping'] !== 'object' || Array.isArray(v['urlMapping'])) {
			return false;
		}
		const urlMapping = v['urlMapping'] as Record<string, unknown>;
		if (typeof urlMapping['path'] !== 'string') return false;
	}
	return true;
}

export function validateNamingConfig(naming: CalmProjectConfig['naming']): string | null {
	if (!naming.profile.trim()) return 'Naming profile is required';
	if (naming.rootDirs) {
		for (const [key, value] of Object.entries(naming.rootDirs)) {
			if (!key.trim() || !value.trim()) return 'rootDirs keys and values must be non-empty';
		}
	}
	for (const [type, pattern] of Object.entries(naming.patterns)) {
		if (!type.trim()) return 'Pattern type cannot be empty';
		if (!pattern.dir.trim() || !pattern.file.trim()) {
			return `Pattern "${type}" needs both dir and file templates`;
		}
	}
	return null;
}

export function validateHubUrlInput(url: string): string | null {
	const trimmed = url.trim();
	if (!trimmed) return null;
	try {
		const parsed = new URL(trimmed);
		if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
			return 'Hub URL must be http(s)';
		}
	} catch {
		return 'Hub URL is not a valid URL';
	}
	return null;
}
