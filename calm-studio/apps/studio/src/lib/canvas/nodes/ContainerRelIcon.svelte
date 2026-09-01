<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script lang="ts">
	import { getContext, onDestroy } from 'svelte';

	export type ContainmentRelSummary = {
		uniqueId: string;
		name: string;
		variant: 'composed-of' | 'deployed-in';
	};

	type ContainmentSelectContext = {
		onSelect: (relUniqueId: string) => void;
	};

	let {
		rels = [],
	}: {
		rels?: ContainmentRelSummary[];
	} = $props();

	const ctx = getContext<ContainmentSelectContext | undefined>('containmentRelSelect');
	let menuOpen = $state(false);
	let menuX = $state(0);
	let menuY = $state(0);
	let buttonEl: HTMLButtonElement | undefined = $state();

	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				node.remove();
			},
		};
	}

	function placeMenu() {
		const rect = buttonEl?.getBoundingClientRect();
		if (!rect) return;
		const width = 180;
		const estimatedHeight = 8 + rels.length * 28;
		const left = Math.min(
			Math.max(8, rect.right - width),
			window.innerWidth - width - 8
		);
		const openBelow = rect.bottom + 4 + estimatedHeight <= window.innerHeight;
		menuX = left;
		menuY = openBelow ? rect.bottom + 4 : Math.max(8, rect.top - estimatedHeight - 4);
	}

	function handleClick(event: MouseEvent) {
		event.stopPropagation();
		event.preventDefault();
		if (!ctx || rels.length === 0) return;
		if (rels.length === 1) {
			ctx.onSelect(rels[0]!.uniqueId);
			menuOpen = false;
			return;
		}
		placeMenu();
		menuOpen = !menuOpen;
	}

	function pick(id: string, event: MouseEvent) {
		event.stopPropagation();
		ctx?.onSelect(id);
		menuOpen = false;
	}

	function closeMenu() {
		menuOpen = false;
	}

	function handleWindowKey(event: KeyboardEvent) {
		if (event.key === 'Escape') closeMenu();
	}

	onDestroy(() => {
		menuOpen = false;
	});
</script>

<svelte:window onkeydown={handleWindowKey} />

{#if rels.length > 0 && ctx}
	<div class="rel-icon-wrap">
		<button
			type="button"
			class="rel-icon"
			bind:this={buttonEl}
			onclick={handleClick}
			title="Edit containment relationship"
			aria-label="Edit containment relationship"
			aria-haspopup={rels.length > 1 ? 'menu' : undefined}
			aria-expanded={rels.length > 1 ? menuOpen : undefined}
		>
			<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
				<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
				<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
			</svg>
		</button>
	</div>
{/if}

{#if menuOpen && rels.length > 1}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="rel-menu-layer" use:portal>
		<div class="rel-menu-backdrop" onclick={closeMenu}></div>
		<ul
			class="rel-menu"
			role="menu"
			style="left: {menuX}px; top: {menuY}px;"
			onclick={(e) => e.stopPropagation()}
		>
			{#each rels as rel}
				<li role="none">
					<button type="button" role="menuitem" onclick={(e) => pick(rel.uniqueId, e)}>
						{rel.variant}: {rel.name}
					</button>
				</li>
			{/each}
		</ul>
	</div>
{/if}

<style>
	.rel-icon-wrap {
		position: relative;
		flex-shrink: 0;
		z-index: 2;
	}
	.rel-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		padding: 0;
		border: none;
		border-radius: 4px;
		background: transparent;
		color: var(--node-container-badge, #64748b);
		cursor: pointer;
	}
	.rel-icon:hover {
		background: color-mix(in srgb, var(--node-container-stroke, #64748b) 15%, transparent);
		color: var(--node-container-stroke, #334155);
	}
	.rel-menu-backdrop {
		position: fixed;
		inset: 0;
		z-index: 10000;
	}
	.rel-menu {
		position: fixed;
		z-index: 10001;
		margin: 0;
		padding: 4px;
		min-width: 160px;
		list-style: none;
		background: var(--toolbar-bg, #fff);
		border: 1px solid var(--border, #e2e8f0);
		border-radius: 6px;
		box-shadow: 0 4px 12px rgb(0 0 0 / 12%);
	}
	.rel-menu button {
		display: block;
		width: 100%;
		padding: 4px 8px;
		border: none;
		background: transparent;
		text-align: left;
		font-size: 11px;
		cursor: pointer;
		color: var(--node-label-color, #334155);
	}
	.rel-menu button:hover {
		background: #eff6ff;
	}
</style>
