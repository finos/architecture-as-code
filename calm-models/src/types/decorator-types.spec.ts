import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import decoratorsSchema from '@finos/calm-schema/schema/decorators.json' with { type: 'json' };
import decoratorFixture from '../test/resources/test-decorator.json' with { type: 'json' };
import { CalmDecoratorSchema, CalmDecoratorTargetTypeSchema } from './decorator-types';

describe('CalmDecoratorSchema', () => {
    const decoratorDefinition = decoratorsSchema.defs.decorator;
    const ajv = new Ajv2020({ strict: false });
    ajv.addSchema(decoratorsSchema);
    const validate = ajv.compile({ $ref: `${decoratorsSchema.$id}#/defs/decorator` });

    const fullDecorator: Required<CalmDecoratorSchema> = {
        $schema: 'https://calm.finos.org/standards/deployment/1.0/deployment.decorator.standard.json',
        'unique-id': 'deployment-1',
        type: 'deployment',
        'target-type': ['architecture'],
        target: ['architecture.json'],
        'applies-to': ['web-service'],
        data: { status: 'completed' }
    };

    const minimalDecorator: CalmDecoratorSchema = {
        'unique-id': 'deployment-1',
        type: 'deployment',
        target: ['architecture.json'],
        'applies-to': ['web-service'],
        data: { status: 'completed' }
    };

    it('has every property of the CALM decorator', () => {
        expect(Object.keys(fullDecorator).sort()).toEqual(Object.keys(decoratorDefinition.properties).sort());
        expect(validate(fullDecorator)).toBe(true);
    });

    it('requires the properties that the CALM decorator requires', () => {
        expect(Object.keys(minimalDecorator).sort()).toEqual([...decoratorDefinition.required].sort());
        expect(validate(minimalDecorator)).toBe(true);
    });

    it('allows the target types of the CALM decorator', () => {
        const targetTypes: CalmDecoratorTargetTypeSchema[] = ['architecture'];
        expect(targetTypes).toEqual(decoratorDefinition.properties['target-type'].items.enum);
    });

    // The Java model tests round-trip this fixture, so it must stay a valid decorator with every property.
    it('describes a valid decorator with every property in the Java model fixture', () => {
        expect(Object.keys(decoratorFixture).sort()).toEqual(Object.keys(decoratorDefinition.properties).sort());
        expect(validate(decoratorFixture)).toBe(true);
    });
});
