<svelte:options
  customElement={{
    tag: 'calm-diagram',
    shadow: { mode: 'open' },
    props: {
      src: { type: 'String', attribute: 'src' },
      data: { type: 'String', attribute: 'data' },
      theme: { type: 'String', attribute: 'theme', reflect: true },
      flow: { type: 'String', attribute: 'flow' },
    },
  }}
/>

<script lang="ts">
  import { renderELKDiagram } from './render/elkRender.js';
  import type { CalmArchitecture } from '@calmstudio/calm-core';

  let {
    src = '',
    data = '',
    theme = 'light' as 'light' | 'dark',
    flow = '',
  }: { src?: string; data?: string; theme?: 'light' | 'dark'; flow?: string } = $props();

  let svgContent = $state('');
  let error = $state('');
  let loading = $state(false);

  // Zoom/pan state
  let scale = $state(1);
  let translateX = $state(0);
  let translateY = $state(0);
  let isDragging = $state(false);
  let lastPointerX = $state(0);
  let lastPointerY = $state(0);

  // Tooltip state
  let tooltip = $state<{ text: string; x: number; y: number } | null>(null);

  // Load and render whenever src, data, or theme changes
  $effect(() => {
    // Capture reactive deps
    const currentSrc = src;
    const currentData = data;
    const currentTheme = theme;
    const currentFlow = flow;

    void (async () => {
      error = '';
      svgContent = '';
      loading = true;

      try {
        let arch: CalmArchitecture;

        if (currentData && currentData.trim().length > 0) {
          arch = JSON.parse(currentData) as CalmArchitecture;
        } else if (currentSrc && currentSrc.trim().length > 0) {
          const response = await fetch(currentSrc, { credentials: 'omit' });
          if (!response.ok) {
            throw new Error(`Failed to load: ${response.status} ${response.statusText}`);
          }
          arch = (await response.json()) as CalmArchitecture;
        } else {
          loading = false;
          return;
        }

        svgContent = await renderELKDiagram(arch, { theme: currentTheme, flow: currentFlow || undefined });
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
      } finally {
        loading = false;
      }
    })();
  });

  // Wheel event: zoom
  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    scale = Math.min(5, Math.max(0.1, scale + delta));
  }

  // Pointer events: pan
  function onPointerDown(e: PointerEvent) {
    isDragging = true;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent) {
    if (!isDragging) return;
    const dx = e.clientX - lastPointerX;
    const dy = e.clientY - lastPointerY;
    translateX += dx;
    translateY += dy;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
  }

  function onPointerUp(e: PointerEvent) {
    isDragging = true;
    isDragging = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  }

  // Click: show tooltip for node with description
  function onClick(e: MouseEvent) {
    const target = e.target as Element | null;
    const nodeGroup = target?.closest('[data-node-id]') as HTMLElement | null;
    if (nodeGroup) {
      const desc = nodeGroup.getAttribute('data-description') ?? '';
      const nodeId = nodeGroup.getAttribute('data-node-id') ?? '';
      if (desc && desc.length > 0) {
        if (tooltip?.text === desc) {
          tooltip = null;
        } else {
          tooltip = { text: `${nodeId}: ${desc}`, x: e.clientX, y: e.clientY };
        }
      } else {
        tooltip = null;
      }
    } else {
      tooltip = null;
    }
  }
</script>

<div
  class="diagram-host"
  role="application"
  aria-label="CALM architecture diagram — use scroll to zoom, drag to pan, click nodes for details"
  tabindex="0"
  onwheel={onWheel}
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  onclick={onClick}
  onkeydown={(e: KeyboardEvent) => {
    // Keyboard pan support
    const step = 20;
    if (e.key === 'ArrowLeft') { translateX += step; e.preventDefault(); }
    else if (e.key === 'ArrowRight') { translateX -= step; e.preventDefault(); }
    else if (e.key === 'ArrowUp') { translateY += step; e.preventDefault(); }
    else if (e.key === 'ArrowDown') { translateY -= step; e.preventDefault(); }
    else if (e.key === '+' || e.key === '=') { scale = Math.min(5, scale + 0.1); e.preventDefault(); }
    else if (e.key === '-') { scale = Math.max(0.1, scale - 0.1); e.preventDefault(); }
    else if (e.key === 'Escape') { tooltip = null; }
  }}
>
  {#if loading}
    <div class="status-message">Loading...</div>
  {:else if error}
    <div class="status-message error">{error}</div>
  {:else if svgContent}
    <div
      class="diagram-container"
      style="transform: translate({translateX}px, {translateY}px) scale({scale}); transform-origin: 0 0; cursor: {isDragging ? 'grabbing' : 'grab'};"
    >
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      {@html svgContent}
    </div>
  {/if}

  {#if tooltip}
    <div
      class="tooltip"
      style="position: fixed; left: {tooltip.x + 12}px; top: {tooltip.y - 8}px;"
      role="tooltip"
    >
      {tooltip.text}
    </div>
  {/if}
</div>

<style>
  :host {
    display: block;
    width: 100%;
    height: 100%;
    overflow: hidden;
    font-family: sans-serif;
  }

  .diagram-host {
    width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden;
  }

  .diagram-container {
    display: inline-block;
    will-change: transform;
  }

  .status-message {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #666;
    font-size: 14px;
  }

  .status-message.error {
    color: #dc2626;
  }

  .tooltip {
    background: rgba(0, 0, 0, 0.8);
    color: #fff;
    padding: 6px 10px;
    border-radius: 4px;
    font-size: 12px;
    max-width: 280px;
    word-break: break-word;
    pointer-events: none;
    z-index: 1000;
    white-space: pre-wrap;
  }

  :host([theme="dark"]) {
    --calm-bg: #1e1e1e;
    --calm-text: #e5e5e5;
  }

  /* Flow overlay styles — SVG <title> provides native browser tooltip on hover */
  :global(.flow-badge) {
    cursor: pointer;
  }

  :global(.flow-overlay circle) {
    cursor: pointer;
  }
</style>
