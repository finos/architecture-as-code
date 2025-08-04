import { describe, it, expect } from 'vitest';
import TemplateDefaultTransformer from './template-default-transformer';
import {CalmCore} from '../model/core';

describe('TemplateDefaultTransformer', () => {
    const transformer = new TemplateDefaultTransformer();

    const paymentGatewayJson = JSON.stringify(
        {
            nodes: [
                {
                    'unique-id': 'payment-api',
                    'name': 'Payment API',
                    'description': 'Handles incoming payment requests',
                    'node-type': 'service'
                },
                {
                    'unique-id': 'payment-db',
                    'name': 'Payment Database',
                    'description': 'Stores transaction records',
                    'node-type': 'database'
                }
            ],
            relationships: [
                {
                    'unique-id': 'api-to-db',
                    'description': 'API stores transaction data in DB',
                    'relationship-type': {
                        connects: {
                            source: {
                                node: 'payment-api'
                            },
                            destination: {
                                node: 'payment-db'
                            }
                        }
                    }
                }
            ]
        }
    );

    it('should transform a Payment Gateway CALM document with two nodes and one relationship', () => {
        const result = transformer.getTransformedModel(CalmCore.fromSchema(JSON.parse(paymentGatewayJson)));

        expect(result).toHaveProperty('document');
        const doc = result.document;
        expect(doc.nodes).toHaveLength(2);
        expect(doc.nodes[0].name).toBe('Payment API');
        expect(doc.nodes[1].name).toBe('Payment Database');

        expect(doc.relationships).toHaveLength(1);
        expect(doc.relationships[0].description).toContain('transaction');
    });

    it('should register and execute all helpers correctly', () => {
        const helpers = transformer.registerTemplateHelpers();

        expect(helpers.eq('a', 'a')).toBe(true);
        expect(helpers.eq(1, 2)).toBe(false);
        expect(helpers.lookup({ foo: 'bar' }, 'foo')).toBe('bar');
        expect(helpers.json({ a: 1 })).toContain('"a": 1');
        expect(helpers.instanceOf([], 'Array')).toBe(true);

        expect(helpers.kebabToTitleCase('payment-api')).toBe('Payment Api');
        expect(helpers.kebabCase('Payment API')).toBe('payment-api');
        expect(helpers.isObject({})).toBe(true);
        expect(helpers.isObject(null)).toBe(false);
        expect(helpers.isArray(['x'])).toBe(true);
        expect(helpers.isArray({})).toBe(false);
        expect(helpers.join(['x', 'y'], '|')).toBe('x|y');
    });

    it('should throw for invalid JSON input', () => {
        const invalidJson = '{ invalid json }';
        expect(() => transformer.getTransformedModel(CalmCore.fromSchema(JSON.parse(invalidJson)))).toThrow();
    });
});
