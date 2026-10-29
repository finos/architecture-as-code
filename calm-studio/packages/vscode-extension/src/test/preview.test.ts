// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { getWebviewContent, isCalmFile, getNonce, renderPreviewSvg } from '../preview.js';
import type { CalmArchitecture } from '@calmstudio/calm-core';

describe('getWebviewContent', () => {
  it('returns HTML containing the SVG string', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>Test</text></svg>';
    const nonce = 'testnonce123456789012345678901';
    const html = getWebviewContent(svg, nonce);
    expect(html).toContain(svg);
  });

  it('returns HTML containing DOCTYPE', () => {
    const html = getWebviewContent('<svg></svg>', 'abc12345678901234567890123456');
    expect(html).toContain('<!DOCTYPE html>');
  });

  it('returns HTML containing CSP meta tag', () => {
    const nonce = 'testnonce123456789012345678901';
    const html = getWebviewContent('<svg></svg>', nonce);
    expect(html).toContain('Content-Security-Policy');
    expect(html).toContain(nonce);
  });

  it('gives style elements in the SVG the CSP nonce', () => {
    const nonce = 'testnonce123456789012345678901';
    const html = getWebviewContent('<svg><style>.calm-node { opacity: 1; }</style></svg>', nonce);
    expect(html).toContain(`<style nonce="${nonce}">.calm-node`);
  });

  it('wraps SVG in body with VS Code background CSS variable', () => {
    const html = getWebviewContent('<svg></svg>', 'abc12345678901234567890123456');
    expect(html).toContain('var(--vscode-editor-background)');
  });
});

describe('isCalmFile', () => {
  it('returns true for paths ending in .calm.json', () => {
    expect(isCalmFile('my-arch.calm.json')).toBe(true);
  });

  it('returns true for paths ending in .json', () => {
    expect(isCalmFile('architecture.json')).toBe(true);
  });

  it('returns false for paths ending in .ts', () => {
    expect(isCalmFile('extension.ts')).toBe(false);
  });

  it('returns false for paths ending in .md', () => {
    expect(isCalmFile('README.md')).toBe(false);
  });

  it('returns false for paths ending in .txt', () => {
    expect(isCalmFile('notes.txt')).toBe(false);
  });
});

describe('getNonce', () => {
  it('returns a 32-character string', () => {
    const nonce = getNonce();
    expect(nonce).toHaveLength(32);
  });

  it('returns an alphanumeric string', () => {
    const nonce = getNonce();
    expect(nonce).toMatch(/^[A-Za-z0-9]{32}$/);
  });
});

describe('renderPreviewSvg', () => {
  const node = (id: string, type = 'service') => ({ 'unique-id': id, 'node-type': type, name: id, description: id });
  const deployedIn = (id: string, container: string, nodes: string[]) => ({
    'unique-id': id,
    'relationship-type': { 'deployed-in': { container, nodes } },
  });

  it('draws a container as a box with its members inside, not as arrows', async () => {
    const arch = {
      nodes: [node('cluster', 'network'), node('svc')],
      relationships: [deployedIn('r1', 'cluster', ['svc'])],
    } as CalmArchitecture;
    const svg = await renderPreviewSvg(arch, 'light');
    expect(svg).toContain('data-container-id="cluster"');
    expect(svg).not.toContain('<polyline');
  });

  it('uses the dark theme when asked', async () => {
    const svg = await renderPreviewSvg({ nodes: [node('svc')], relationships: [] } as CalmArchitecture, 'dark');
    expect(svg).toContain('background:#1e1e1e');
  });
});

