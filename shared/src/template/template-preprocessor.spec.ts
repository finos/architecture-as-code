import { describe, it, expect } from 'vitest';
import { TemplatePreprocessor } from './template-preprocessor';

describe('TemplatePreprocessor', () => {
    it('rewrites path with single quotes and extras', () => {
        const input = '{{list nodes[\'unique-id=="Upload Service"\'] ordered="true" property="name"}}';
        const output = TemplatePreprocessor.preprocessTemplate(input);

        expect(output).toBe(
            '{{list (convertFromDotNotation this "nodes[\'unique-id==\\"Upload Service\\"\']"  ordered="true" property="name") ordered="true" property="name"}}'
        );
    });

    it('rewrites path with single quotes and no extras', () => {
        const input = '{{list nodes[\'unique-id=="Upload Service"\']}}';
        const output = TemplatePreprocessor.preprocessTemplate(input);

        expect(output).toBe('{{list (convertFromDotNotation this "nodes[\'unique-id==\\"Upload Service\\"\']" )}}');
    });

    it('rewrites path with double quotes already present', () => {
        const input = '{{list nodes[unique-id=="Upload Service"]}}';
        const output = TemplatePreprocessor.preprocessTemplate(input);

        expect(output).toBe('{{list (convertFromDotNotation this "nodes[unique-id==\\"Upload Service\\"]" )}}');
    });

    it('leaves non-convertFromDotNotation able paths unchanged', () => {
        const input = '{{list nodes ordered="true"}}';
        const output = TemplatePreprocessor.preprocessTemplate(input);

        expect(output).toBe('{{list (convertFromDotNotation this "nodes"  ordered="true") ordered="true"}}');
    });

    it('handles multiple occurrences in the same template', () => {
        const input = `
        {{list nodes['unique-id=="A"'] ordered="true"}}
        {{summary nodes['unique-id=="B"']}}
        `;
        const output = TemplatePreprocessor.preprocessTemplate(input);

        expect(output).toContain('{{list (convertFromDotNotation this "nodes[\'unique-id==\\"A\\"\']"  ordered="true") ordered="true"}}');
        expect(output).toContain('{{summary (convertFromDotNotation this "nodes[\'unique-id==\\"B\\"\']" )}}');
    });

    it('wraps nodes[...] without helper as convertFromDotNotation', () => {
        const input = '{{nodes[unique-id=="Upload Service"]}}';
        const output = TemplatePreprocessor.preprocessTemplate(input);
        expect(output).toBe('{{convertFromDotNotation this "nodes[unique-id==\\"Upload Service\\"]"}}');
    });

    it('wraps quoted nodes[...] without helper as convertFromDotNotation', () => {
        const input = '{{nodes[\'unique-id=="Upload Service"\']}}';
        const output = TemplatePreprocessor.preprocessTemplate(input);
        expect(output).toBe('{{convertFromDotNotation this "nodes[\'unique-id==\\"Upload Service\\"\']"}}');
    });

    it('wraps multiple bracket filters correctly', () => {
        const input = '{{relationships[\'type=="connect"\'][\'direction=="inbound"\']}}';
        const output = TemplatePreprocessor.preprocessTemplate(input);
        expect(output).toBe('{{convertFromDotNotation this "relationships[\'type==\\"connect\\"\'][\'direction==\\"inbound\\"\']"}}');
    });

    it('wraps deeply nested relationship path using bracket and dot notation', () => {
        const input = '{{list relationships[\'deployed-in-k8s-cluster\'][\'relationship-type\'][\'deployed-in\'].nodes ordered="true"}}';
        const output = TemplatePreprocessor.preprocessTemplate(input);

        expect(output).toBe('{{list (convertFromDotNotation this "relationships[\'deployed-in-k8s-cluster\'][\'relationship-type\'][\'deployed-in\'].nodes"  ordered="true") ordered="true"}}');
    });

});
