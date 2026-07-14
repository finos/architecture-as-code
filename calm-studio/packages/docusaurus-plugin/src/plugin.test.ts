// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import calmstudioDocusaurusPlugin from './plugin.js';

describe('calmstudioDocusaurusPlugin', () => {
  const plugin = calmstudioDocusaurusPlugin();

  it('declares its name', () => {
    expect(plugin.name).toBe('@calmstudio/docusaurus-plugin');
  });

  it('registers a webpack rule routing *.calm.json through the package loader', () => {
    const config = plugin.configureWebpack?.({}, false, { currentBundler: { name: 'webpack' } } as never);
    const rules = (config as { module: { rules: Array<{ test: RegExp; type: string; use: string }> } })
      .module.rules;
    expect(rules).toHaveLength(1);
    expect(rules[0].test.test('demo.calm.json')).toBe(true);
    expect(rules[0].test.test('package.json')).toBe(false);
    expect(rules[0].test.test('demo.calm.json.bak')).toBe(false);
    expect(rules[0].type).toBe('javascript/auto');
    expect(rules[0].use).toBe('@calmstudio/docusaurus-plugin/loader');
  });

  it('ships its stylesheet as a client module', () => {
    expect(plugin.getClientModules?.()).toEqual(['@calmstudio/docusaurus-plugin/styles.css']);
  });
});
