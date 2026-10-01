// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { hubUrlFromProject, isHubArchitectureUrl, normalizeHubUrl } from '$lib/hub/hubUrl';
import type { CalmProjectConfig } from '$lib/project/types';

describe('hub URL resolution', () => {
	it('uses .calmrj hub.url', () => {
		const config = { hub: { url: 'http://localhost:8080/' } } as CalmProjectConfig;
		expect(hubUrlFromProject(config)).toBe('http://localhost:8080');
	});

	it('strips /api and other paths so settings are origin only', () => {
		expect(normalizeHubUrl('http://localhost:8080/api')).toBe('http://localhost:8080');
		expect(normalizeHubUrl('http://localhost:8080/api/calm')).toBe('http://localhost:8080');
		expect(normalizeHubUrl('https://hub.example.com:8443/calm/namespaces')).toBe(
			'https://hub.example.com:8443'
		);
		expect(hubUrlFromProject({ hub: { url: 'http://localhost:8080/api' } } as CalmProjectConfig)).toBe(
			'http://localhost:8080'
		);
	});

	it('does not invent a home-directory URL in the browser path', () => {
		expect(hubUrlFromProject(null)).toBeNull();
		expect(normalizeHubUrl('not-a-url')).toBeNull();
	});

	it('matches Hub architecture URLs on the configured origin', () => {
		const href = 'http://localhost:8080/calm/namespaces/onebank/architectures/coa/versions/1.0.0';
		expect(isHubArchitectureUrl(href, 'http://localhost:8080')).toBe(true);
		expect(isHubArchitectureUrl(href, 'http://other.example')).toBe(false);
		expect(isHubArchitectureUrl('/local/file.json', 'http://localhost:8080')).toBe(false);
	});
});
