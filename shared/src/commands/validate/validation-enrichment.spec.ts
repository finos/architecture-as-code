import { describe, it, expect } from 'vitest';
import {
    parseDocumentWithPositions,
    enrichWithDocumentPositions
} from './validation-enrichment.js';
import { ValidationOutcome, ValidationOutput } from './validation.output.js';

describe('parseDocumentWithPositions', () => {
    it('should parse valid JSON and return context with data and parseResult', () => {
        const content = '{"nodes": [{"unique-id": "node-1"}]}';
        const result = parseDocumentWithPositions(content, 'architecture');

        expect(result).toBeDefined();
        expect(result!.id).toBe('architecture');
        expect(result!.data).toEqual({ nodes: [{ 'unique-id': 'node-1' }] });
        expect(result!.parseResult).toBeDefined();
        expect(result!.parseResult.data).toEqual({ nodes: [{ 'unique-id': 'node-1' }] });
    });

    it('should return context with diagnostics for malformed JSON', () => {
        const content = '{"nodes": [invalid json}';
        const result = parseDocumentWithPositions(content, 'test');

        // @stoplight/json doesn't throw, it returns diagnostics
        expect(result).toBeDefined();
        expect(result!.parseResult.diagnostics.length).toBeGreaterThan(0);
    });

    it('should return undefined for empty string', () => {
        const content = '';
        const result = parseDocumentWithPositions(content, 'test');

        // Empty string parses to undefined data
        expect(result).toBeDefined();
        expect(result!.data).toBeUndefined();
    });

    it('should handle JSON with different data types', () => {
        const content = '{"string": "value", "number": 42, "boolean": true, "null": null, "array": [1,2,3]}';
        const result = parseDocumentWithPositions(content, 'mixed');

        expect(result).toBeDefined();
        expect(result!.data).toEqual({
            string: 'value',
            number: 42,
            boolean: true,
            null: null,
            array: [1, 2, 3]
        });
    });

    it('should preserve the id in the returned context', () => {
        const content = '{}';
        
        const result1 = parseDocumentWithPositions(content, 'architecture');
        const result2 = parseDocumentWithPositions(content, 'pattern');

        expect(result1!.id).toBe('architecture');
        expect(result2!.id).toBe('pattern');
    });
});

