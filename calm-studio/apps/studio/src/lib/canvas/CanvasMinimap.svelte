<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<script lang="ts">
	import { MiniMap, useSvelteFlow } from '@xyflow/svelte';
	import { panViewportFromMinimapClick } from './canvasMinimap';

	const { setCenter, getViewport } = useSvelteFlow();

	let host: HTMLDivElement | undefined = $state();

	function panFromClick(event: MouseEvent, panel: HTMLElement) {
		const svg = panel.querySelector('svg');
		if (!(svg instanceof SVGSVGElement)) return;
		const rect = svg.getBoundingClientRect();
		const vb = svg.viewBox.baseVal;
		const point = { x: event.clientX, y: event.clientY };
		panViewportFromMinimapClick({
			start: point,
			end: point,
			svgRect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
			viewBox: { x: vb.x, y: vb.y, width: vb.width, height: vb.height },
			currentZoom: getViewport().zoom,
			setCenter: (x, y, opts) => {
				void setCenter(x, y, opts);
			},
		});
	}

	$effect(() => {
		const el = host;
		if (!el) return;

		let detach: (() => void) | undefined;

		function attach() {
			detach?.();
			detach = undefined;
			const panel = el.querySelector('.svelte-flow__minimap');
			if (!(panel instanceof HTMLElement)) return;

			function onPointerDown(event: PointerEvent) {
				event.stopPropagation();
			}

			function onClick(event: MouseEvent) {
				event.stopPropagation();
				panFromClick(event, panel);
			}

			panel.addEventListener('pointerdown', onPointerDown);
			panel.addEventListener('click', onClick);
			detach = () => {
				panel.removeEventListener('pointerdown', onPointerDown);
				panel.removeEventListener('click', onClick);
			};
		}

		attach();
		const observer = new MutationObserver(() => {
			if (el.querySelector('.svelte-flow__minimap')) {
				attach();
				observer.disconnect();
			}
		});
		observer.observe(el, { childList: true, subtree: true });
		return () => {
			observer.disconnect();
			detach?.();
		};
	});
</script>

<div class="canvas-minimap-host" bind:this={host}>
	<MiniMap
		position="bottom-right"
		pannable={true}
		zoomable={false}
		ariaLabel="Canvas overview"
		class="canvas-minimap"
	/>
</div>

<style>
	.canvas-minimap-host {
		display: contents;
	}
</style>
