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
});
