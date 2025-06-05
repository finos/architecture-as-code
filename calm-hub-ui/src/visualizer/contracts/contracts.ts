import cytoscape from "cytoscape";
import {
    CalmInterfaceTypeSchema,
    CalmHostPortInterfaceSchema,
    CalmHostnameInterfaceSchema,
    CalmPathInterfaceSchema,
    CalmOAuth2AudienceInterfaceSchema,
    CalmURLInterfaceSchema,
    CalmRateLimitInterfaceSchema,
    CalmContainerImageInterfaceSchema,
    CalmPortInterfaceSchema,
} from '../../../../shared/src/types/interface-types.js';
import { CalmControlsSchema } from '../../../../shared/src/types/control-types.js';

export type CalmNode = {
    classes?: string;
    data: {
        description: string;
        type: string;
        label: string;
        id: string;
        labelWithDescription: string;
        labelWithoutDescription: string;
        parent?: string;
        interfaces?: (
            | CalmInterfaceTypeSchema
            | CalmHostPortInterfaceSchema
            | CalmHostnameInterfaceSchema
            | CalmPathInterfaceSchema
            | CalmOAuth2AudienceInterfaceSchema
            | CalmURLInterfaceSchema
            | CalmRateLimitInterfaceSchema
            | CalmContainerImageInterfaceSchema
            | CalmPortInterfaceSchema
        )[];
        controls?: CalmControlsSchema;
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