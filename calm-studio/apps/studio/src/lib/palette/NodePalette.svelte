<!-- SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<script lang="ts">
	import { useDnD } from './DnDProvider.svelte';
	import { getAllPacks, initAllPacks } from '@calmstudio/extensions';
	import type { PackDefinition, NodeTypeEntry } from '@calmstudio/extensions';

	// Register all packs on import so they're available immediately
	initAllPacks();

	const dnd = useDnD();

	let { onplacenode }: { onplacenode?: (type: string) => void } = $props();

	let searchQuery = $state('');
	let showCustomInput = $state(false);
	let customTypeValue = $state('');

	// Track expand/collapse state per pack id. Core starts expanded; others collapsed.
	let expandedSections = $state<Record<string, boolean>>({ core: true });

	const allPacks = $derived(getAllPacks());

	/** Flat list of all nodes across all packs for search */
	interface SearchResult {
		node: NodeTypeEntry;
		pack: PackDefinition;
	}

	const searchResults = $derived((): SearchResult[] => {
		if (searchQuery.trim() === '') return [];
		const query = searchQuery.toLowerCase();
		const results: SearchResult[] = [];
		for (const pack of allPacks) {
			for (const node of pack.nodes) {
				if (
					node.label.toLowerCase().includes(query) ||
					node.typeId.toLowerCase().includes(query)
				) {
					results.push({ node, pack });
				}
			}
		}
		return results;
	});

	const isSearching = $derived(searchQuery.trim() !== '');

	function toggleSection(packId: string) {
		expandedSections = {
			...expandedSections,
			[packId]: !expandedSections[packId],
		};
	}

	function isSectionExpanded(packId: string): boolean {
		return expandedSections[packId] ?? false;
	}

	function handleDragStart(event: DragEvent, typeId: string) {
		if (!event.dataTransfer) return;
		event.dataTransfer.setData('application/calm-node-type', typeId);
		event.dataTransfer.effectAllowed = 'copy';
		dnd.setDragType(typeId);
	}

	function handleDragEnd() {
		dnd.setDragType(null);
	}

	function handleClick(typeId: string) {
		onplacenode?.(typeId);
	}

	function handleCustomKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			const trimmed = customTypeValue.trim();
			if (trimmed) {
				onplacenode?.(trimmed);
				customTypeValue = '';
				showCustomInput = false;
			}
		} else if (event.key === 'Escape') {
			showCustomInput = false;
			customTypeValue = '';
		}
	}
</script>

