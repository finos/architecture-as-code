// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { hubArchitectureUrl } from '$lib/hub/hubClient';
import { isHubArchitectureUrl } from '$lib/hub/hubUrl';

describe('hub browse', () => {
	it('builds a Hub architecture URL for detailed-architecture', () => {
		expect(hubArchitectureUrl('http://localhost:8080', 'onebank', 'coa', '1.0.0')).toBe(
			'http://localhost:8080/calm/namespaces/onebank/architectures/coa/versions/1.0.0'
		);
	});

	it('does not keep a typed /api path for named (slug) Hub document URLs', () => {
		expect(hubArchitectureUrl('http://localhost:8080/api', 'onebank', 'coa', '1.0.0')).toBe(
			'http://localhost:8080/calm/namespaces/onebank/architectures/coa/versions/1.0.0'
		);
	});

	it('uses /api/calm for numeric Hub ids', () => {
		expect(hubArchitectureUrl('http://localhost:8080', 'onebank', '4', '1.0.0')).toBe(
			'http://localhost:8080/api/calm/namespaces/onebank/architectures/4/versions/1.0.0'
		);
	});

	it('skips the R16 out-of-project infobox when the host matches Hub', () => {
		const url = hubArchitectureUrl('http://localhost:8080', 'onebank', 'coa', '1.0.0');
		expect(isHubArchitectureUrl(url, 'http://localhost:8080')).toBe(true);
	});
});
