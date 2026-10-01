// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { createDefaultProjectConfig, validateHubUrlInput, validateNamingConfig } from '$lib/project/defaults';

describe('naming and patterns settings', () => {
	it('accepts the default naming profile', () => {
		expect(validateNamingConfig(createDefaultProjectConfig().naming)).toBeNull();
	});

	it('rejects empty pattern templates', () => {
		const naming = createDefaultProjectConfig().naming;
		naming.patterns.system = { dir: '', file: '' };
		expect(validateNamingConfig(naming)).toMatch(/dir and file/i);
	});

	it('rejects a non-http Hub URL', () => {
		expect(validateHubUrlInput('ftp://hub')).toMatch(/http/i);
		expect(validateHubUrlInput('http://localhost:8080')).toBeNull();
		expect(validateHubUrlInput('http://localhost:8080/api')).toBeNull();
		expect(validateHubUrlInput('')).toBeNull();
	});
});
