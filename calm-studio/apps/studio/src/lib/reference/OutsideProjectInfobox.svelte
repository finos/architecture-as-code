<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script lang="ts">
	let {
		href,
		onclose,
	}: {
		href: string;
		onclose: () => void;
	} = $props();
</script>

<div class="infobox-backdrop" role="presentation" onclick={onclose}></div>
<div class="infobox" role="dialog" aria-labelledby="outside-project-title">
	<h3 id="outside-project-title">Link vede mimo projekt</h3>
	<p>Tento odkaz ukazuje na soubor nebo URL mimo kořen otevřené složky.</p>
	<a class="external-link" href={href} target="_blank" rel="noopener noreferrer">{href}</a>
	<div class="actions">
		<button type="button" class="btn-close" onclick={onclose}>Zavřít</button>
	</div>
</div>

<style>
	.infobox-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(15, 23, 42, 0.35);
		z-index: 1000;
	}
	.infobox {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 1001;
		width: min(420px, calc(100vw - 32px));
		padding: 20px;
		border-radius: 8px;
		background: var(--surface, #fff);
		border: 1px solid var(--border, #e2e8f0);
		box-shadow: 0 12px 40px rgba(15, 23, 42, 0.18);
		font-family: var(--font-sans, system-ui, sans-serif);
	}
	h3 {
		margin: 0 0 8px;
		font-size: 16px;
	}
	p {
		margin: 0 0 12px;
		font-size: 13px;
		color: var(--text-muted, #64748b);
	}
	.external-link {
		display: block;
		word-break: break-all;
		font-size: 13px;
		color: var(--accent, #2563eb);
	}
	.actions {
		margin-top: 16px;
		display: flex;
		justify-content: flex-end;
	}
	.btn-close {
		padding: 6px 12px;
		border-radius: 6px;
		border: 1px solid var(--border, #e2e8f0);
		background: var(--surface, #fff);
		cursor: pointer;
	}
</style>
