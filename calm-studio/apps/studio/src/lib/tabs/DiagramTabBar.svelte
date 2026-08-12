<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script lang="ts">
	import type { DiagramTabState } from './tabManager';
	import type { BulkCloseMode } from './bulkClose';

	let {
		tabs,
		activeTabId,
		isTabDirty,
		onactivate,
		onclose,
		onnew,
		onbulkclose,
	}: {
		tabs: DiagramTabState[];
		activeTabId: string | null;
		isTabDirty: (tab: DiagramTabState) => boolean;
		onactivate: (tabId: string) => void;
		onclose: (tabId: string) => void;
		onnew: () => void;
		onbulkclose?: (tabId: string, mode: BulkCloseMode) => void;
	} = $props();

	let menu = $state<{ tabId: string; x: number; y: number } | null>(null);

	function openMenu(event: MouseEvent, tabId: string) {
		event.preventDefault();
		menu = { tabId, x: event.clientX, y: event.clientY };
	}

	function closeMenu() {
		menu = null;
	}

	function runBulk(mode: BulkCloseMode) {
		if (!menu) return;
		const tabId = menu.tabId;
		closeMenu();
		onbulkclose?.(tabId, mode);
	}

	function runClose() {
		if (!menu) return;
		const tabId = menu.tabId;
		closeMenu();
		onclose(tabId);
	}

	function handleWindowClick() {
		if (menu) closeMenu();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && menu) closeMenu();
	}

	const menuTabIndex = $derived(menu ? tabs.findIndex((t) => t.id === menu!.tabId) : -1);
	const canCloseLeft = $derived(menuTabIndex > 0);
	const canCloseRight = $derived(menuTabIndex >= 0 && menuTabIndex < tabs.length - 1);
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleKeydown} />

{#if tabs.length > 0}
	<div class="tab-bar" role="tablist" aria-label="Diagram tabs">
		{#each tabs as tab (tab.id)}
			<div
				class="tab"
				class:active={tab.id === activeTabId}
				class:dirty={isTabDirty(tab)}
				role="tab"
				aria-selected={tab.id === activeTabId}
				tabindex={tab.id === activeTabId ? 0 : -1}
				oncontextmenu={(e) => openMenu(e, tab.id)}
			>
				<button type="button" class="tab-label" onclick={() => onactivate(tab.id)}>
					{tab.label}{isTabDirty(tab) ? ' •' : ''}
				</button>
				<button
					type="button"
					class="tab-close"
					aria-label={`Close ${tab.label}`}
					onclick={() => onclose(tab.id)}
				>×</button>
			</div>
		{/each}
		<button type="button" class="tab-new" aria-label="New diagram tab" onclick={onnew}>+</button>
	</div>
{/if}

{#if menu}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div
		class="ctx-menu"
		style:left={`${menu.x}px`}
		style:top={`${menu.y}px`}
		role="menu"
		tabindex="-1"
		onclick={(e) => e.stopPropagation()}
	>
		<button type="button" class="ctx-item" role="menuitem" onclick={runClose}>Close</button>
		<button
			type="button"
			class="ctx-item"
			role="menuitem"
			disabled={!canCloseLeft}
			onclick={() => runBulk('left')}
		>
			Close tabs to the left
		</button>
		<button
			type="button"
			class="ctx-item"
			role="menuitem"
			disabled={!canCloseRight}
			onclick={() => runBulk('right')}
		>
			Close tabs to the right
		</button>
		<button type="button" class="ctx-item" role="menuitem" onclick={() => runBulk('all')}>
			Close all
		</button>
	</div>
{/if}

<style>
	.tab-bar {
		display: flex;
		align-items: stretch;
		gap: 2px;
		padding: 0 8px;
		min-height: 32px;
		background: var(--toolbar-bg, #f8fafc);
		border-bottom: 1px solid var(--border, #e2e8f0);
		overflow-x: auto;
	}
	.tab {
		display: flex;
		align-items: center;
		max-width: 200px;
		border: 1px solid transparent;
		border-bottom: none;
		border-radius: 6px 6px 0 0;
		background: transparent;
	}
	.tab.active {
		background: var(--surface, #fff);
		border-color: var(--border, #e2e8f0);
	}
	.tab-label {
		padding: 6px 8px 6px 12px;
		border: none;
		background: transparent;
		font-size: 12px;
		cursor: pointer;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 160px;
	}
	.tab.dirty .tab-label {
		font-style: italic;
	}
	.tab-close {
		padding: 4px 8px 4px 0;
		border: none;
		background: transparent;
		font-size: 14px;
		line-height: 1;
		cursor: pointer;
		color: var(--text-muted, #64748b);
	}
	.tab-close:hover {
		color: var(--text, #0f172a);
	}
	.tab-new {
		margin-left: 4px;
		padding: 4px 10px;
		border: 1px dashed var(--border, #cbd5e1);
		border-radius: 6px;
		background: transparent;
		cursor: pointer;
		font-size: 14px;
		align-self: center;
	}
	.ctx-menu {
		position: fixed;
		z-index: 11000;
		min-width: 200px;
		padding: 4px;
		border-radius: 8px;
		background: #fff;
		border: 1px solid var(--border, #e2e8f0);
		box-shadow: 0 10px 24px rgba(15, 23, 42, 0.16);
	}
	.ctx-item {
		display: block;
		width: 100%;
		text-align: left;
		padding: 7px 10px;
		border: none;
		border-radius: 6px;
		background: transparent;
		font-size: 12px;
		cursor: pointer;
	}
	.ctx-item:hover:not(:disabled) {
		background: #f1f5f9;
	}
	.ctx-item:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
</style>
