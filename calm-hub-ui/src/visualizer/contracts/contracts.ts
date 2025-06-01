import cytoscape from 'cytoscape';
import { CalmInterfaceSchema } from '@finos/calm-shared/src/types/core-types.js';
import { CalmControlsSchema } from '@finos/calm-shared/src/types/control-types.js';

export type CytoscapeNode = {
    classes?: string;
    data: CytoscapeNodeData & {
        parent?: string;
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
    label: string;
    interfaces?: CalmInterfaceSchema[];
    controls?: CalmControlsSchema;
};

export type Edge = {
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
