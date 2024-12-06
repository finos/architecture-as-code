import { CALMNode, CALMRelationship } from './types';

export interface NodeLayout extends CALMNode {
    x: number;
    y: number;
}

export type RelationshipLayout = CALMRelationship;
