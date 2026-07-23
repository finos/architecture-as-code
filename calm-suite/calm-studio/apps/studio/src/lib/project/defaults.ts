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
	return true;
}
