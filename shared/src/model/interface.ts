import {
    CalmNodeInterfaceSchema
} from '../types/interface-types.js';
import { CalmInterfaceDefinitionSchema, CalmInterfaceTypeSchema } from '../types/interface-types.js';
import { CalmInterfaceSchema } from '../types/core-types.js';

const calmInterfaceDefinitionRequiredProperties = [
    'unique-id', 'definition-url', 'config'
].sort();


export class CalmInterface {
    constructor(public uniqueId: string) { }

    static fromJson(data: CalmInterfaceSchema): CalmInterface {
        // Compare data property names with the required properties
        // for CalmInterfaceDefinition
        const dataKeys = Object.keys(data).sort();
        if (dataKeys.length === calmInterfaceDefinitionRequiredProperties.length
            && dataKeys.every((val, index) => val === calmInterfaceDefinitionRequiredProperties[index])) {
            return CalmInterfaceDefinition.fromJson(data as CalmInterfaceDefinitionSchema);
        }
        return CalmInterfaceType.fromJson(data as CalmInterfaceTypeSchema);
    }
}

export class CalmInterfaceDefinition extends CalmInterface {
    constructor(
        public uniqueId: string,
        public interfaceDefinitionUrl: string,
        public configuration: Record<string, unknown>
    ) {
        super(uniqueId);
    }

    static fromJson(data: CalmInterfaceDefinitionSchema): CalmInterfaceDefinition {
        return new CalmInterfaceDefinition(
            data['unique-id'],
            data['definition-url'],
            data.config
        );
    }
}

export class CalmInterfaceType extends CalmInterface {
    constructor(
        public uniqueId: string,
        public additionalProperties: Record<string, unknown>
    ) {
        super(uniqueId);
    }

    static fromJson(data: CalmInterfaceTypeSchema): CalmInterfaceType {
        const { 'unique-id': uniqueId, ...additionalProperties } = data;
        return new CalmInterfaceType(uniqueId, additionalProperties);
    }
}

export class CalmNodeInterface {
    constructor(public node: string, public interfaces: string[] = []) { }

    static fromJson(data: CalmNodeInterfaceSchema): CalmNodeInterface {
        return new CalmNodeInterface(data.node, data.interfaces ?? []);
    }
}
