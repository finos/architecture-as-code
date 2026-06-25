<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<!--
  DetailsLinkSection.svelte — authors a node's CALM `details` link (the C4
  cross-document zoom): `detailed-architecture` (the document this node opens
  into) and `required-pattern` (the pattern that document must conform to). This
  is how a user crafts the tiers one at a time and links them under the hood —
  the values are written straight into the CALM JSON and survive round-trips.
-->
<script lang="ts">
	import type { Node } from '@xyflow/svelte';
	import { updateNodeProperty, getModel } from '$lib/stores/calmModel.svelte';
	import { resolveC4Document, listC4Documents, registerC4Document } from '$lib/c4/c4Documents.svelte';
	import { buildLinkedDocument, readC4Level } from '$lib/c4/linkedDocument';

	let {
		node,
		onmutate,
	}: {
		node: Node;
		onmutate?: () => void;
	} = $props();

	// Seeded once per node — NodeProperties wraps this in {#key node.id}, so a new
	// selection remounts with fresh values (no effect-driven sync to clobber typing).
	// svelte-ignore state_referenced_locally
	const initial = (node.data?.details ?? {}) as { 'detailed-architecture'?: string; 'required-pattern'?: string };
	let detailedArch = $state(initial['detailed-architecture'] ?? '');
	let requiredPattern = $state(initial['required-pattern'] ?? '');
	let expanded = $state(Boolean(initial['detailed-architecture'] || initial['required-pattern']));

	const linked = $derived(detailedArch.trim().length > 0);
	// Reactive resolution feedback: does the entered ref resolve to a registered document?
	const resolved = $derived(linked ? resolveC4Document(detailedArch.trim()) : undefined);
	// Documents loaded this session — pick one to link to (guaranteed to resolve).
	const loadedDocs = $derived(listC4Documents());

	let created = $state(false);

	function commit() {
		const calmId = String(node.data?.calmId ?? node.id);
		const da = detailedArch.trim();
		const rp = requiredPattern.trim();
		const next: Record<string, string> = {
			...(da ? { 'detailed-architecture': da } : {}),
			...(rp ? { 'required-pattern': rp } : {}),
		};
		updateNodeProperty(calmId, 'details', Object.keys(next).length > 0 ? next : undefined);
		onmutate?.();
	}

	/**
	 * Create a brand-new detailed architecture for this node and link to it:
	 * build a child document whose root node reuses this node's id (identity
	 * continuity), register it for the session so the drill resolves, and wire
	 * the link. The new document opens by double-clicking the node on the canvas;
	 * it lives in the session until saved (consistent with how linked docs load).
	 */
	function createLinkedDocument() {
		const calmId = String(node.data?.calmId ?? node.id);
		const { ref, doc } = buildLinkedDocument(
			{
				id: calmId,
				name: String(node.data?.label ?? calmId),
				nodeType: String(node.data?.calmType ?? 'system'),
				description: node.data?.description ? String(node.data.description) : '',
			},
			readC4Level(getModel().metadata),
		);
		registerC4Document(ref, doc);
		detailedArch = ref;
		commit();
		created = true;
	}
</script>

<div class="section">
	<button type="button" class="section-toggle" onclick={() => (expanded = !expanded)} aria-expanded={expanded}>
		<span class="chevron" class:open={expanded}>
			<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
				<path d="M9 18l6-6-6-6" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
		</span>
		<span class="section-label">Define System Contents</span>
		{#if linked}<span class="dot" title="Linked to a detailed document" aria-label="linked"></span>{/if}
	</button>

	{#if expanded}
		<div class="section-body">
			<p class="hint">
				Link this node to the document that elaborates it. The linked document's root node
				should reuse this node's id.
			</p>
			{#if !linked}
				<button type="button" class="create-btn" onclick={createLinkedDocument}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
						<line x1="12" y1="5" x2="12" y2="19" />
						<line x1="5" y1="12" x2="19" y2="12" />
					</svg>
					Create new linked document
				</button>
				<p class="sub-hint">Creates a detailed architecture for this node and links to it. Double-click the node to open it.</p>
			{:else if created}
				<p class="created">Linked document created — double-click the node on the canvas to open and edit it.</p>
			{/if}
			{#if loadedDocs.length > 0}
				<label class="field">
					<span class="field-label">Link to a loaded document</span>
					<select bind:value={detailedArch} onchange={commit}>
						<option value="">— choose a document opened this session —</option>
						{#each loadedDocs as d}
							<option value={d.ref}>{d.title} — {d.ref}</option>
						{/each}
					</select>
				</label>
			{/if}
			<label class="field">
				<span class="field-label">Detailed architecture {loadedDocs.length > 0 ? '(or paste a ref)' : ''}</span>
				<input
					type="text"
					bind:value={detailedArch}
					onchange={commit}
					onblur={commit}
					placeholder="https://… or path to the detailed CALM document"
					spellcheck="false"
				/>
				{#if linked}
					<span class="resolve" class:ok={resolved}>
						{resolved ? `Resolves → ${resolved.title}` : 'Not loaded in this session'}
					</span>
				{/if}
			</label>
			<label class="field">
				<span class="field-label">Required pattern</span>
				<input
					type="text"
					bind:value={requiredPattern}
					onchange={commit}
					onblur={commit}
					placeholder="https://… or path to the pattern it must conform to"
					spellcheck="false"
				/>
			</label>
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
		color: var(--color-text-secondary, #64748b);
		flex: 1;
	}
	:global(.dark) .section-label {
		color: #94a3b8;
	}
	.dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #6366f1;
	}
	.section-body {
		padding: 4px 12px 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.hint {
		font-size: 11px;
		color: var(--color-text-tertiary, #94a3b8);
		margin: 0;
		line-height: 1.5;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.field-label {
		font-size: 11px;
		font-weight: 600;
		color: var(--color-text-secondary, #64748b);
	}
	.field input,
	.field select {
		width: 100%;
		box-sizing: border-box;
		padding: 5px 8px;
		font-size: 12px;
		font-family: var(--font-mono, monospace);
		border: 1px solid var(--color-border, #e2e8f0);
		border-radius: 5px;
		background: var(--color-surface, #fff);
		color: var(--color-text-primary, #1e293b);
	}
	.field select {
		font-family: var(--font-sans);
	}
	:global(.dark) .field input,
	:global(.dark) .field select {
		background: #0f1320;
		border-color: #334155;
		color: #e2e8f0;
	}
	.field input:focus,
	.field select:focus {
		outline: 2px solid var(--color-accent, #6366f1);
		outline-offset: -1px;
	}
	.resolve {
		font-size: 10px;
		color: var(--color-text-tertiary, #94a3b8);
	}
	.resolve.ok {
		color: #16a34a;
	}
	.create-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		width: 100%;
		padding: 7px 10px;
		font-size: 12px;
		font-weight: 600;
		font-family: inherit;
		color: #fff;
		background: var(--color-accent, #6366f1);
		border: none;
		border-radius: 6px;
		cursor: pointer;
	}
	.create-btn:hover {
		filter: brightness(1.05);
	}
	.create-btn svg {
		width: 14px;
		height: 14px;
	}
	.sub-hint {
		font-size: 10px;
		color: var(--color-text-tertiary, #94a3b8);
		margin: 0;
		line-height: 1.4;
	}
	.created {
		font-size: 11px;
		color: #16a34a;
		margin: 0;
		line-height: 1.4;
	}
</style>
