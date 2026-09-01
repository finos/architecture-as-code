<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<script lang="ts">
	import {
		getProjectConfig,
		getProjectConfigFileName,
		saveProjectConfig,
		setRulesetEnabled,
		setNeighborSearchRoots,
		setTemplatesDir,
	} from '$lib/project/projectStore.svelte';

	interface Props {
		onclose: () => void;
	}

	let { onclose }: Props = $props();

	let newPath = $state('validation/team-rules.json');
	let newRoot = $state('components');
	let templatesDir = $state(getProjectConfig()?.templates?.dir ?? '');
	let status = $state<string | null>(null);
	let saving = $state(false);

	const config = $derived(getProjectConfig());
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

	async function saveTemplatesDir() {
		setTemplatesDir(templatesDir);
		await persist();
	}

	async function persist() {
		const cfg = getProjectConfig();
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

		{#if config}
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
					<button type="button" class="btn" onclick={() => void addRuleset()} disabled={!newPath.trim() || saving}>
						Add
					</button>
				</div>
			</section>

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
					<button type="button" class="btn" onclick={() => void addSearchRoot()} disabled={!newRoot.trim() || saving}>
						Add folder
					</button>
				</div>
			</section>

			<section class="section">
				<h3 class="section-title">Project templates</h3>
				<p class="hint">
					Folder of CALM template JSON files (relative to the project root). Merged with bundled
					templates; the same <code>_template.id</code> overwrites a bundled card.
				</p>
				<div class="add-row">
					<input class="input" bind:value={templatesDir} placeholder="templates" />
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

			<section class="section">
				<h3 class="section-title">Naming</h3>
				<p class="hint">Profile: <strong>{config.naming.profile}</strong> ({Object.keys(config.naming.patterns).length} patterns)</p>
			</section>
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
		width: min(520px, calc(100vw - 32px));
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
</style>
