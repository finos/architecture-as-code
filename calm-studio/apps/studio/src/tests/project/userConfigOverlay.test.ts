// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { overlayProjectConfig } from '$lib/project/configOverlay';
import { createDefaultProjectConfig, isCalmProjectConfig } from '$lib/project/defaults';
import { saveAsDefaults } from '$lib/project/saveAsDefaults';
import { defaultNewFolderName, validateFolderName } from '$lib/explorer/folderName';

describe('user config overlay', () => {
	it('lets project values win and replaces arrays when the project key is present', () => {
		const user = createDefaultProjectConfig('user');
		user.hub = { url: 'http://user:8080' };
		user.extensions = { disabled: ['aws'] };
		const project = createDefaultProjectConfig('proj');
		project.hub = { url: 'http://project:8080' };
		project.extensions = { dir: 'standards', disabled: ['ai'] };
		const merged = overlayProjectConfig(user, project);
		expect(merged.hub?.url).toBe('http://project:8080');
		expect(merged.extensions?.disabled).toEqual(['ai']);
		expect(merged.extensions?.dir).toBe('standards');
		expect(merged.name).toBe('proj');
	});

	it('keeps user arrays when the project omits the key', () => {
		const user = createDefaultProjectConfig('user');
		user.extensions = { disabled: ['aws'] };
		const project = createDefaultProjectConfig('proj');
		const merged = overlayProjectConfig(user, project);
		expect(merged.extensions?.disabled).toEqual(['aws']);
	});

	it('accepts extensions.disabled without dir', () => {
		const cfg = { ...createDefaultProjectConfig('x'), extensions: { disabled: ['core'] } };
		expect(isCalmProjectConfig(cfg)).toBe(true);
	});

	it('lets project urlMapping.path win over user defaults', () => {
		const user = createDefaultProjectConfig('user');
		user.urlMapping = { path: 'user-mapping.json' };
		const project = createDefaultProjectConfig('proj');
		project.urlMapping = { path: 'url-mapping.json' };
		const merged = overlayProjectConfig(user, project);
		expect(merged.urlMapping?.path).toBe('url-mapping.json');
	});
});

describe('save as defaults', () => {
	it('uses the selected tree folder and naming-pattern filename', () => {
		const config = createDefaultProjectConfig('onebank');
		const result = saveAsDefaults({
			selectedPath: 'components-int/c',
			filenameFallback: 'architecture.calm.json',
			primaryNodeType: 'system',
			primaryNodeName: 'COA',
			config,
		});
		expect(result.folder).toBe('components-int/c');
		expect(result.fileName).toBe('coa.appcomp.json');
	});
});

describe('new folder name', () => {
	it('rejects path separators', () => {
		expect(validateFolderName('a/b')).toBeTruthy();
		expect(validateFolderName('ok')).toBeNull();
	});

	it('defaults from naming.rootDirs', () => {
		expect(defaultNewFolderName(createDefaultProjectConfig('x'))).toBe('application-components');
	});
});
