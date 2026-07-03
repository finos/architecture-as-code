// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { getWebviewContent, isCalmFile, getNonce } from '../preview.js';

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
