<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<!--
  GovernanceView.svelte — the connected AIGF↔CCC governance panel for a node.
  Shows incorporated guidance (recommended-first for the node-type), and under
  each guideline the CCC controls that satisfy it (canonical control.guidelines
  link) with their assessment-requirements. "Attest implemented" writes a CALM
  controls entry on the node.
-->
<script lang="ts">
	import {
		attestControlOnNode,
		unattestControlOnNode,
		isControlAttestedOnNode,
		upsertDecorator,
		removeDecoratorFromElement,
		getModel,
	} from '$lib/stores/calmModel.svelte';
	import {
		aigfGuidanceProvider,
		buildGemaraDecorator,
		mergeDecoratorAppliesTo,
		gemaraLinksForElement,
		GEMARA_ARCHITECTURE_SCOPE,
		type GemaraArtifactKind,
		type GemaraLink,
		type CalmDecorator,
	} from '@calmstudio/calm-core';
	import GemaraCatalogPicker from '$lib/properties/GemaraCatalogPicker.svelte';
	import { loadGovernance } from './loadGovernance';
	import { SHOW_VERIFICATION_STATUS } from './verification';
	import { rootSystemNodeId, elementScopeChain } from './scope';
	import type { GovernanceControl, GovernanceView } from './governanceModel';

	/** Default CCC control catalog applied alongside AIGF guidance (the MARefArch). */
	const DEFAULT_CONTROL_CATALOG = {
		namespace: 'finos-ccc',
		catalogId: 'ccc.marefarc.cn',
		version: 'v2026.06-rc1',
		hubUrl: 'https://hub.grc.store',
	};

	let {
		elementId,
		nodeType,
		onmutate,
		onBeforeEdit,
	}: {
		elementId: string;
		nodeType: string | null;
		onmutate?: () => void;
		/** Pushes an undo snapshot — called before each governance mutation. */
		onBeforeEdit?: () => void;
	} = $props();

	let view = $state<GovernanceView | null>(null);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let expanded = $state<Set<string>>(new Set());
	let expandedCatalogs = $state<Set<string>>(new Set());
	let reqToken = 0;

	/** The document's top-level system node — the target for whole-system bindings. */
	const systemNodeId = $derived(rootSystemNodeId(getModel()));
	/** True when viewing a specific node (so "this node" scope differs from the system). */
	const canScopeToNode = $derived(
		elementId !== GEMARA_ARCHITECTURE_SCOPE && elementId !== '' && elementId !== systemNodeId,
	);
	/** Scope a newly-added reference applies to. Defaults to the node in view. */
	let addScope = $state<'node' | 'system'>('node');
	const pickerElementId = $derived(
		addScope === 'system' || !canScopeToNode ? (systemNodeId ?? elementId) : elementId,
	);

	/** A reference's scope, for the panel label. */
	function scopeOf(link: GemaraLink): 'this node' | 'system' | 'architecture' {
		if (canScopeToNode && link.appliesTo.includes(elementId)) return 'this node';
		if (link.appliesTo.includes(GEMARA_ARCHITECTURE_SCOPE)) return 'architecture';
		return 'system';
	}

	// References governing this element: its own + inherited from containing systems.
	const attachedLinks = $derived.by<GemaraLink[]>(() => {
		const arch = getModel();
		const ids =
			elementId === GEMARA_ARCHITECTURE_SCOPE
				? [GEMARA_ARCHITECTURE_SCOPE]
				: [...elementScopeChain(arch, elementId), GEMARA_ARCHITECTURE_SCOPE];
		const seen = new Set<string>();
		const out: GemaraLink[] = [];
		for (const id of ids) {
			for (const l of gemaraLinksForElement(arch.decorators, id)) {
				if (!seen.has(l.uniqueId)) {
					seen.add(l.uniqueId);
					out.push(l);
				}
			}
		}
		return out;
	});
	const controlLinks = $derived(attachedLinks.filter((l) => l.artifact === 'requirements'));
	const guidanceLinkById = $derived(
		new Map(attachedLinks.filter((l) => l.artifact === 'guidance').map((l) => [l.catalog.id, l])),
	);

	// Add-reference picker state.
	let pickerArtifact = $state<GemaraArtifactKind | null>(null);
	let addMenuOpen = $state(false);

	$effect(() => {
		const eid = elementId;
		const nt = nodeType;
		void getModel().decorators; // re-load when incorporated catalogs change
		const token = ++reqToken;
		loading = true;
		error = null;
		loadGovernance(eid, nt)
			.then((v) => {
				if (token === reqToken) view = v;
			})
			.catch((e) => {
				if (token === reqToken) error = e instanceof Error ? e.message : String(e);
			})
			.finally(() => {
				if (token === reqToken) loading = false;
			});
	});

	function applyDefaultGovernance() {
		onBeforeEdit?.();
		// Whole-system bundle → attach to the top-level system node (a real element).
		const target = systemNodeId ?? elementId ?? GEMARA_ARCHITECTURE_SCOPE;
		upsertDecorator(
			buildGemaraDecorator({
				artifact: 'guidance',
				kind: 'catalog',
				catalogRef: aigfGuidanceProvider.catalogRef,
				appliesTo: [target],
			}),
		);
		upsertDecorator(
			buildGemaraDecorator({
				artifact: 'requirements',
				kind: 'catalog',
				catalogRef: DEFAULT_CONTROL_CATALOG,
				appliesTo: [target],
			}),
		);
		onmutate?.();
	}

	function chooseAdd(artifact: GemaraArtifactKind) {
		addMenuOpen = false;
		pickerArtifact = artifact;
	}

	function handleAttached(decorators: CalmDecorator[]) {
		onBeforeEdit?.();
		const existing = getModel().decorators ?? [];
		for (const d of decorators) {
			const prior = existing.find((e) => e['unique-id'] === d['unique-id']);
			upsertDecorator(mergeDecoratorAppliesTo(prior, d));
		}
		pickerArtifact = null;
		onmutate?.();
	}

	/**
	 * Remove a catalog reference from the ONE scope this panel represents — not
	 * every scope it covers. Removing a binding that's inherited from a wider
	 * system (so it governs other nodes too) asks first, since it isn't undoable.
	 */
	function removeCatalog(link: GemaraLink) {
		const chain = elementScopeChain(getModel(), elementId);
		const scope =
			(canScopeToNode && link.appliesTo.includes(elementId) ? elementId : '') ||
			link.appliesTo.find((id) => chain.includes(id)) ||
			(link.appliesTo.includes(GEMARA_ARCHITECTURE_SCOPE) ? GEMARA_ARCHITECTURE_SCOPE : link.appliesTo[0]);
		if (!scope) return;
		// Inherited binding (lives on a containing system / arch) → removing it affects other nodes.
		if (
			canScopeToNode &&
			scope !== elementId &&
			!confirm('This reference is inherited from the wider system and governs other nodes too. Remove it for the whole system?')
		) {
			return;
		}
		onBeforeEdit?.();
		removeDecoratorFromElement(link.uniqueId, scope);
		onmutate?.();
	}

	function toggle(id: string) {
		const next = new Set(expanded);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		expanded = next;
	}

	function toggleCatalog(id: string) {
		const next = new Set(expandedCatalogs);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		expandedCatalogs = next;
	}

	function toggleAttest(gc: GovernanceControl, guidelineId: string) {
		onBeforeEdit?.();
		const id = gc.control.id;
		if (isControlAttestedOnNode(elementId, id)) {
			unattestControlOnNode(elementId, id);
		} else {
			attestControlOnNode(elementId, {
				controlId: id,
				guidelineId,
				requirementUrl: gc.citationUrl ?? `grc.store:${gc.catalogId}`,
				...(gc.control.title ? { name: gc.control.title } : {}),
			});
		}
		onmutate?.();
	}