describe('enrichWithDocumentPositions', () => {
    const createValidationOutput = (path: string, source?: string): ValidationOutput => {
        return new ValidationOutput('test-code', 'error', 'Test message', path, undefined, undefined, undefined, undefined, undefined, source);
    };

    const createOutcome = (outputs: ValidationOutput[]): ValidationOutcome => {
        return new ValidationOutcome(outputs, [], true, false);
    };

    it('should enrich validation output with line numbers from parsed document', () => {
        const content = `{
  "nodes": [
    {
      "unique-id": "node-1",
      "name": "Test Node"
    }
  ]
}`;
        const parseContext = parseDocumentWithPositions(content, 'architecture')!;
        const output = createValidationOutput('/nodes/0');
        const outcome = createOutcome([output]);

        enrichWithDocumentPositions(outcome, { architecture: parseContext });

        expect(output.line_start).toBeDefined();
        expect(output.line_end).toBeDefined();
        expect(output.line_start).toBeGreaterThan(0);
    });

    it('should handle outputs with unique-id based paths', () => {
        const content = `{
  "nodes": [
    {"unique-id": "api-gateway", "name": "API Gateway"},
    {"unique-id": "database", "name": "Database"}
  ]
}`;
        const parseContext = parseDocumentWithPositions(content, 'architecture')!;
        const output = createValidationOutput('/nodes/database');
        const outcome = createOutcome([output]);

        enrichWithDocumentPositions(outcome, { architecture: parseContext });

        // Should find the node by unique-id and provide line numbers
        expect(output.line_start).toBeDefined();
        expect(output.path).toBe('/nodes/database'); // Path preserved with id
    });

    it('should handle missing context gracefully', () => {
        const output = createValidationOutput('/nodes/0');
        const outcome = createOutcome([output]);

        // No contexts provided
        enrichWithDocumentPositions(outcome, {});

        // Should not throw, output unchanged
        expect(output.line_start).toBeUndefined();
        expect(output.line_end).toBeUndefined();
    });

    it('should handle null outcome gracefully', () => {
        const parseContext = parseDocumentWithPositions('{}', 'architecture')!;

        // Should not throw
        expect(() => {
            enrichWithDocumentPositions(null as unknown as ValidationOutcome, { architecture: parseContext });
        }).not.toThrow();
    });

    it('should handle outcome with no allValidationOutputs method', () => {
        const parseContext = parseDocumentWithPositions('{}', 'architecture')!;
        const badOutcome = {} as ValidationOutcome;

        // Should not throw
        expect(() => {
            enrichWithDocumentPositions(badOutcome, { architecture: parseContext });
        }).not.toThrow();
    });

    it('should infer architecture source when not specified', () => {
        const content = '{"nodes": []}';
        const parseContext = parseDocumentWithPositions(content, 'architecture')!;
        const output = createValidationOutput('/nodes', undefined); // no source
        const outcome = createOutcome([output]);

        enrichWithDocumentPositions(outcome, { architecture: parseContext });

        expect(output.source).toBe('architecture');
    });

    it('should infer pattern source when only pattern context available', () => {
        const content = '{"nodes": []}';
        const parseContext = parseDocumentWithPositions(content, 'pattern')!;
        const output = createValidationOutput('/nodes', undefined);
        const outcome = createOutcome([output]);

        enrichWithDocumentPositions(outcome, { pattern: parseContext });

        expect(output.source).toBe('pattern');
    });

    it('should use explicit source from output when available', () => {
        const archContent = '{"nodes": [{"unique-id": "a"}]}';
        const patternContent = '{"nodes": [{"unique-id": "b"}]}';
        const archContext = parseDocumentWithPositions(archContent, 'architecture')!;
        const patternContext = parseDocumentWithPositions(patternContent, 'pattern')!;
        
        const output = createValidationOutput('/nodes/0', 'pattern');
        const outcome = createOutcome([output]);

        enrichWithDocumentPositions(outcome, { 
            architecture: archContext, 
            pattern: patternContext 
        });

        expect(output.source).toBe('pattern');
    });

    it('should handle deeply nested paths', () => {
        const content = `{
  "nodes": [
    {
      "unique-id": "service",
      "interfaces": [
        {
          "unique-id": "api",
          "port": 8080
        }
      ]
    }
  ]
}`;
        const parseContext = parseDocumentWithPositions(content, 'architecture')!;
        const output = createValidationOutput('/nodes/0/interfaces/0/port');
        const outcome = createOutcome([output]);

        enrichWithDocumentPositions(outcome, { architecture: parseContext });

        expect(output.line_start).toBeDefined();
    });

    it('should handle invalid path gracefully', () => {
        const content = '{"nodes": []}';
        const parseContext = parseDocumentWithPositions(content, 'architecture')!;
        const output = createValidationOutput('/nonexistent/path/here');
        const outcome = createOutcome([output]);

        enrichWithDocumentPositions(outcome, { architecture: parseContext });

        // Should not throw, line numbers remain undefined
        expect(output.line_start).toBeUndefined();
    });

    it('should handle path without leading slash', () => {
        const content = '{"nodes": []}';
        const parseContext = parseDocumentWithPositions(content, 'architecture')!;
        const output = createValidationOutput('nodes'); // no leading slash
        const outcome = createOutcome([output]);

        enrichWithDocumentPositions(outcome, { architecture: parseContext });

        // Invalid JSON pointer format, should not crash
        expect(output.line_start).toBeUndefined();
    });

    it('should handle empty path', () => {
        const content = '{"nodes": []}';
        const parseContext = parseDocumentWithPositions(content, 'architecture')!;
        const output = createValidationOutput('');
        const outcome = createOutcome([output]);

        enrichWithDocumentPositions(outcome, { architecture: parseContext });

        // Empty path, should not crash
        expect(output.line_start).toBeUndefined();
    });

    it('should rewrite array index paths to use unique-ids', () => {
        const content = `{
  "relationships": [
    {"unique-id": "rel-1", "source": "a", "target": "b"},
    {"unique-id": "rel-2", "source": "c", "target": "d"}
  ]
}`;
        const parseContext = parseDocumentWithPositions(content, 'architecture')!;
        const output = createValidationOutput('/relationships/1');
        const outcome = createOutcome([output]);

        enrichWithDocumentPositions(outcome, { architecture: parseContext });

        // Path should be rewritten to use unique-id
        expect(output.path).toBe('/relationships/rel-2');
    });

    it('should handle multiple outputs in single outcome', () => {
        const content = `{
  "nodes": [
    {"unique-id": "node-1"},
    {"unique-id": "node-2"}
  ]
}`;
        const parseContext = parseDocumentWithPositions(content, 'architecture')!;
        const output1 = createValidationOutput('/nodes/0');
        const output2 = createValidationOutput('/nodes/1');
        const outcome = createOutcome([output1, output2]);

        enrichWithDocumentPositions(outcome, { architecture: parseContext });

        expect(output1.line_start).toBeDefined();
        expect(output2.line_start).toBeDefined();
        expect(output1.line_start).not.toBe(output2.line_start);
    });

    it('should handle spectral outputs as well as json schema outputs', () => {
        const content = '{"nodes": [{"unique-id": "n1"}]}';
        const parseContext = parseDocumentWithPositions(content, 'architecture')!;
        
        const jsonOutput = createValidationOutput('/nodes/0');
        const spectralOutput = createValidationOutput('/nodes/0');
        
        const outcome = new ValidationOutcome([jsonOutput], [spectralOutput], true, false);

        enrichWithDocumentPositions(outcome, { architecture: parseContext });

        expect(jsonOutput.line_start).toBeDefined();
        expect(spectralOutput.line_start).toBeDefined();
    });
});