<aside class="palette" aria-label="CALM node palette">
	<!-- Header -->
	<div class="palette-header">
		<svg class="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
			<rect x="3" y="3" width="7" height="7" rx="1.5"/>
			<rect x="14" y="3" width="7" height="7" rx="1.5"/>
			<rect x="3" y="14" width="7" height="7" rx="1.5"/>
			<rect x="14" y="14" width="7" height="7" rx="1.5"/>
		</svg>
		<span class="header-label">Components</span>
	</div>

	<!-- Search -->
	<div class="search-wrapper">
		<div class="search-container">
			<svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
				<circle cx="11" cy="11" r="8" />
				<path d="m21 21-4.35-4.35" />
			</svg>
			<input
				type="search"
				placeholder="Search all packs..."
				bind:value={searchQuery}
				class="search-input"
				aria-label="Search node types"
			/>
		</div>
	</div>

	<!-- Main content: search results OR collapsible sections -->
	<div class="palette-body">
		{#if isSearching}
			<!-- Search results: flat list with pack badge attribution -->
			<ul class="palette-list" role="list" aria-label="Search results">
				{#each searchResults() as { node, pack } (node.typeId)}
					<li>
						<button
							type="button"
							draggable="true"
							ondragstart={(e) => handleDragStart(e, node.typeId)}
							ondragend={handleDragEnd}
							ondblclick={() => handleClick(node.typeId)}
							class="palette-item"
							aria-label="Drag or double-click to place {node.label} node"
							title={node.description ?? node.label}
						>
							<span class="item-icon" style="background: {node.color.border}20; color: {node.color.stroke};">
								{@html node.icon}
							</span>
							<span class="item-label">{node.label}</span>
							{#if pack.color.badge}
								<span class="pack-badge" style="color: {pack.color.stroke}; border-color: {pack.color.border}40;">
									{pack.color.badge}
								</span>
							{/if}
						</button>
					</li>
				{/each}

				{#if searchResults().length === 0}
					<li class="empty-state">
						No match for "{searchQuery}"
					</li>
				{/if}
			</ul>
		{:else}
			<!-- Collapsible pack sections -->
			{#each allPacks as pack (pack.id)}
				<div class="pack-section">
					<!-- Section header -->
					<button
						type="button"
						class="section-header"
						class:expanded={isSectionExpanded(pack.id)}
						onclick={() => toggleSection(pack.id)}
						aria-expanded={isSectionExpanded(pack.id)}
						aria-label="Toggle {pack.label} section"
						style="--pack-color: {pack.color.border};"
					>
						<svg
							class="chevron"
							class:rotated={isSectionExpanded(pack.id)}
							viewBox="0 0 16 16"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							aria-hidden="true"
						>
							<path d="M4 6l4 4 4-4" stroke-linecap="round" stroke-linejoin="round"/>
						</svg>
						<span class="section-label">{pack.label}</span>
						<span class="section-count">{pack.nodes.length}</span>
					</button>

					<!-- Section body -->
					{#if isSectionExpanded(pack.id)}
						<ul class="palette-list section-body" role="list" aria-label="{pack.label} nodes">
							{#each pack.nodes as node (node.typeId)}
								<li>
									<button
										type="button"
										draggable="true"
										ondragstart={(e) => handleDragStart(e, node.typeId)}
										ondragend={handleDragEnd}
										ondblclick={() => handleClick(node.typeId)}
										class="palette-item"
										aria-label="Drag or double-click to place {node.label} node"
										title={node.description ?? node.label}
									>
										<span class="item-icon" style="background: {node.color.border}20; color: {node.color.stroke};">
											{@html node.icon}
										</span>
										<span class="item-label">{node.label}</span>
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			{/each}
		{/if}
	</div>

	<!-- Custom node entry (always at bottom) -->
	<div class="palette-footer">
		{#if showCustomInput}
			<input
				type="text"
				placeholder="Enter type name..."
				bind:value={customTypeValue}
				onkeydown={handleCustomKeydown}
				class="custom-input"
				aria-label="Custom node type input"
				autofocus
			/>
			<p class="custom-hint">
				Enter to place &middot; Esc to cancel
			</p>
		{:else}
			<button
				type="button"
				onclick={() => (showCustomInput = true)}
				class="custom-btn"
				aria-label="Create a custom node type"
			>
				<span class="custom-icon">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
						<line x1="12" y1="5" x2="12" y2="19" />
						<line x1="5" y1="12" x2="19" y2="12" />
					</svg>
				</span>
				<span class="item-label">Custom...</span>
			</button>
		{/if}
	</div>
</aside>

<style>
	.palette {
		display: flex;
		flex-direction: column;
		width: 100%;
		max-width: 280px;
		height: 100%;
		flex-shrink: 0;
		background: var(--color-surface);
		border-right: 1px solid var(--color-border);
		font-family: var(--font-sans);
	}

	:global(.dark) .palette {
		background: #0f1320;
		border-color: #1e293b;
	}

	/* Header */
	.palette-header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 14px 16px;
		border-bottom: 1px solid var(--color-border);
		flex-shrink: 0;
	}

	:global(.dark) .palette-header {
		border-color: #1e293b;
	}

	.header-icon {
		width: 15px;
		height: 15px;
		color: var(--color-accent);
	}

	:global(.dark) .header-icon {
		color: #818cf8;
	}

	.header-label {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--color-text-tertiary);
	}

	:global(.dark) .header-label {
		color: #64748b;
	}

	/* Search */
	.search-wrapper {
		padding: 10px 12px;
		flex-shrink: 0;
	}

	.search-container {
		position: relative;
	}

	.search-icon {
		position: absolute;
		left: 10px;
		top: 50%;
		transform: translateY(-50%);
		width: 14px;
		height: 14px;
		color: var(--color-text-tertiary);
		pointer-events: none;
	}

	.search-input {
		width: 100%;
		padding: 7px 12px 7px 32px;
		font-size: 12px;
		font-family: inherit;
		color: var(--color-text-primary);
		background: var(--color-surface-secondary);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		outline: none;
		transition: all 0.15s ease;
		box-sizing: border-box;
	}

	.search-input::placeholder {
		color: var(--color-text-tertiary);
	}

	.search-input:focus {
		border-color: var(--color-accent);
		box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.12);
	}

	:global(.dark) .search-input {
		background: #1e293b;
		border-color: #334155;
		color: #e2e8f0;
	}

	:global(.dark) .search-input::placeholder {
		color: #64748b;
	}

	:global(.dark) .search-input:focus {
		border-color: #818cf8;
		box-shadow: 0 0 0 2px rgba(129, 140, 248, 0.15);
	}

	/* Scrollable body */
	.palette-body {
		flex: 1;
		overflow-y: auto;
	}

	/* Palette list */
	.palette-list {
		padding: 4px 8px;
		margin: 0;
		list-style: none;
	}

	.section-body {
		padding-top: 2px;
		padding-bottom: 4px;
	}

	.palette-item {
		display: flex;
		width: 100%;
		align-items: center;
		gap: 10px;
		padding: 7px 10px;
		border: none;
		background: transparent;
		border-radius: 8px;
		cursor: grab;
		text-align: left;
		font-family: inherit;
		transition: all 0.15s ease;
	}

	.palette-item:hover {
		background: var(--color-surface-tertiary);
	}

	.palette-item:active {
		cursor: grabbing;
	}

	:global(.dark) .palette-item:hover {
		background: #1e293b;
	}

	.item-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		border-radius: 7px;
		flex-shrink: 0;
		transition: all 0.15s ease;
	}

	:global(.dark) .item-icon {
		background: rgba(255, 255, 255, 0.06) !important;
	}

	.item-label {
		font-size: 12.5px;
		font-weight: 500;
		color: var(--color-text-secondary);
		transition: color 0.15s ease;
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.palette-item:hover .item-label {
		color: var(--color-text-primary);
	}

	:global(.dark) .item-label {
		color: #94a3b8;
	}

	:global(.dark) .palette-item:hover .item-label {
		color: #e2e8f0;
	}

	/* Pack badge in search results */
	.pack-badge {
		font-size: 9px;
		font-weight: 600;
		padding: 1px 4px;
		border-radius: 3px;
		border: 1px solid;
		flex-shrink: 0;
		white-space: nowrap;
	}

	.empty-state {
		padding: 20px 12px;
		text-align: center;
		font-size: 12px;
		color: var(--color-text-tertiary);
	}

	/* Pack section headers */
	.pack-section {
		border-bottom: 1px solid var(--color-border);
	}

	.pack-section:last-child {
		border-bottom: none;
	}

	:global(.dark) .pack-section {
		border-color: #1e293b;
	}

	.section-header {
		display: flex;
		width: 100%;
		align-items: center;
		gap: 6px;
		padding: 8px 12px;
		border: none;
		background: transparent;
		cursor: pointer;
		font-family: inherit;
		transition: background 0.15s ease;
		border-left: 2.5px solid var(--pack-color, var(--color-border));
		box-sizing: border-box;
	}

	.section-header:hover {
		background: var(--color-surface-secondary);
	}

	:global(.dark) .section-header:hover {
		background: #1a2235;
	}

	.chevron {
		width: 12px;
		height: 12px;
		color: var(--color-text-tertiary);
		flex-shrink: 0;
		transition: transform 0.2s ease;
	}

	.chevron.rotated {
		transform: rotate(180deg);
	}

	:global(.dark) .chevron {
		color: #64748b;
	}

	.section-label {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text-secondary);
		flex: 1;
		text-align: left;
	}

	:global(.dark) .section-label {
		color: #94a3b8;
	}

	.section-count {
		font-size: 10px;
		font-weight: 500;
		color: var(--color-text-tertiary);
		background: var(--color-surface-secondary);
		border-radius: 10px;
		padding: 1px 6px;
	}

	:global(.dark) .section-count {
		color: #64748b;
		background: #1e293b;
	}

	/* Footer */
	.palette-footer {
		padding: 8px;
		border-top: 1px solid var(--color-border);
		flex-shrink: 0;
	}

	:global(.dark) .palette-footer {
		border-color: #1e293b;
	}

	.custom-btn {
		display: flex;
		width: 100%;
		align-items: center;
		gap: 10px;
		padding: 7px 10px;
		border: none;
		background: transparent;
		border-radius: 8px;
		cursor: pointer;
		font-family: inherit;
		transition: all 0.15s ease;
	}

	.custom-btn:hover {
		background: var(--color-accent-subtle);
	}

	.custom-btn:hover .item-label {
		color: var(--color-accent);
	}

	:global(.dark) .custom-btn:hover {
		background: rgba(129, 140, 248, 0.08);
	}

	:global(.dark) .custom-btn:hover .item-label {
		color: #818cf8;
	}

	.custom-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		border-radius: 7px;
		border: 1.5px dashed var(--color-border);
		color: var(--color-text-tertiary);
		flex-shrink: 0;
	}

	:global(.dark) .custom-icon {
		border-color: #334155;
		color: #64748b;
	}

	.custom-input {
		width: 100%;
		padding: 8px 12px;
		font-size: 12px;
		font-family: inherit;
		color: var(--color-text-primary);
		background: var(--color-surface);
		border: 1.5px solid var(--color-accent);
		border-radius: 8px;
		outline: none;
		box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.12);
		box-sizing: border-box;
	}

	:global(.dark) .custom-input {
		background: #1e293b;
		border-color: #818cf8;
		color: #e2e8f0;
		box-shadow: 0 0 0 2px rgba(129, 140, 248, 0.15);
	}

	.custom-hint {
		margin: 6px 0 0;
		text-align: center;
		font-size: 10px;
		color: var(--color-text-tertiary);
	}
</style>