</script>

<div class="gov">
	<!-- Add Reference — pinned at top so attaching multiple catalogs is obvious. -->
	<div class="gov-top">
		<div class="add-wrap">
			<button class="add-ref" onclick={() => (addMenuOpen = !addMenuOpen)} aria-expanded={addMenuOpen} disabled={!onmutate}>
				<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
					<line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
				</svg>
				Add Reference
			</button>
			{#if addMenuOpen}
				<div class="add-menu" role="menu">
					{#if canScopeToNode}
						<div class="scope-toggle" role="group" aria-label="Apply reference to">
							<span class="scope-cap">Apply to</span>
							<button class:on={addScope === 'node'} onclick={() => (addScope = 'node')}>This node</button>
							<button class:on={addScope === 'system'} onclick={() => (addScope = 'system')}>Whole system</button>
						</div>
					{/if}
					<button role="menuitem" onclick={() => chooseAdd('guidance')}>Guidance catalog <span>e.g. AIGF, NIST 800-53</span></button>
					<button role="menuitem" onclick={() => chooseAdd('requirements')}>Control catalog <span>e.g. CCC, CCC.ObjStor.CN</span></button>
				</div>
			{/if}
		</div>
		{#if view && view.guidanceCatalogs.length > 0}
			<span class="overall" title="Guidelines with a satisfying control, across all guidance catalogs">
				{view.coverage.withControls}/{view.coverage.total} with controls
			</span>
		{/if}
	</div>

	<!-- Attached control catalogs (the satisfying layer) as provenance chips. -->
	{#if controlLinks.length > 0}
		<div class="chips">
			{#each controlLinks as link (link.uniqueId)}
				<span class="chip">
					<span class="chip-label" title={link.catalog.id}>{link.catalog.title ?? link.catalog.id}</span>
					<span class="scope-tag" title="Applies to">{scopeOf(link)}</span>
					{#if SHOW_VERIFICATION_STATUS && !link.verified}<span class="chip-flag" title="Fetched without provenance verification">unverified</span>{/if}
					{#if onmutate}
						<button class="chip-x" onclick={() => removeCatalog(link)} aria-label="Remove control catalog {link.catalog.id}" title="Remove">✕</button>
					{/if}
				</span>
			{/each}
		</div>
	{/if}

	{#if loading && !view}
		<p class="hint">Loading governance…</p>
	{:else if error}
		<p class="err" role="alert">{error}</p>
	{:else if !view || view.guidanceCatalogs.length === 0}
		<p class="hint">
			No guidance attached yet. Use <strong>Add Reference</strong>, or start with the FINOS
			bundle — AIGF guidance + the CCC controls that satisfy it, joined automatically.
		</p>
		<button class="apply" onclick={applyDefaultGovernance} disabled={!onmutate}>Apply governance (AIGF + CCC MARefArch)</button>
	{:else}
		<!-- One collapsible group per guidance catalog (the folding unit). -->
		{#each view.guidanceCatalogs as cat (cat.id)}
			{@const link = guidanceLinkById.get(cat.id)}
			<div class="cat">
				<div class="cat-head">
					<button class="cat-toggle" onclick={() => toggleCatalog(cat.id)} aria-expanded={expandedCatalogs.has(cat.id)}>
						<span class="chevron" class:open={expandedCatalogs.has(cat.id)}>▸</span>
						<span class="cat-main">
							<span class="cat-title">{cat.title}</span>
							<span class="cat-sub">
								{#if link}{scopeOf(link)} · {/if}{cat.coverage.withControls}/{cat.coverage.total} with controls{#if link && SHOW_VERIFICATION_STATUS && !link.verified} · unverified{/if}
							</span>
						</span>
					</button>
					{#if link && onmutate}
						<button class="cat-x" onclick={() => removeCatalog(link)} aria-label="Remove guidance catalog {cat.title}" title="Remove">✕</button>
					{/if}
				</div>
				{#if expandedCatalogs.has(cat.id)}
					<div class="g-list">
						{#each cat.guidelines as g (g.guideline.id)}
							<div class="g-item">
								<button class="g-head" onclick={() => toggle(g.guideline.id)} aria-expanded={expanded.has(g.guideline.id)}>
									<span class="chevron" class:open={expanded.has(g.guideline.id)}>▸</span>
									<span class="g-title">{g.guideline.title ?? g.guideline.id}</span>
									{#if g.recommended}<span class="rec">recommended</span>{/if}
									<span class="g-count">{g.controls.length}</span>
								</button>
								{#if expanded.has(g.guideline.id)}
									<div class="g-body">
										<div class="g-id">{g.guideline.id}{g.guideline.objective ? ` — ${g.guideline.objective}` : ''}</div>
										{#if g.controls.length === 0}
											<p class="hint sm">No incorporated control satisfies this guideline yet.</p>
										{:else}
											{#each g.controls as gc (gc.catalogId + gc.control.id)}
												{@const attested = isControlAttestedOnNode(elementId, gc.control.id)}
												<div class="ctrl" class:attested>
													<label class="ctrl-check" title="Marks {gc.control.id} implemented on the selected node ({elementId})">
														<input
															type="checkbox"
															checked={attested}
															disabled={!onmutate}
															onchange={() => toggleAttest(gc, g.guideline.id)}
															aria-label="Mark control {gc.control.id} implemented on this node"
														/>
														<span class="ctrl-main">
															<span class="ctrl-id">{gc.control.id}</span>
															{#if gc.control.title}<span class="ctrl-title">{gc.control.title}</span>{/if}
														</span>
													</label>
													{#if gc.control.assessmentRequirements?.length}
														<ul class="ars">
															{#each gc.control.assessmentRequirements as ar (ar.id)}
																<li><span class="ar-id">{ar.id}</span> {ar.text ?? ''}</li>
															{/each}
														</ul>
													{/if}
												</div>
											{/each}
										{/if}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/each}
	{/if}
</div>

{#if pickerArtifact}
	<GemaraCatalogPicker
		elementId={pickerElementId}
		artifact={pickerArtifact}
		onbind={handleAttached}
		oncancel={() => (pickerArtifact = null)}
	/>
{/if}

<style>
	.gov {
		padding: 10px 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	/* ─── Add Reference header ─────────────────────────────────────── */
	.gov-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding-bottom: 6px;
		border-bottom: 1px solid var(--color-border, #e2e8f0);
	}
	:global(.dark) .gov-top {
		border-color: #1e293b;
	}
	.add-wrap {
		position: relative;
	}
	.add-ref {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 12px;
		font-weight: 600;
		padding: 5px 10px;
		border-radius: 6px;
		border: 1px solid var(--color-accent, #6366f1);
		background: none;
		color: var(--color-accent, #6366f1);
		cursor: pointer;
	}
	.add-ref:hover:not(:disabled) {
		background: rgba(99, 102, 241, 0.08);
	}
	.add-ref:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	:global(.dark) .add-ref {
		color: #818cf8;
		border-color: #818cf8;
	}
	.add-menu {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		z-index: 20;
		display: flex;
		flex-direction: column;
		/* Size to content so nothing wraps to one word per line. */
		width: max-content;
		max-width: 320px;
		background: var(--color-surface, #fff);
		border: 1px solid var(--color-border, #e2e8f0);
		border-radius: 7px;
		box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
		overflow: hidden;
	}
	:global(.dark) .add-menu {
		background: #111827;
		border-color: #334155;
	}
	.add-menu button {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 1px;
		padding: 7px 12px;
		font-size: 12px;
		font-weight: 600;
		background: none;
		border: none;
		text-align: left;
		white-space: nowrap;
		cursor: pointer;
		color: var(--color-text-primary, #1e293b);
	}
	.add-menu button:hover {
		background: var(--color-surface-secondary, #f8fafc);
	}
	:global(.dark) .add-menu button {
		color: #e2e8f0;
	}
	:global(.dark) .add-menu button:hover {
		background: #0f172a;
	}
	.add-menu button span {
		font-size: 10px;
		font-weight: 400;
		color: var(--color-text-tertiary, #94a3b8);
	}
	/* Scope toggle inside the Add menu */
	.scope-toggle {
		display: flex;
		align-items: center;
		flex-wrap: nowrap;
		gap: 4px;
		padding: 7px 12px;
		border-bottom: 1px solid var(--color-border, #e2e8f0);
	}
	:global(.dark) .scope-toggle {
		border-color: #1e293b;
	}
	.scope-cap {
		font-size: 10px;
		color: var(--color-text-tertiary, #94a3b8);
		margin-right: 2px;
		white-space: nowrap;
		flex-shrink: 0;
	}
	.scope-toggle button {
		flex-direction: row;
		flex-shrink: 0;
		padding: 2px 8px;
		font-size: 11px;
		font-weight: 600;
		white-space: nowrap;
		border: 1px solid var(--color-border, #e2e8f0);
		border-radius: 5px;
		color: var(--color-text-secondary, #64748b);
		background: none;
	}
	.scope-toggle button.on {
		background: var(--color-accent, #6366f1);
		border-color: var(--color-accent, #6366f1);
		color: #fff;
	}
	/* Scope tag on each reference (chip + catalog header) */
	.scope-tag {
		font-size: 9px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: var(--color-text-tertiary, #94a3b8);
		background: var(--color-surface, #fff);
		border: 1px solid var(--color-border, #e2e8f0);
		padding: 0 5px;
		border-radius: 4px;
		white-space: nowrap;
		flex-shrink: 0;
	}
	:global(.dark) .scope-tag {
		background: #0b1220;
		border-color: #334155;
		color: #94a3b8;
	}
	.overall {
		font-size: 11px;
		font-weight: 600;
		color: var(--color-accent, #6366f1);
		white-space: nowrap;
	}
	/* ─── Control catalog chips ────────────────────────────────────── */
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 2px 4px 2px 8px;
		font-size: 11px;
		border-radius: 12px;
		background: var(--color-surface-secondary, #f1f5f9);
		color: var(--color-text-secondary, #475569);
	}
	:global(.dark) .chip {
		background: #1e293b;
		color: #cbd5e1;
	}
	.chip-label {
		max-width: 160px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.chip-flag {
		font-size: 8px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #b45309;
		background: rgba(180, 83, 9, 0.12);
		padding: 1px 4px;
		border-radius: 4px;
	}
	:global(.dark) .chip-flag {
		color: #fbbf24;
		background: rgba(251, 191, 36, 0.12);
	}
	.chip-x,
	.cat-x {
		width: 16px;
		height: 16px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 10px;
		background: none;
		border: none;
		cursor: pointer;
		color: var(--color-text-tertiary, #94a3b8);
		border-radius: 4px;
		flex-shrink: 0;
	}
	.chip-x:hover,
	.cat-x:hover {
		color: #ef4444;
		background: rgba(239, 68, 68, 0.08);
	}
	/* ─── Guidance catalog group ───────────────────────────────────── */
	.cat {
		border: 1px solid var(--color-border, #e2e8f0);
		border-radius: 6px;
		overflow: hidden;
	}
	:global(.dark) .cat {
		border-color: #334155;
	}
	.cat-head {
		display: flex;
		align-items: center;
		background: var(--color-surface-secondary, #f1f5f9);
	}
	:global(.dark) .cat-head {
		background: #0f1320;
	}
	.cat-toggle {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: flex-start;
		gap: 6px;
		padding: 8px;
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
	}
	.cat-toggle .chevron {
		margin-top: 2px;
	}
	.cat-main {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}
	.cat-title {
		font-size: 12px;
		font-weight: 700;
		color: var(--color-text-primary, #1e293b);
		line-height: 1.25;
	}
	:global(.dark) .cat-title {
		color: #f1f5f9;
	}
	.cat-sub {
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.02em;
		color: var(--color-accent, #6366f1);
	}
	.cat-x {
		margin: 6px 6px 0 0;
		align-self: flex-start;
	}
	.apply {
		align-self: flex-start;
		font-size: 12px;
		font-weight: 600;
		padding: 6px 12px;
		border-radius: 6px;
		border: none;
		background: var(--color-accent, #6366f1);
		color: #fff;
		cursor: pointer;
	}
	.apply:hover:not(:disabled) {
		filter: brightness(1.05);
	}
	.apply:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.hint {
		font-size: 12px;
		color: var(--color-text-secondary, #64748b);
		margin: 0;
		line-height: 1.5;
	}
	.hint.sm {
		font-size: 11px;
		font-style: italic;
	}
	.err {
		font-size: 12px;
		color: #ef4444;
		margin: 0;
	}
	.g-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 6px;
	}
	.g-item {
		border: 1px solid var(--color-border, #e2e8f0);
		border-radius: 6px;
		overflow: hidden;
	}
	:global(.dark) .g-item {
		border-color: #334155;
	}
	.g-head {
		display: flex;
		align-items: center;
		gap: 6px;
		width: 100%;
		padding: 7px 8px;
		background: var(--color-surface-secondary, #f8fafc);
		border: none;
		cursor: pointer;
		text-align: left;
	}
	:global(.dark) .g-head {
		background: #0f1320;
	}
	.chevron {
		color: var(--color-text-tertiary, #94a3b8);
		transition: transform 0.15s;
		font-size: 10px;
	}
	.chevron.open {
		transform: rotate(90deg);
	}
	.g-title {
		flex: 1;
		font-size: 12px;
		font-weight: 600;
		color: var(--color-text-primary, #1e293b);
		line-height: 1.3;
		overflow: hidden;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
	}
	.g-head {
		align-items: flex-start;
	}
	.g-head .chevron {
		margin-top: 2px;
	}
	:global(.dark) .g-title {
		color: #e2e8f0;
	}
	.rec {
		font-size: 9px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #6366f1;
		background: rgba(99, 102, 241, 0.12);
		padding: 1px 5px;
		border-radius: 4px;
	}
	.g-count {
		min-width: 18px;
		height: 18px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 10px;
		font-weight: 600;
		border-radius: 9px;
		background: var(--color-surface, #fff);
		color: var(--color-text-secondary, #64748b);
		border: 1px solid var(--color-border, #e2e8f0);
	}
	.g-body {
		padding: 8px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		background: var(--color-surface, #fff);
	}
	:global(.dark) .g-body {
		background: #111827;
	}
	.g-id {
		font-size: 10px;
		color: var(--color-text-tertiary, #94a3b8);
		line-height: 1.4;
	}
	/* Each control is a checklist item; the checkbox is the attest toggle. */
	.ctrl {
		border-left: 2px solid var(--color-border, #e2e8f0);
		padding-left: 8px;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.ctrl.attested {
		border-left-color: #16a34a;
	}
	.ctrl-check {
		display: flex;
		align-items: flex-start;
		gap: 7px;
		cursor: pointer;
	}
	.ctrl-check input {
		margin: 1px 0 0;
		width: 15px;
		height: 15px;
		flex-shrink: 0;
		accent-color: #16a34a;
		cursor: pointer;
	}
	.ctrl-check input:disabled {
		cursor: default;
		opacity: 0.5;
	}
	.ctrl-main {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}
	.ctrl-id {
		font-family: var(--font-mono, monospace);
		font-size: 11px;
		font-weight: 600;
		color: var(--color-text-primary, #1e293b);
		word-break: break-word;
	}
	:global(.dark) .ctrl-id {
		color: #e2e8f0;
	}
	.ctrl.attested .ctrl-id {
		color: #16a34a;
	}
	.ctrl-title {
		font-size: 11px;
		color: var(--color-text-secondary, #64748b);
		line-height: 1.35;
	}
	.ars {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.ars li {
		font-size: 10px;
		color: var(--color-text-secondary, #64748b);
		line-height: 1.4;
	}
	.ar-id {
		font-family: var(--font-mono, monospace);
		font-weight: 600;
		color: var(--color-text-tertiary, #94a3b8);
	}
</style>
