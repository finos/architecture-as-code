// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, test, expect, beforeEach, readFileSync } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { CalmArchitecture } from '@calmstudio/calm-core';
import { calmToFlow } from '$lib/stores/projection';
import {
	applyFromJson,
	getExportJson,
	resetModel,
	buildPersistedArchitecture,
} from '$lib/stores/calmModel.svelte';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ARCH_PATH = resolve(
	__dirname,
	'../../../../../../../../difa/CreditasGroup.SND-Engineering-App/architecture-model/components/app/app.architecture.json'
);

describe('app.architecture.json export regression', () => {
	beforeEach(() => {
		resetModel();
	});

	test('preserves all relationships when canvas edges are not yet bound', () => {
		let arch: CalmArchitecture;
		try {
			arch = JSON.parse(readFileSync(APP_ARCH_PATH, 'utf8')) as CalmArchitecture;
		} catch {
			// Skip when SND repo is not checked out beside calm-studio in CI.
			return;
		}

		const expectedRelCount = arch.relationships.length;
		expect(expectedRelCount).toBeGreaterThan(40);

		applyFromJson(arch);
		const { nodes } = calmToFlow(arch);

		const persisted = buildPersistedArchitecture(nodes, []);
		expect(persisted.relationships).toHaveLength(expectedRelCount);

		const exported = JSON.parse(getExportJson(nodes, [])) as CalmArchitecture;
		expect(exported.relationships).toHaveLength(expectedRelCount);
	});
});
