import { describe, it, expect, vi } from 'vitest';
import { CalmCoreCanonicalModel } from '@finos/calm-models/canonical';
import * as vmBuilderModule from './core/vm-builder';
import * as optionsParser from './core/options-parser';
import {BlockArchitectureWidget, BlockArchVM, transformToBlockArchVM} from '.';
import {BlockArchVMBuilder} from './core/vm-builder';


describe('BlockArchitectureWidget', () => {
    const minimalContext: CalmCoreCanonicalModel = { nodes: [], relationships: [] };

    it('validateContext returns true for valid CalmCoreCanonicalModel', () => {
        expect(BlockArchitectureWidget.validateContext(minimalContext)).toBe(true);
    });

    it('validateContext returns false for invalid objects', () => {
        expect(BlockArchitectureWidget.validateContext(null)).toBe(false);
        expect(BlockArchitectureWidget.validateContext({})).toBe(false);
        expect(BlockArchitectureWidget.validateContext({ nodes: [] })).toBe(false);
        expect(BlockArchitectureWidget.validateContext({ relationships: [] })).toBe(false);
        expect(
            BlockArchitectureWidget.validateContext({ nodes: {}, relationships: {} })
        ).toBe(false);
    });

    it('transformToBlockArchVM parses options and delegates to buildBlockArchVM', () => {
        const spyParse = vi.spyOn(optionsParser, 'parseOptions').mockReturnValue({
            includeContainers: 'all',
            includeChildren: 'all',
            edges: 'connected',
            direction: 'both',
            renderInterfaces: false,
            edgeLabels: 'description',
        });

        const fakeVM: BlockArchVM = { containers: [], edges: [], attachments: [], looseNodes: [], highlightNodeIds: [], warnings: [] };
        const spyBuild = vi
            .spyOn(vmBuilderModule, 'buildBlockArchVM')
            .mockReturnValue(fakeVM);

        const res = transformToBlockArchVM(minimalContext, { 'render-interfaces': true });
        expect(res).toBe(fakeVM);
        expect(spyParse).toHaveBeenCalledWith({ 'render-interfaces': true });
        expect(spyBuild).toHaveBeenCalled();

        spyParse.mockRestore();
        spyBuild.mockRestore();
    });

    it('exposes widget metadata', () => {
        expect(BlockArchitectureWidget.id).toBe('block-architecture');
        expect(BlockArchitectureWidget.templatePartial).toBe('block-architecture.hbs');
        expect(Array.isArray(BlockArchitectureWidget.partials)).toBe(true);
        expect(BlockArchitectureWidget.partials).toContain('container.hbs');
    });

    it('registerHelpers is defined', () => {
        expect(typeof BlockArchitectureWidget.registerHelpers).toBe('function');
    });

    it('exports BlockArchVMBuilder class', () => {
        const builder = new BlockArchVMBuilder(minimalContext, {
            includeContainers: 'all',
            includeChildren: 'all',
            edges: 'connected',
            direction: 'both',
            renderInterfaces: false,
            edgeLabels: 'description',
        });
        expect(builder).toBeInstanceOf(BlockArchVMBuilder);
    });
});
