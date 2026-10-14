<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<script lang="ts">
	import type { AdrPreviewModel, HubAdrOptionView } from './adrs';
	import { renderSafeMarkdown } from './safeMarkdown';

	interface Props {
		preview: AdrPreviewModel | null;
	}

	let { preview }: Props = $props();

	const html = $derived(preview?.markdown ? renderSafeMarkdown(preview.markdown) : '');

	function formatAdrDate(value: string): string {
		if (!value) return '';
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return value;
		const month = date.toLocaleString('en-GB', { month: 'short' });
		const minutes = String(date.getMinutes()).padStart(2, '0');
		return `${date.getDate()} ${month}, ${date.getFullYear()} at ${date.getHours()}:${minutes}`;
	}
</script>

{#snippet consequences(option: HubAdrOptionView)}
	{#if option.description}
		<div class="markdown">{@html renderSafeMarkdown(option.description)}</div>
	{/if}
	<p class="subhead">Positive Consequences</p>
	<ul class="plain positive">
		{#each option.positive as item, index (`p-${index}`)}
			<li>{item}</li>
		{/each}
	</ul>
	<p class="subhead">Negative Consequences</p>
	<ul class="plain negative">
		{#each option.negative as item, index (`n-${index}`)}
			<li>{item}</li>
		{/each}
	</ul>
{/snippet}

<article class="preview" aria-label="ADR preview">
	{#if !preview}
		<p>No ADR selected.</p>
	{:else if preview.kind === 'hub' && preview.hub}
		{@const adr = preview.hub}
		<header class="title-row">
			<h2>{adr.title || preview.title}</h2>
			{#if adr.status}
				<span class="status {adr.status}">{adr.status}</span>
			{/if}
		</header>

		<details open>
			<summary>Context and Problem</summary>
			{#if adr.context}
				<div class="markdown">{@html renderSafeMarkdown(adr.context)}</div>
			{/if}
		</details>

		<details open>
			<summary>Decision Drivers</summary>
			<ul>
				{#each adr.drivers as driver, index (`d-${index}`)}
					<li>{driver}</li>
				{/each}
			</ul>
		</details>

		<details open>
			<summary>Considered Options</summary>
			{#each adr.options as option, index (`o-${index}`)}
				<details class="option">
					<summary>{option.name}</summary>
					{@render consequences(option)}
				</details>
			{/each}
		</details>

		<details open>
			<summary>Decision Outcome</summary>
			{#if adr.outcome}
				<p class="option-name">{adr.outcome.name}</p>
				{@render consequences(adr.outcome)}
				<p class="subhead">Decision Rational</p>
				{#if adr.outcome.rationale}
					<div class="markdown">{@html renderSafeMarkdown(adr.outcome.rationale)}</div>
				{/if}
			{:else}
				<p class="empty">No decision outcome recorded yet.</p>
			{/if}
		</details>

		<details open>
			<summary>Relevant Links</summary>
			<ul>
				{#each adr.links as link, index (`l-${index}`)}
					<li>
						<a href={link.href} target="_blank" rel="noopener noreferrer">{link.rel}</a>
					</li>
				{/each}
			</ul>
		</details>

		<p class="dates">
			{#if adr.created}<span>Created on <strong>{formatAdrDate(adr.created)}</strong></span>{/if}
			{#if adr.updated}<span>Last updated on <strong>{formatAdrDate(adr.updated)}</strong></span>{/if}
		</p>
	{:else}
		<h2>{preview.title}</h2>
		{#if preview.error}
			<p class="error" role="alert">{preview.error}</p>
		{:else if preview.kind === 'markdown'}
			<div class="markdown">{@html html}</div>
		{:else}
			<p>No preview for this file type.</p>
			<p class="path">{preview.ref}</p>
		{/if}
	{/if}
</article>

<style>
	.preview {
		height: 100%;
		overflow: auto;
		padding: 16px 20px;
		background: var(--color-surface, #fff);
		color: var(--color-text-primary, #0f172a);
	}

	.title-row {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 8px;
	}

	h2 {
		margin: 0 0 12px;
		font-size: 22px;
	}

	.title-row h2 {
		margin: 0;
	}

	.status {
		padding: 1px 10px;
		border-radius: 999px;
		border: 2px solid #64748b;
		color: #64748b;
		font-size: 13px;
		font-weight: 700;
		text-transform: capitalize;
	}

	.status.draft {
		border-color: #f97316;
		color: #f97316;
	}

	.status.proposed {
		border-color: #14b8a6;
		color: #14b8a6;
	}

	.status.accepted {
		border-color: #84cc16;
		color: #65a30d;
	}

	.status.superseded {
		border-color: #8b5cf6;
		color: #7c3aed;
	}

	.status.rejected {
		border-color: #ef4444;
		color: #ef4444;
	}

	.status.deprecated {
		border-color: #64748b;
		color: #64748b;
	}

	details {
		margin-top: 8px;
	}

	summary {
		cursor: pointer;
		font-weight: 700;
		font-size: 16px;
		color: #60a5fa;
		border-bottom: 1px solid rgba(15, 23, 42, 0.15);
		padding: 4px 0;
	}

	.option {
		margin: 8px 0;
		border: 1px solid rgba(15, 23, 42, 0.12);
		border-left: 4px solid #3b82f6;
		border-radius: 4px;
		padding: 0 8px 8px;
	}

	.option summary {
		border-bottom: none;
		color: inherit;
		font-size: 14px;
	}

	.option-name,
	.subhead {
		margin: 8px 0 4px;
		font-weight: 700;
	}

	.option-name {
		margin-top: 8px;
	}

	.empty,
	.dates {
		font-size: 12px;
		font-style: italic;
		color: var(--color-text-secondary, #64748b);
	}

	.dates {
		display: flex;
		flex-direction: column;
		gap: 2px;
		margin-top: 16px;
	}

	.dates strong {
		font-style: normal;
	}

	.error {
		color: #b91c1c;
	}

	.path {
		font-family: ui-monospace, monospace;
		font-size: 12px;
	}

	.markdown :global(pre) {
		overflow: auto;
		padding: 8px;
		background: rgba(15, 23, 42, 0.05);
	}

	.markdown :global(table) {
		border-collapse: collapse;
		margin: 8px 0 12px;
		max-width: 100%;
	}

	.markdown :global(th),
	.markdown :global(td) {
		border: 1px solid rgba(15, 23, 42, 0.18);
		padding: 4px 8px;
		vertical-align: top;
	}

	.markdown :global(th) {
		background: rgba(15, 23, 42, 0.05);
		font-weight: 700;
	}

	ul {
		margin: 4px 0 8px;
		padding-left: 18px;
	}

	.plain {
		list-style: none;
		padding-left: 12px;
	}

	.positive li::before {
		content: '+ ';
		color: #15803d;
	}

	.negative li::before {
		content: '− ';
		color: #b91c1c;
	}

	a {
		color: #2563eb;
	}
</style>
