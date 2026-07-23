<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script lang="ts">
	import type { DiagramTabState } from './tabManager';

	let {
		tabs,
		activeTabId,
		isTabDirty,
		onactivate,
		onclose,
		onnew,
	}: {
		tabs: DiagramTabState[];
		activeTabId: string | null;
		isTabDirty: (tab: DiagramTabState) => boolean;
		onactivate: (tabId: string) => void;
		onclose: (tabId: string) => void;
		onnew: () => void;
	} = $props();
</script>

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
</style>
