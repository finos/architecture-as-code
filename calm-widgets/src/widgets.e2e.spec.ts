import { describe, it, expect, beforeEach } from 'vitest';
import Handlebars from 'handlebars';
import { WidgetEngine } from './widget-engine';
import { WidgetRegistry } from './widget-registry';
import { FixtureLoader } from './test-utils/fixture-loader';

describe('Widgets E2E - Handlebars Integration', () => {
    let handlebars: typeof Handlebars;
    let registry: WidgetRegistry;
    let engine: WidgetEngine;
    let fixtures: FixtureLoader;

    beforeEach(() => {
        handlebars = Handlebars.create();
        registry = new WidgetRegistry(handlebars);
        engine = new WidgetEngine(handlebars, registry);
        engine.registerDefaultWidgets();
        fixtures = new FixtureLoader();
    });

    describe('Table Widget', () => {
        it('renders a simple object as a table with headers', () => {
            const { context, template, expected } = fixtures.loadFixture('table-widget', 'simple-object');

            const compiledTemplate = handlebars.compile(template);
            const result = compiledTemplate(context);

            expect(result.trim()).toBe(expected);
        });

        it('renders an array of objects as a table without headers', () => {
            const { context, template, expected } = fixtures.loadFixture('table-widget', 'array-no-headers');

            const compiledTemplate = handlebars.compile(template);
            const result = compiledTemplate(context);

            expect(result.trim()).toBe(expected);
        });

        it('renders nested objects recursively', () => {
            const { context, template, expected } = fixtures.loadFixture('table-widget', 'nested-objects');

            const compiledTemplate = handlebars.compile(template);
            const result = compiledTemplate(context);

            expect(result.trim()).toBe(expected);
        });

        it('renders with specific columns only (column filtering)', () => {
            const { context, template, expected } = fixtures.loadFixture('table-widget', 'column-filtering');

            const compiledTemplate = handlebars.compile(template);
            const result = compiledTemplate(context);

            expect(result.trim()).toBe(expected);
        });
    });

    describe('List Widget', () => {
        it('renders an unordered list of strings', () => {
            const { context, template, expected } = fixtures.loadFixture('list-widget', 'unordered-strings');

            const compiledTemplate = handlebars.compile(template);
            const result = compiledTemplate(context);

            expect(result.trim()).toBe(expected);
        });

        it('renders an ordered list when specified', () => {
            const { context, template, expected } = fixtures.loadFixture('list-widget', 'ordered-strings');

            const compiledTemplate = handlebars.compile(template);
            const result = compiledTemplate(context);

            expect(result.trim()).toBe(expected);
        });

        it('renders objects as key-value pairs', () => {
            const { context, template, expected } = fixtures.loadFixture('list-widget', 'objects-as-key-value');

            const compiledTemplate = handlebars.compile(template);
            const result = compiledTemplate(context);

            expect(result.trim()).toBe(expected);
        });
    });

    describe('JSON Viewer Widget', () => {
        it('renders simple objects as formatted JSON', () => {
            const { context, template, expected } = fixtures.loadFixture('json-viewer-widget', 'simple-object');

            const compiledTemplate = handlebars.compile(template);
            const result = compiledTemplate(context);

            expect(result.trim()).toBe(expected);
        });

        it('renders complex nested structures', () => {
            const { context, template, expected } = fixtures.loadFixture('json-viewer-widget', 'nested-structure');

            const compiledTemplate = handlebars.compile(template);
            const result = compiledTemplate(context);

            expect(result.trim()).toBe(expected);
        });
    });

    describe('Combined Widgets', () => {
        it('demonstrates comprehensive documentation using all widgets together', () => {
            const { context, template, expected } = fixtures.loadFixture('combined-widgets', 'comprehensive-documentation');

            const compiledTemplate = handlebars.compile(template);
            const result = compiledTemplate(context);

            expect(result.trim()).toBe(expected);
        });
    });

    describe('Fixture System', () => {
        it('can load all available widget fixtures', () => {
            const availableWidgets = fixtures.listWidgets();
            expect(availableWidgets).toContain('table-widget');
            expect(availableWidgets).toContain('list-widget');
            expect(availableWidgets).toContain('json-viewer-widget');
            expect(availableWidgets).toContain('combined-widgets');
        });

        it('can list scenarios for each widget', () => {
            const tableScenarios = fixtures.listScenarios('table-widget');
            expect(tableScenarios).toContain('simple-object');
            expect(tableScenarios).toContain('array-no-headers');
            expect(tableScenarios).toContain('nested-objects');

            const listScenarios = fixtures.listScenarios('list-widget');
            expect(listScenarios).toContain('unordered-strings');
            expect(listScenarios).toContain('ordered-strings');
            expect(listScenarios).toContain('objects-as-key-value');
        });
    });

    describe('Flow Sequence Widget', () => {
        it('renders a bidirectional flow', () => {
            const { context, template, expected } = fixtures.loadFixture('flow-sequence-widget', 'bidirectional-flow');
            const compiledTemplate = handlebars.compile(template);
            const result = compiledTemplate(context);
            expect(result.trim()).toBe(expected);
        });

        it('renders a flow with interacts and connects', () => {
            const { context, template, expected } = fixtures.loadFixture('flow-sequence-widget', 'interacts-and-connects-flow');
            const compiledTemplate = handlebars.compile(template);
            const result = compiledTemplate(context);
            expect(result.trim()).toBe(expected);
        });

        it('renders a flow from a nested architecture in node details', () => {
            const { context, template, expected } = fixtures.loadFixture('flow-sequence-widget', 'nested-details-flow');

            const compiledTemplate = handlebars.compile(template);
            const result = compiledTemplate(context);
            expect(result.trim()).toBe(expected);
        });
    });

    describe('Related Nodes Widget', () => {
        it('renders an interacts relationship', () => {
            const { context, template, expected } = fixtures.loadFixture('related-nodes-widget', 'relationship-interacts');
            const compiled = handlebars.compile(template);
            const result = compiled(context);
            expect(result.trim()).toBe(expected);
        });

        it('renders a connects relationship', () => {
            const { context, template, expected } = fixtures.loadFixture('related-nodes-widget', 'relationship-connects');
            const compiled = handlebars.compile(template);
            const result = compiled(context);
            expect(result.trim()).toBe(expected);
        });

        it('renders a composed relationship', () => {
            const { context, template, expected } = fixtures.loadFixture('related-nodes-widget', 'relationship-composed');
            const compiled = handlebars.compile(template);
            const result = compiled(context);
            expect(result.trim()).toBe(expected);
        });

        it('renders a deployed-in relationship', () => {
            const { context, template, expected } = fixtures.loadFixture('related-nodes-widget', 'relationship-deployed');
            const compiled = handlebars.compile(template);
            const result = compiled(context);
            expect(result.trim()).toBe(expected);
        });

        it('renders a node composed-of + connects relationships', () => {
            const { context, template, expected } = fixtures.loadFixture('related-nodes-widget', 'node-composed-connects');
            const compiled = handlebars.compile(template);
            const result = compiled(context);
            expect(result.trim()).toBe(expected);
        });

        it('renders a node with related relationships', () => {
            const { context, template, expected } = fixtures.loadFixture('related-nodes-widget', 'node-with-related');
            const compiled = handlebars.compile(template);
            const result = compiled(context);
            expect(result.trim()).toBe(expected);
        });
    });

    describe('Block Architecture Widget', () => {
        it('renders basic architecture structures (empty, single system, multiple systems)', () => {
            const { context, template, expected } = fixtures.loadFixture('block-architecture-widget', 'basic-structures');
            const compiled = handlebars.compile(template);
            const result = compiled(context);
            expect(result.trim()).toBe(expected);
        });

        // Interface rendering variations - consolidated from interfaces-off, interfaces-on-both, interfaces-on-one-side
        it('handles all interface rendering variations in one comprehensive test', () => {
            const { context, template, expected } = fixtures.loadFixture('block-architecture-widget', 'interface-variations');
            const compiled = handlebars.compile(template);
            const result = compiled(context);
            expect(result.trim()).toBe(expected);
        });

        // Complex real-world scenarios - keep these as they demonstrate practical use cases
        it('renders enterprise bank trading system with mixed communication patterns', () => {
            const { context, template, expected } = fixtures.loadFixture('block-architecture-widget', 'enterprise-bank-trading');
            const compiled = handlebars.compile(template);
            const result = compiled(context);
            expect(result.trim()).toBe(expected);
        });

        it('renders enterprise bank with clickable navigation pattern and progressive detail levels', () => {
            const { context, template, expected } = fixtures.loadFixture('block-architecture-widget', 'enterprise-bank-navigation');
            const compiled = handlebars.compile(template);
            const result = compiled(context);
            expect(result.trim()).toBe(expected);
        });

        it('renders a nested architecture with nested relationships', () => {
            const { context, template, expected } = fixtures.loadFixture('block-architecture-widget', 'nested-architecture');
            const compiled = handlebars.compile(template);
            const result = compiled(context);
            expect(result.trim()).toBe(expected);
        });

        it('renders large topology with many nodes and connections efficiently', () => {
            const { context, template, expected } = fixtures.loadFixture('block-architecture-widget', 'large-topology');
            const compiled = handlebars.compile(template);
            const result = compiled(context);
            expect(result.trim()).toBe(expected);
        });

        it('applies domain interaction diagram', () => {
            const { context, template, expected } = fixtures.loadFixture('block-architecture-widget', 'domain-interaction');
            const compiled = handlebars.compile(template);
            const result = compiled(context);
            expect(result.trim()).toBe(expected);
        });

        // New focus flows test - demonstrates flow-based filtering
        it('filters architecture based on specific flows', () => {
            const { context, template, expected } = fixtures.loadFixture('block-architecture-widget', 'focus-flows');
            const compiled = handlebars.compile(template);
            const result = compiled(context);
            expect(result.trim()).toBe(expected);
        });

        it('filters architecture based on interface matching by unique-id and properties', () => {
            const { context, template, expected } = fixtures.loadFixture('block-architecture-widget', 'focus-interfaces');
            const compiled = handlebars.compile(template);
            const result = compiled(context);
            expect(result.trim()).toBe(expected);
        });

        it('filters architecture based on control matching by ID and properties', () => {
            const { context, template, expected } = fixtures.loadFixture('block-architecture-widget', 'focus-controls');
            const compiled = handlebars.compile(template);
            const result = compiled(context);
            expect(result.trim()).toBe(expected);
        });

        it('filters architecture based on node focusing with comprehensive scenarios', () => {
            const { context, template, expected } = fixtures.loadFixture('block-architecture-widget', 'focus-nodes');
            const compiled = handlebars.compile(template);
            const result = compiled(context);
            expect(result.trim()).toBe(expected);
        });

        it('filters architecture based on relationship focusing by unique-id', () => {
            const { context, template, expected } = fixtures.loadFixture('block-architecture-widget', 'focus-relationships');
            const compiled = handlebars.compile(template);
            const result = compiled(context);
            expect(result.trim()).toBe(expected);
        });
    });
});
