import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it, expect } from 'vitest';
import {
    extractNetworkAddressables,
    AddressableEntry,
} from './network-addressable-extractor.js';

const WORKSHOP_DIR = join(
    __dirname,
    '../../../conferences/osff-ln-2025/workshop'
);
const jsonPath = join(
    WORKSHOP_DIR,
    'architecture/conference-secure-signup-amended.arch.json'
);
const jsonDoc = readFileSync(jsonPath, 'utf-8');
const entries: AddressableEntry[] = extractNetworkAddressables(jsonDoc);

describe('extractNetworkAddressables E2E', () => {
    it('extracts the web URL from conference-website interface', () => {
        expect(entries).toContainEqual({
            path: 'root.nodes[0].interfaces[0].url',
            key: 'url',
            value: 'https://calm.finos.org/amazing-website',
        });
    });

    it('extracts control requirement URLs from node controls', () => {
        expect(entries).toContainEqual({
            path: 'root.nodes[4].controls.security.requirements[0].control-requirement-url',
            key: 'control-requirement-url',
            value: 'https://calm.finos.org/workshop/controls/micro-segmentation.requirement.json',
        });
    });

    it('extracts control config URLs from node controls', () => {
        expect(entries).toContainEqual({
            path: 'root.nodes[4].controls.security.requirements[0].control-config-url',
            key: 'control-config-url',
            value: 'https://calm.finos.org/workshop/controls/micro-segmentation.config.json',
        });
    });

    it('extracts requirement URLs from relationships controls', () => {
        const relReqs = entries
            .filter(
                (e) =>
                    e.key === 'control-requirement-url' &&
                    e.path.startsWith('root.relationships')
            )
            .map((e) => e.value)
            .sort();
        expect(relReqs).toEqual(
            [
                'https://calm.finos.org/workshop/controls/permitted-connection.requirement.json',
                'https://calm.finos.org/workshop/controls/permitted-connection.requirement.json',
                'https://calm.finos.org/workshop/controls/permitted-connection.requirement.json',
            ].sort()
        );
    });

    it('extracts config URLs from relationships controls', () => {
        const relConfigs = entries
            .filter(
                (e) =>
                    e.key === 'control-config-url' &&
                    e.path.startsWith('root.relationships')
            )
            .map((e) => e.value)
            .sort();
        expect(relConfigs).toEqual(
            [
                'https://calm.finos.org/workshop/controls/permitted-connection-http.config.json',
                'https://calm.finos.org/workshop/controls/permitted-connection-http.config.json',
                'https://calm.finos.org/workshop/controls/permitted-connection-jdbc.config.json',
            ].sort()
        );
    });

    it('does not extract non-URL values', () => {
        expect(entries.every((e) => /^https?:\/\//.test(e.value))).toBe(true);
    });
});
