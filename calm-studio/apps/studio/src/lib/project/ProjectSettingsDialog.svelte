<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<script lang="ts">
	import {
		getProjectConfig,
		getProjectFileConfig,
		getProjectConfigFileName,
		getProjectRootHandle,
		saveProjectConfig,
		setRulesetEnabled,
		setNeighborSearchRoots,
		setTemplatesDir,
		setPatternsDir,
		setExtensionsDir,
		setExtensionsDisabled,
		setHubUrl,
		setNamingConfig,
		applyUserConfig,
		getUserConfig,
	} from '$lib/project/projectStore.svelte';
	import {
		extensionsDirectoryHandleKey,
		isAbsoluteFsPath,
		normalizeExtensionsDir,
		pickDirectoryMaybeOutside,
		pickProjectDirectory,
		pickProjectFile,
	} from '$lib/project/pathPickers';
	import { saveNamedDirectoryHandle } from '$lib/explorer/folderPersistence';
	import { validateHubUrlInput, validateNamingConfig } from '$lib/project/defaults';
	import { normalizeHubUrl } from '$lib/hub/hubUrl';
	import type { CalmProjectNaming } from '$lib/project/types';
	import { pickUserDefaultsFile, saveUserDefaultsConfig } from '$lib/project/userDefaults';

	interface Props {
		onclose: () => void;
	}

	let { onclose }: Props = $props();

	let newPath = $state('validation/team-rules.json');
	let newRoot = $state('components');
	let templatesDir = $state(getProjectConfig()?.templates?.dir ?? '');
	let patternsDir = $state(getProjectConfig()?.patterns?.dir ?? '');
	let extensionsDir = $state(getProjectConfig()?.extensions?.dir ?? '');
	let hubUrl = $state(normalizeHubUrl(getProjectFileConfig()?.hub?.url) ?? '');
	let namingProfile = $state(getProjectFileConfig()?.naming.profile ?? '');
	let namingRootDirs = $state(
		Object.entries(getProjectFileConfig()?.naming.rootDirs ?? {}).map(([key, value]) => ({ key, value }))
	);
	let namingPatterns = $state(
		Object.entries(getProjectFileConfig()?.naming.patterns ?? {}).map(([type, p]) => ({
			type,
			dir: p.dir,
			file: p.file,
		}))
	);
	let disabledPacks = $state([...(getProjectFileConfig()?.extensions?.disabled ?? [])]);
	let status = $state<string | null>(null);
	let formError = $state<string | null>(null);
	let saving = $state(false);
	let settingsTab = $state<
		'naming' | 'patterns' | 'hub' | 'extensions' | 'validation' | 'templates' | 'neighbors' | 'user'
	>('naming');

	const BUNDLED_PACK_IDS = [
		'core',
		'aws',
		'gcp',
		'azure',
		'k8s',
		'ai',
		'fluxnova',
		'messaging',
		'identity',
		'opengris',
		'archimate',
	];

	const config = $derived(getProjectFileConfig());
	const fileName = $derived(getProjectConfigFileName());
	const searchRoots = $derived(config?.neighbors?.searchRoots ?? []);

	async function toggle(path: string, enabled: boolean) {
		setRulesetEnabled(path, enabled);
		await persist();
	}

	async function addRuleset() {
		const path = newPath.trim().replace(/\\/g, '/');
		if (!path) return;
		setRulesetEnabled(path, true);
		newPath = '';
		await persist();
	}

	async function addSearchRoot() {
		const root = newRoot.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
		if (!root) return;
		setNeighborSearchRoots([...searchRoots, root]);
		newRoot = '';
		await persist();
	}

	async function removeSearchRoot(root: string) {
		setNeighborSearchRoots(searchRoots.filter((r) => r !== root));
		await persist();
	}

	async function browseRuleset() {
		const result = await pickProjectFile(getProjectRootHandle());
		if ('cancelled' in result) return;
		if ('error' in result) {
			status = result.error;
			return;
		}
		newPath = result.path;
	}

	async function browseSearchRoot() {
		const result = await pickProjectDirectory(getProjectRootHandle());
		if ('cancelled' in result) return;
		if ('error' in result) {
			status = result.error;
			return;
		}
		newRoot = result.path || '.';
	}

	async function saveTemplatesDir() {
		setTemplatesDir(templatesDir);
		await persist();
	}

	async function browseTemplatesDir() {
		const result = await pickProjectDirectory(getProjectRootHandle());
		if ('cancelled' in result) return;
		if ('error' in result) {
			status = result.error;
			return;
		}
		templatesDir = result.path;
		await saveTemplatesDir();
	}

	async function savePatternsDir() {
		setPatternsDir(patternsDir);
		await persist();
	}

	async function browsePatternsDir() {
		const result = await pickProjectDirectory(getProjectRootHandle());
		if ('cancelled' in result) return;
		if ('error' in result) {
			status = result.error;
			return;
		}
		patternsDir = result.path;
		await savePatternsDir();
	}

	async function saveExtensionsDir() {
		setExtensionsDir(extensionsDir);
		await persist();
	}

	async function browseExtensionsDir() {
		const result = await pickDirectoryMaybeOutside(getProjectRootHandle());
		if ('cancelled' in result) return;
		if ('error' in result) {
			status = result.error;
			return;
		}
		if (result.outside) {
			const path = isAbsoluteFsPath(extensionsDir)
				? normalizeExtensionsDir(extensionsDir)
				: result.path;
			await saveNamedDirectoryHandle(extensionsDirectoryHandleKey(path), result.handle);
			extensionsDir = path;
		} else {
			extensionsDir = result.path;
		}
		await saveExtensionsDir();
	}

	function buildNaming(): CalmProjectNaming {
		const rootDirs: Record<string, string> = {};
		for (const row of namingRootDirs) {
			if (row.key.trim() && row.value.trim()) rootDirs[row.key.trim()] = row.value.trim();
		}
		const patterns: CalmProjectNaming['patterns'] = {};
		for (const row of namingPatterns) {
			if (!row.type.trim()) continue;
			patterns[row.type.trim()] = { dir: row.dir, file: row.file };
		}
		return {
			profile: namingProfile,
			...(Object.keys(rootDirs).length > 0 ? { rootDirs } : {}),
			patterns,
		};
	}

	async function saveNamingAndHub() {
		const naming = buildNaming();
		const namingErr = validateNamingConfig(naming);
		if (namingErr) {
			formError = namingErr;
			return;
		}
		const hubErr = validateHubUrlInput(hubUrl);
		if (hubErr) {
			formError = hubErr;
			return;
		}
		formError = null;
		setNamingConfig(naming);
		setPatternsDir(patternsDir);
		setHubUrl(hubUrl);
		setExtensionsDisabled(disabledPacks);
		hubUrl = getProjectFileConfig()?.hub?.url ?? '';
		await persist();
	}

	async function persist() {
		const cfg = getProjectFileConfig();
		if (!cfg) return;
		saving = true;
		status = null;
		try {
			await saveProjectConfig(cfg);
			status = 'Saved';
		} catch (e) {
			status = (e as Error).message;
		} finally {
			saving = false;
		}
	}

	function toggleDisabledPack(id: string, checked: boolean) {
		disabledPacks = checked
			? [...new Set([...disabledPacks, id])]
			: disabledPacks.filter((p) => p !== id);
	}

	async function handlePickUserDefaults() {
		try {
			const loaded = await pickUserDefaultsFile();
			await applyUserConfig(loaded);
			status = loaded ? 'User defaults loaded' : 'No user defaults';
		} catch (e) {
			if ((e as Error).name !== 'AbortError') status = (e as Error).message;
		}
	}

	async function handleSaveUserDefaults() {
		const cfg = getUserConfig() ?? getProjectFileConfig();
		if (!cfg) {
			status = 'Nothing to save as user defaults';
			return;
		}
		try {
			await saveUserDefaultsConfig(cfg);
			await applyUserConfig(cfg);
			status = 'User defaults saved';
		} catch (e) {
			if ((e as Error).name !== 'AbortError') status = (e as Error).message;
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			onclose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="backdrop" role="presentation" onclick={(e) => e.target === e.currentTarget && onclose()}>
	<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="prj-settings-title">
		<h2 id="prj-settings-title" class="title">Project settings</h2>
		<p class="meta">
			{#if fileName}
				<code>{fileName}</code>
			{:else}
				No project file loaded
			{/if}
		</p>

		<div class="tabs" role="tablist">
			{#each [
				['naming', 'naming'],
				['patterns', 'patterns'],
				['hub', 'hub'],
				['extensions', 'extensions'],
				['validation', 'validation'],
				['templates', 'templates'],
				['neighbors', 'neighbors'],
				['user', 'user'],
			] as [id, label]}
				<button
					type="button"
					class="tab"
					class:active={settingsTab === id}
					role="tab"
					aria-selected={settingsTab === id}
					onclick={() => (settingsTab = id as typeof settingsTab)}
				>
					{label}
				</button>
			{/each}
		</div>

		{#if config}
			{#if settingsTab === 'validation'}
			<section class="section">
				<h3 class="section-title">Spectral rulesets</h3>
				<p class="hint">Core CALM validation is always on. Enable extra rulesets stored in the project folder.</p>
				<ul class="list">
					{#each config.validation.rulesets as rs (rs.path)}
						<li class="row">
							<label class="check">
								<input
									type="checkbox"
									checked={rs.enabled}
									onchange={(e) => void toggle(rs.path, (e.currentTarget as HTMLInputElement).checked)}
								/>
								<span>{rs.path}</span>
							</label>
						</li>
					{/each}
					{#if config.validation.rulesets.length === 0}
						<li class="empty">No rulesets yet</li>
					{/if}
				</ul>
				<div class="add-row">
					<input class="input" bind:value={newPath} placeholder="validation/rules.json" />
					<button type="button" class="btn" onclick={() => void browseRuleset()} disabled={saving}>
						Browse…
					</button>
					<button type="button" class="btn" onclick={() => void addRuleset()} disabled={!newPath.trim() || saving}>
						Add
					</button>
				</div>
			</section>
			{/if}

			{#if settingsTab === 'neighbors'}
			<section class="section">
				<h3 class="section-title">Find neighbors — search roots</h3>
				<p class="hint">
					Folders (relative to project root) scanned for neighbors, including subfolders.
					Empty list = search the entire project.
				</p>
				<ul class="list">
					{#each searchRoots as root (root)}
						<li class="row root-row">
							<code class="root-path">{root}</code>
							<button
								type="button"
								class="btn danger"
								onclick={() => void removeSearchRoot(root)}
								disabled={saving}
							>
								Remove
							</button>
						</li>
					{/each}
					{#if searchRoots.length === 0}
						<li class="empty">No roots — whole project is scanned</li>
					{/if}
				</ul>
				<div class="add-row">
					<input class="input" bind:value={newRoot} placeholder="components" />
					<button type="button" class="btn" onclick={() => void browseSearchRoot()} disabled={saving}>
						Browse…
					</button>
					<button type="button" class="btn" onclick={() => void addSearchRoot()} disabled={!newRoot.trim() || saving}>
						Add folder
					</button>
				</div>
			</section>
			{/if}

			{#if settingsTab === 'templates'}
			<section class="section">
				<h3 class="section-title">Project templates</h3>
				<p class="hint">
					Folder of CALM template JSON files (relative to the project root). Merged with bundled
					templates; the same <code>_template.id</code> overwrites a bundled card.
				</p>
				<div class="add-row">
					<input class="input" bind:value={templatesDir} placeholder="templates" />
					<button type="button" class="btn" onclick={() => void browseTemplatesDir()} disabled={saving}>
						Browse…
					</button>
					<button
						type="button"
						class="btn"
						onclick={() => void saveTemplatesDir()}
						disabled={saving}
					>
						Save
					</button>
				</div>
			</section>
			{/if}

			{#if settingsTab === 'patterns'}
			<section class="section">
				<h3 class="section-title">CALM CLI patterns</h3>
				<p class="hint">
					Folder of CALM CLI pattern JSON files (relative to the project root). Shown as
					<strong>Pattern</strong> cards in the template picker and generated via the shared
					instantiate pipeline.
				</p>
				<div class="add-row">
					<input class="input" bind:value={patternsDir} placeholder="patterns" />
					<button type="button" class="btn" onclick={() => void browsePatternsDir()} disabled={saving}>
						Browse…
					</button>
					<button type="button" class="btn" onclick={() => void savePatternsDir()} disabled={saving}>
						Save
					</button>
				</div>
			</section>
			{/if}

			{#if settingsTab === 'extensions'}
			<section class="section">
				<h3 class="section-title">Extension packs</h3>
				<p class="hint">
					Project folder <code>extensions/</code> is always scanned for
					<code>*.extension.json</code>. Optionally add another folder — project-relative, or
					outside the project (Browse grants access). Same pack <code>id</code> overwrites
					bundled types.
				</p>
				<div class="add-row">
					<input
						class="input"
						bind:value={extensionsDir}
						placeholder="standards or C:/path/to/standards"
					/>
					<button type="button" class="btn" onclick={() => void browseExtensionsDir()} disabled={saving}>
						Browse…
					</button>
					<button type="button" class="btn" onclick={() => void saveExtensionsDir()} disabled={saving}>
						Save
					</button>
				</div>
				<h4 class="sub-title">Disable bundled packs</h4>
				<ul class="list">
					{#each BUNDLED_PACK_IDS as packId (packId)}
						<li class="row">
							<label class="check">
								<input
									type="checkbox"
									checked={disabledPacks.includes(packId)}
									onchange={(e) =>
										toggleDisabledPack(packId, (e.currentTarget as HTMLInputElement).checked)}
								/>
								<span>{packId}</span>
							</label>
						</li>
					{/each}
				</ul>
				<p class="hint">Checked packs are hidden from the palette. Extra packs from the folder above stay loadable.</p>
			</section>
			{/if}

			{#if settingsTab === 'naming'}
			<section class="section">
				<h3 class="section-title">Naming</h3>
				<p class="hint"><code>{'{{name}}'}</code> tokens stay text — no file picker.</p>
				<label class="field-label" for="naming-profile">Profile</label>
				<input id="naming-profile" class="input full" bind:value={namingProfile} />
				<h4 class="sub-title">rootDirs</h4>
				{#each namingRootDirs as row, i (i)}
					<div class="add-row">
						<input class="input" bind:value={row.key} placeholder="application-component" />
						<input class="input" bind:value={row.value} placeholder="application-components" />
						<button type="button" class="btn danger" onclick={() => (namingRootDirs = namingRootDirs.filter((_, j) => j !== i))}>Remove</button>
					</div>
				{/each}
				<button type="button" class="btn" onclick={() => (namingRootDirs = [...namingRootDirs, { key: '', value: '' }])}>
					Add rootDir
				</button>
				<h4 class="sub-title">Patterns (node-type → dir / file)</h4>
				{#each namingPatterns as row, i (i)}
					<div class="pattern-block">
						<input class="input full" bind:value={row.type} placeholder="archimate:applicationComponent" />
						<div class="add-row">
							<input class="input" bind:value={row.dir} placeholder="appcomp.{{name}}" />
							<input class="input" bind:value={row.file} placeholder="{{name}}.appcomp.json" />
							<button type="button" class="btn danger" onclick={() => (namingPatterns = namingPatterns.filter((_, j) => j !== i))}>Remove</button>
						</div>
					</div>
				{/each}
				<button type="button" class="btn" onclick={() => (namingPatterns = [...namingPatterns, { type: '', dir: '', file: '' }])}>
					Add pattern
				</button>
			</section>
			{/if}

			{#if settingsTab === 'hub'}
			<section class="section">
				<h3 class="section-title">CALM Hub URL</h3>
				<p class="hint">Host and port only, for example <code>http://localhost:8080</code>. Do not include <code>/api</code> or <code>/calm</code>. Overrides <code>~/.calm.json</code> when both exist. Browser Studio never reads the home directory.</p>
				<input class="input full" bind:value={hubUrl} placeholder="http://localhost:8080" aria-label="CALM Hub URL" />
			</section>
			{/if}

			{#if settingsTab === 'user'}
			<section class="section">
				<h3 class="section-title">User defaults</h3>
				<p class="hint">
					Load a user <code>.calmrj</code> file first; the project file overlays it (project wins).
					The browser cannot silently read <code>~</code> — pick the file once.
				</p>
				<div class="add-row">
					<button type="button" class="btn" onclick={() => void handlePickUserDefaults()} disabled={saving}>
						Browse user defaults…
					</button>
					<button type="button" class="btn" onclick={() => void handleSaveUserDefaults()} disabled={saving}>
						Save user defaults
					</button>
				</div>
			</section>
			{/if}

			{#if formError}
				<p class="form-error" role="alert">{formError}</p>
			{/if}
			<button type="button" class="btn primary" onclick={() => void saveNamingAndHub()} disabled={saving}>
				Save project settings
			</button>
		{:else}
			<p class="hint">Create or open a <code>.calmrj</code> project file first.</p>
		{/if}

		{#if status}
			<p class="status" role="status">{status}</p>
		{/if}

		<div class="actions">
			<button type="button" class="btn primary" onclick={onclose}>Close</button>
		</div>
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 10000;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(15, 23, 42, 0.45);
	}
	.dialog {
		width: min(640px, calc(100vw - 32px));
		max-height: calc(100vh - 48px);
		overflow: auto;
		padding: 20px 22px;
		border-radius: 10px;
		background: var(--color-surface, #fff);
		border: 1px solid var(--color-border, #e2e8f0);
		box-shadow: 0 20px 40px rgba(15, 23, 42, 0.18);
	}
	.title {
		margin: 0 0 6px;
		font-size: 16px;
		font-weight: 600;
	}
	.tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin: 8px 0 12px;
	}
	.tab {
		padding: 4px 8px;
		border: 1px solid var(--color-border, #e2e8f0);
		border-radius: 6px;
		background: #fff;
		font-size: 11px;
		cursor: pointer;
	}
	.tab.active {
		background: #2563eb;
		border-color: #2563eb;
		color: #fff;
	}
	.meta {
		margin: 0 0 14px;
		font-size: 12px;
		color: #64748b;
	}
	.section {
		margin-bottom: 16px;
	}
	.section-title {
		margin: 0 0 6px;
		font-size: 13px;
		font-weight: 600;
	}
	.hint {
		margin: 0 0 8px;
		font-size: 12px;
		color: #64748b;
		line-height: 1.4;
	}
	.list {
		list-style: none;
		margin: 0 0 10px;
		padding: 0;
	}
	.row {
		padding: 4px 0;
	}
	.root-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.root-path {
		font-size: 12px;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.check {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		cursor: pointer;
	}
	.empty {
		font-size: 12px;
		color: #94a3b8;
	}
	.add-row {
		display: flex;
		gap: 8px;
	}
	.input {
		flex: 1;
		padding: 7px 10px;
		border: 1px solid #cbd5e1;
		border-radius: 6px;
		font-size: 12px;
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		margin-top: 8px;
	}
	.btn {
		padding: 7px 14px;
		border-radius: 6px;
		border: 1px solid #cbd5e1;
		background: #fff;
		font-size: 12px;
		cursor: pointer;
	}
	.btn.primary {
		background: #2563eb;
		border-color: #2563eb;
		color: #fff;
	}
	.btn.danger {
		color: #b91c1c;
		border-color: #fecaca;
	}
	.btn:disabled {
		opacity: 0.5;
	}
	.status {
		font-size: 12px;
		color: #0369a1;
	}
	.form-error {
		font-size: 12px;
		color: #b91c1c;
	}
	.field-label,
	.sub-title {
		display: block;
		margin: 8px 0 4px;
		font-size: 12px;
		font-weight: 600;
	}
	.input.full {
		width: 100%;
		margin-bottom: 8px;
	}
	.pattern-block {
		margin-bottom: 8px;
	}
</style>
