<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<!--
  ControlsList.svelte — Displays and edits CALM 1.2 controls on a node or relationship.
  Renders as a collapsible "Controls" section. Each control shows as a collapsible row
  with its key as the heading, a description field, and requirement-url links.
-->
<script lang="ts">
	import type { CalmControls, CalmControl, CalmControlRequirement } from '@calmstudio/calm-core';

	let {
		controls,
		onupdate,
		readonly = false,
	}: {
		controls: CalmControls | undefined;
		onupdate: (controls: CalmControls) => void;
		readonly?: boolean;
	} = $props();

	let sectionExpanded = $state(false);
	let expandedControls = $state<Set<string>>(new Set());
	let customControlCounter = $state(0);
	let descTimers: Record<string, ReturnType<typeof setTimeout>> = {};
	let reqTimers: Record<string, ReturnType<typeof setTimeout>> = {};

	const controlEntries = $derived(controls ? Object.entries(controls) : []);
	const controlCount = $derived(controlEntries.length);

	function toggleSection() {
		sectionExpanded = !sectionExpanded;
	}

	function toggleControl(key: string) {
		const next = new Set(expandedControls);
		if (next.has(key)) {
			next.delete(key);
		} else {
			next.add(key);
		}
		expandedControls = next;
	}

	function handleDescriptionInput(key: string, value: string) {
		clearTimeout(descTimers[key]);
		descTimers[key] = setTimeout(() => {
			const updated: CalmControls = { ...(controls ?? {}) };
			updated[key] = { ...updated[key], description: value };
			onupdate(updated);
		}, 300);
	}

	function handleRequirementUrlInput(key: string, reqIdx: number, value: string) {
		const timerKey = `${key}-${reqIdx}`;
		clearTimeout(reqTimers[timerKey]);
		reqTimers[timerKey] = setTimeout(() => {
			const updated: CalmControls = { ...(controls ?? {}) };
			const reqs = [...(updated[key]?.requirements ?? [])];
			reqs[reqIdx] = { ...reqs[reqIdx], 'requirement-url': value };
			updated[key] = { ...updated[key], requirements: reqs };
			onupdate(updated);
		}, 300);
	}

	function handleAddRequirement(key: string) {
		const updated: CalmControls = { ...(controls ?? {}) };
		const reqs = [...(updated[key]?.requirements ?? [])];
		const newReq: CalmControlRequirement = { 'requirement-url': '' };
		reqs.push(newReq);
		updated[key] = { ...updated[key], requirements: reqs };
		onupdate(updated);
	}

	function handleRemoveRequirement(key: string, reqIdx: number) {
		const updated: CalmControls = { ...(controls ?? {}) };
		const reqs = [...(updated[key]?.requirements ?? [])];
		reqs.splice(reqIdx, 1);
		updated[key] = { ...updated[key], requirements: reqs };
		onupdate(updated);
	}

	function handleRemoveControl(key: string) {
		const updated: CalmControls = { ...(controls ?? {}) };
		delete updated[key];
		onupdate(updated);
	}

	function handleAddControl() {
		customControlCounter++;
		const key = `custom-control-${customControlCounter}`;
		const updated: CalmControls = { ...(controls ?? {}) };
		updated[key] = { description: '', requirements: [{ 'requirement-url': '' }] };
		onupdate(updated);
		// Auto-expand the new control
		const next = new Set(expandedControls);
		next.add(key);
		expandedControls = next;
		// Auto-expand section if not already
		sectionExpanded = true;
	}
</script>

