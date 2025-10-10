import cytoscape from 'cytoscape';
import { CalmInterfaceSchema, CalmControlsSchema } from '@finos/calm-models/types';

export type CytoscapeNode = {
    classes?: string;
    data: CytoscapeNodeData & {
        cytoscapeProps: {
            labelWithDescription: string;
            labelWithoutDescription: string;
        };
    };
};

export type CytoscapeNodeData = {
    id: string;
    description: string;
    type: string;
    name: string;
    interfaces?: CalmInterfaceSchema[];
    controls?: CalmControlsSchema;
    parent?: string;
};

export type CytoscapeEdge = {
    data: {
        id: string;
        label: string;
        source: string;
        target: string;
        [idx: string]: string;
    };
};

export type BoundingBox = cytoscape.BoundingBox12 & cytoscape.BoundingBoxWH;

export type IdAndBoundingBox = {
    nodeId: string;
    boundingBox: BoundingBox;
};

export type NodeLayoutViolations = {
    shouldBeInside: IdAndBoundingBox[];
    shouldBeOutside: IdAndBoundingBox[];
    nodeBoundingBox: BoundingBox;
};

export type IdAndPosition = {
    nodeId: string;
    position: cytoscape.Position;
};
