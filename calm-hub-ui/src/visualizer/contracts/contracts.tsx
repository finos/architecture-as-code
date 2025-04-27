import cytoscape from "cytoscape";

export type Node = {
    classes?: string;
    data: {
        description: string;
        type: string;
        label: string;
        id: string;
        _displayPlaceholderWithDesc: string;
        _displayPlaceholderWithoutDesc: string;
        [idx: string]: string;
    };
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
    nodeBoundingBox: BoundingBox
};

export type IdAndPosition = {
    nodeId: string;
    position: cytoscape.Position;
};