import { CalmComposedOfRelationship, CalmConnectsRelationship, CalmDeployedInRelationship, CalmInteractsRelationship, CalmNode } from './model';

export interface CalmVisitor {
    visitCalmNode(element: CalmNode): void;

    visitCalmConnectsRelationship(element: CalmConnectsRelationship): void;
    visitCalmInteractsRelationship(element: CalmInteractsRelationship): void;
    visitCalmComposedOfRelationship(element: CalmComposedOfRelationship): void;
    visitCalmDeployedInRelationship(element: CalmDeployedInRelationship): void;
}

export class BaseCalmVisitor implements CalmVisitor {
    visitCalmNode(_element: CalmNode): void {}

    visitCalmConnectsRelationship(_element: CalmConnectsRelationship): void {}
    visitCalmInteractsRelationship(_element: CalmInteractsRelationship): void {}
    visitCalmComposedOfRelationship(_element: CalmComposedOfRelationship): void {}
    visitCalmDeployedInRelationship(_element: CalmDeployedInRelationship): void {}
}