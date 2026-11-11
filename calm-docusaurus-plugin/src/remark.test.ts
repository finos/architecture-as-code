// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { compile } from '@mdx-js/mdx';
import remarkCalmDiagram from './remark.js';

async function compileMdx(source: string): Promise<string> {
  const file = await compile(source, { remarkPlugins: [remarkCalmDiagram] });
  return String(file);
}

describe('remarkCalmDiagram', () => {
  it('rewrites a relative src into a hoisted import + __bundle prop', async () => {
    const out = await compileMdx('<CalmDiagram src="./arch/demo.calm.json" />');
    expect(out).toContain('from "./arch/demo.calm.json"');
    expect(out).toContain('__bundle:');
    expect(out).not.toContain('src:');
  });

  it('handles multiple diagrams with distinct identifiers', async () => {
    const out = await compileMdx(
      '<CalmDiagram src="./a.calm.json" />\n\n<CalmDiagram src="../b.calm.json" />'
    );
    expect(out).toContain('from "./a.calm.json"');
    expect(out).toContain('from "../b.calm.json"');
    expect(out).toContain('__calmDiagramBundle0');
    expect(out).toContain('__calmDiagramBundle1');
  });

  it('preserves other props alongside the rewrite', async () => {
    const out = await compileMdx('<CalmDiagram src="./a.calm.json" flow="checkout" interactive={false} />');
    expect(out).toContain('flow:');
    expect(out).toContain('interactive:');
    expect(out).toContain('__bundle:');
  });

  it('leaves http(s) src untouched', async () => {
    const out = await compileMdx('<CalmDiagram src="https://example.com/a.calm.json" />');
    expect(out).toContain('src:');
    expect(out).not.toContain('__bundle:');
  });

  it('leaves data-only usage untouched', async () => {
    const out = await compileMdx('<CalmDiagram data={{ nodes: [] }} />');
    expect(out).not.toContain('__bundle:');
  });

  it('ignores other components with src attrs', async () => {
    const out = await compileMdx('<img src="./photo.png" />');
    expect(out).not.toContain('__bundle:');
  });
});
