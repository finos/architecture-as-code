import { CalmVisitor } from './visitor';

export interface CalmItem {
    accept(visitor: CalmVisitor): void;
}

export type CalmNodeType = 'actor' | 'system' | 'service' | 'database' | 'network' | 'ldap' | 'dataclient';

export class CalmNode implements CalmItem {
    constructor(
        public uniqueId: string,
        public name: string,
        public description: string,
        public type: CalmNodeType,
        public originalJson: object
    ){};

    accept(visitor: CalmVisitor): void {
        visitor.visitCalmNode(this);
    }
}

export class CalmConnectsRelationship implements CalmItem {
    constructor(
        public uniqueId: string,
        public description: string,
        public source: string,
        public target: string,
        public originalJson: object
    ){};

    accept(visitor: CalmVisitor): void {
        visitor.visitCalmConnectsRelationship(this);
    }
}

export class CalmInteractsRelationship implements CalmItem {
    constructor(
        public uniqueId: string,
        public description: string,
        public actor: string,
        public nodes: string[],
        public originalJson: object
    ){};

    accept(visitor: CalmVisitor): void {
        visitor.visitCalmInteractsRelationship(this);
    }
}

export class CalmComposedOfRelationship implements CalmItem {
    constructor(
        public uniqueId: string,
        public description: string,
        public container: string,
        public nodes: string[],
        public originalJson: object
    ){};

    accept(visitor: CalmVisitor): void {
        visitor.visitCalmComposedOfRelationship(this);
    }
}

export class CalmDeployedInRelationship implements CalmItem {
    constructor(
        public uniqueId: string,
        public description: string,
        public container: string,
        public nodes: string[],
        public originalJson: object
    ){};

    accept(visitor: CalmVisitor): void {
        visitor.visitCalmDeployedInRelationship(this);
    }
}