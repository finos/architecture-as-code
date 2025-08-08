import fs from 'fs';
import path from 'path';

export interface TestFixture {
    context: unknown;
    template: string;
    expected: string;
}

export class FixtureLoader {
    private readonly fixturesPath: string;

    constructor(fixturesPath: string = path.join(__dirname, '../../test-fixtures')) {
        this.fixturesPath = fixturesPath;
    }

    loadFixture(widget: string, scenario: string): TestFixture {
        const scenarioPath = path.join(this.fixturesPath, widget, scenario);

        const contextPath = path.join(scenarioPath, 'context.json');
        const templatePath = path.join(scenarioPath, 'template.hbs');
        const expectedPath = path.join(scenarioPath, 'expected.md');

        if (!fs.existsSync(contextPath)) {
            throw new Error(`Context file not found: ${contextPath}`);
        }
        if (!fs.existsSync(templatePath)) {
            throw new Error(`Template file not found: ${templatePath}`);
        }
        if (!fs.existsSync(expectedPath)) {
            throw new Error(`Expected file not found: ${expectedPath}`);
        }

        const context = JSON.parse(fs.readFileSync(contextPath, 'utf-8'));
        const template = fs.readFileSync(templatePath, 'utf-8');
        const expected = fs.readFileSync(expectedPath, 'utf-8').trim();

        return { context, template, expected };
    }

    listScenarios(widget: string): string[] {
        const widgetPath = path.join(this.fixturesPath, widget);
        if (!fs.existsSync(widgetPath)) {
            return [];
        }
        return fs.readdirSync(widgetPath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);
    }

    listWidgets(): string[] {
        if (!fs.existsSync(this.fixturesPath)) {
            return [];
        }
        return fs.readdirSync(this.fixturesPath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);
    }
}