<div class="section">
	<!-- Section header — collapsible -->
	<button
		type="button"
		class="section-toggle"
		onclick={toggleSection}
		aria-expanded={sectionExpanded}
	>
		<span class="chevron" class:open={sectionExpanded}>
			<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
				<path d="M9 18l6-6-6-6" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
		</span>
		<span class="section-label">Controls</span>
		{#if controlCount > 0}
			<span class="badge">{controlCount}</span>
		{/if}
	</button>

	{#if sectionExpanded}
		<div class="controls-body">
			{#if controlEntries.length === 0}
				<p class="empty-hint">No controls defined</p>
			{:else}
				<div class="control-list">
					{#each controlEntries as [key, control] (key)}
						<div class="control-item">
							<!-- Control row header -->
							<div class="control-row-header">
								<button
									type="button"
									class="control-toggle"
									onclick={() => toggleControl(key)}
									aria-expanded={expandedControls.has(key)}
								>
									<span class="chevron" class:open={expandedControls.has(key)}>
										<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
											<path d="M9 18l6-6-6-6" stroke-linecap="round" stroke-linejoin="round" />
										</svg>
									</span>
									<span class="control-key">{key}</span>
								</button>
								{#if !readonly}
									<button
										type="button"
										class="remove-btn"
										onclick={() => handleRemoveControl(key)}
										aria-label="Remove control {key}"
										title="Remove control"
									>
										<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
											<path d="M18 6 6 18M6 6l12 12" stroke-linecap="round" />
										</svg>
									</button>
								{/if}
							</div>

							<!-- Expanded control content -->
							{#if expandedControls.has(key)}
								<div class="control-content">
									<!-- Description -->
									<div class="control-field">
										<label class="control-field-label" for="ctrl-desc-{key}">Description</label>
										{#if readonly}
											<p class="ctrl-desc-readonly">{control.description || '—'}</p>
										{:else}
											<textarea
												id="ctrl-desc-{key}"
												class="ctrl-textarea"
												rows={2}
												value={control.description}
												oninput={(e) => handleDescriptionInput(key, (e.target as HTMLTextAreaElement).value)}
												placeholder="Control description"
												aria-label="Control description"
											></textarea>
										{/if}
									</div>

									<!-- Requirements -->
									<div class="control-field">
										<span class="control-field-label">Requirements</span>
										{#if control.requirements && control.requirements.length > 0}
											<div class="req-list">
												{#each control.requirements as req, idx (idx)}
													<div class="req-row">
														{#if readonly}
															{#if req['requirement-url']}
																<a
																	href={req['requirement-url']}
																	target="_blank"
																	rel="noopener noreferrer"
																	class="req-link"
																	title={req['requirement-url']}
																>{req['requirement-url']}</a>
															{:else}
																<span class="req-empty">—</span>
															{/if}
														{:else}
															<input
																class="req-input"
																type="url"
																value={req['requirement-url']}
																oninput={(e) => handleRequirementUrlInput(key, idx, (e.target as HTMLInputElement).value)}
																placeholder="https://..."
																aria-label="Requirement URL"
															/>
															{#if req['requirement-url']}
																<a
																	href={req['requirement-url']}
																	target="_blank"
																	rel="noopener noreferrer"
																	class="req-link-icon"
																	title="Open requirement URL"
																	aria-label="Open requirement URL"
																>
																	<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
																		<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
																		<polyline points="15 3 21 3 21 9"/>
																		<line x1="10" y1="14" x2="21" y2="3"/>
																	</svg>
																</a>
															{/if}
															<button
																type="button"
																class="remove-btn"
																onclick={() => handleRemoveRequirement(key, idx)}
																aria-label="Remove requirement"
																title="Remove requirement"
															>
																<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
																	<path d="M18 6 6 18M6 6l12 12" stroke-linecap="round" />
																</svg>
															</button>
														{/if}
													</div>
												{/each}
											</div>
										{:else}
											<p class="empty-hint">No requirements</p>
										{/if}
										{#if !readonly}
											<button type="button" class="add-small-btn" onclick={() => handleAddRequirement(key)}>
												+ Add Requirement
											</button>
										{/if}
									</div>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}

			{#if !readonly}
				<button type="button" class="add-btn" onclick={handleAddControl}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
						<line x1="12" y1="5" x2="12" y2="19" />
						<line x1="5" y1="12" x2="19" y2="12" />
					</svg>
					Add Control
				</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.section {
		border-top: 1px solid var(--color-border, #e2e8f0);
	}

	:global(.dark) .section {
		border-color: #1e293b;
	}

	.section-toggle {
		display: flex;
		align-items: center;
		gap: 6px;
		width: 100%;
		padding: 10px 12px 8px;
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
	}

	.section-toggle:hover {
		background: var(--color-surface-secondary, #f8fafc);
	}

	:global(.dark) .section-toggle:hover {
		background: #0f172a;
	}

	.chevron {
		display: flex;
		align-items: center;
		color: var(--color-text-tertiary, #94a3b8);
		transition: transform 0.15s;
	}

	.chevron.open {
		transform: rotate(90deg);
	}

	.section-label {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--color-text-tertiary, #94a3b8);
		flex: 1;
	}

	:global(.dark) .section-label {
		color: #64748b;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 18px;
		height: 18px;
		padding: 0 5px;
		border-radius: 9px;
		font-size: 10px;
		font-weight: 600;
		background: var(--color-surface-secondary, #f1f5f9);
		color: var(--color-text-secondary, #64748b);
	}

	:global(.dark) .badge {
		background: #1e293b;
		color: #94a3b8;
	}

	.controls-body {
		padding: 0 12px 10px;
	}

	.control-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-bottom: 6px;
	}

	.control-item {
		border: 1px solid var(--color-border, #e2e8f0);
		border-radius: 6px;
		overflow: hidden;
	}

	:global(.dark) .control-item {
		border-color: #334155;
	}

	.control-row-header {
		display: flex;
		align-items: center;
		background: var(--color-surface-secondary, #f8fafc);
	}

	:global(.dark) .control-row-header {
		background: #0f1320;
	}

	.control-toggle {
		display: flex;
		align-items: center;
		gap: 5px;
		flex: 1;
		padding: 6px 8px;
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
		min-width: 0;
	}

	.control-toggle:hover {
		background: var(--color-surface-secondary, #f1f5f9);
	}

	:global(.dark) .control-toggle:hover {
		background: #1e293b;
	}

	.control-key {
		font-size: 11px;
		font-weight: 600;
		font-family: var(--font-mono, monospace);
		color: var(--color-text-primary, #1e293b);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	:global(.dark) .control-key {
		color: #e2e8f0;
	}

	.control-content {
		padding: 8px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		background: var(--color-surface, #fff);
	}

	:global(.dark) .control-content {
		background: #111827;
	}

	.control-field {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.control-field-label {
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-text-tertiary, #94a3b8);
	}

	:global(.dark) .control-field-label {
		color: #64748b;
	}

	.ctrl-textarea {
		padding: 4px 7px;
		font-size: 11px;
		font-family: inherit;
		color: var(--color-text-primary, #1e293b);
		background: var(--color-surface, #fff);
		border: 1px solid var(--color-border, #e2e8f0);
		border-radius: 5px;
		outline: none;
		resize: vertical;
		min-height: 44px;
		transition: border-color 0.15s;
		line-height: 1.4;
	}

	.ctrl-textarea:focus {
		border-color: var(--color-accent, #6366f1);
	}

	:global(.dark) .ctrl-textarea {
		background: #1e293b;
		border-color: #334155;
		color: #e2e8f0;
	}

	:global(.dark) .ctrl-textarea:focus {
		border-color: #818cf8;
	}

	.ctrl-desc-readonly {
		font-size: 11px;
		color: var(--color-text-secondary, #64748b);
		margin: 0;
		line-height: 1.4;
	}

	:global(.dark) .ctrl-desc-readonly {
		color: #94a3b8;
	}

	.req-list {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.req-row {
		display: flex;
		align-items: center;
		gap: 3px;
	}

	.req-input {
		flex: 1;
		height: 26px;
		padding: 0 6px;
		font-size: 10px;
		font-family: var(--font-mono, monospace);
		color: var(--color-text-primary, #1e293b);
		background: var(--color-surface, #fff);
		border: 1px solid var(--color-border, #e2e8f0);
		border-radius: 4px;
		outline: none;
		transition: border-color 0.15s;
		min-width: 0;
	}

	.req-input:focus {
		border-color: var(--color-accent, #6366f1);
	}

	:global(.dark) .req-input {
		background: #1e293b;
		border-color: #334155;
		color: #e2e8f0;
	}

	:global(.dark) .req-input:focus {
		border-color: #818cf8;
	}

	.req-link {
		font-size: 10px;
		font-family: var(--font-mono, monospace);
		color: var(--color-accent, #6366f1);
		text-decoration: none;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 100%;
	}

	.req-link:hover {
		text-decoration: underline;
	}

	.req-empty {
		font-size: 10px;
		color: var(--color-text-tertiary, #94a3b8);
		font-style: italic;
	}

	.req-link-icon {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		color: var(--color-text-tertiary, #94a3b8);
		text-decoration: none;
		transition: color 0.15s;
	}

	.req-link-icon:hover {
		color: var(--color-accent, #6366f1);
	}

	.remove-btn {
		flex-shrink: 0;
		width: 20px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		cursor: pointer;
		color: var(--color-text-tertiary, #94a3b8);
		border-radius: 3px;
		padding: 1px;
		transition: all 0.15s;
	}

	.remove-btn:hover {
		color: #ef4444;
		background: rgba(239, 68, 68, 0.08);
	}

	:global(.dark) .remove-btn:hover {
		color: #f87171;
		background: rgba(248, 113, 113, 0.1);
	}

	.empty-hint {
		font-size: 11px;
		color: var(--color-text-tertiary, #94a3b8);
		margin: 0 0 6px;
		font-style: italic;
	}

	:global(.dark) .empty-hint {
		color: #475569;
	}

	.add-small-btn {
		font-size: 10px;
		font-family: inherit;
		font-weight: 500;
		color: var(--color-accent, #6366f1);
		background: none;
		border: none;
		cursor: pointer;
		padding: 2px 0;
		opacity: 0.75;
		transition: opacity 0.15s;
	}

	.add-small-btn:hover {
		opacity: 1;
	}

	:global(.dark) .add-small-btn {
		color: #818cf8;
	}

	.add-btn {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 4px 8px;
		font-size: 11px;
		font-family: inherit;
		font-weight: 500;
		color: var(--color-accent, #6366f1);
		background: none;
		border: 1px dashed var(--color-accent, #6366f1);
		border-radius: 5px;
		cursor: pointer;
		transition: all 0.15s;
		opacity: 0.75;
		margin-top: 4px;
	}

	.add-btn:hover {
		opacity: 1;
		background: var(--color-accent-subtle, rgba(99, 102, 241, 0.06));
	}

	:global(.dark) .add-btn {
		color: #818cf8;
		border-color: #818cf8;
	}

	:global(.dark) .add-btn:hover {
		background: rgba(129, 140, 248, 0.08);
	}

	.add-btn svg {
		width: 12px;
		height: 12px;
	}
</style>
