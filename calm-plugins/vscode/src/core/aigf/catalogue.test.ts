// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { aigfRisks, aigfMitigations, AIGF_CONTROL_KEYS } from './catalogue.js';

describe('AIGF Catalogue', () => {
  it('aigfRisks has exactly 23 entries', () => {
    expect(aigfRisks).toHaveLength(23);
  });

  it('aigfMitigations has exactly 23 entries', () => {
    expect(aigfMitigations).toHaveLength(23);
  });

  it('every risk has id, title, type, description, externalRefs', () => {
    for (const risk of aigfRisks) {
      expect(risk.id).toBeTruthy();
      expect(risk.title).toBeTruthy();
      expect(risk.type).toBeTruthy();
      expect(risk.description).toBeTruthy();
      expect(risk.externalRefs).toBeDefined();
    }
  });

  it('every mitigation has id, title, type, calmControlKey', () => {
    for (const mitigation of aigfMitigations) {
      expect(mitigation.id).toBeTruthy();
      expect(mitigation.title).toBeTruthy();
      expect(mitigation.type).toBeTruthy();
      expect(mitigation.calmControlKey).toBeTruthy();
    }
  });

  it("risk types are only 'OP', 'SEC', or 'RC'", () => {
    const validTypes = new Set(['OP', 'SEC', 'RC']);
    for (const risk of aigfRisks) {
      expect(validTypes.has(risk.type)).toBe(true);
    }
  });

  it('no calmControlKey starts with aigf- (domain-oriented keys per CALM spec)', () => {
    for (const mitigation of aigfMitigations) {
      expect(mitigation.calmControlKey.startsWith('aigf-')).toBe(false);
    }
  });

  it('every mitigation has an airId matching AIR-{PREV|DET}-NNN pattern', () => {
    for (const mitigation of aigfMitigations) {
      expect(mitigation.airId).toMatch(/^AIR-(PREV|DET)-\d{3}$/);
    }
  });

  it('AIGF_CONTROL_KEYS set has 23 entries matching mitigations', () => {
    expect(AIGF_CONTROL_KEYS.size).toBe(23);
    for (const mitigation of aigfMitigations) {
      expect(AIGF_CONTROL_KEYS.has(mitigation.calmControlKey)).toBe(true);
    }
  });
});
