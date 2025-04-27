import { describe, it, vi, beforeEach, expect } from "vitest";
import cytoscape from "cytoscape";
import { LayoutCorrectionService } from "../visualizer/services/layout-correction-service.js";
import { Node } from '../visualizer/contracts/contracts.js';
import { afterEach } from "node:test";

describe(LayoutCorrectionService.name, () => {

    let mockCyRef: cytoscape.Core;
    let mockCyRefGetElementById: cytoscape.NodeSingular;

    beforeEach(() => {
        mockCyRefGetElementById = {
            boundingBox: vi.fn().mockReturnValue({
                x1: 0,
                y1: 0,
                x2: 100,
                y2: 100,
                w: 100,
                h: 100,
            }),
            position: vi.fn(),
        } as unknown as cytoscape.NodeSingular;
        mockCyRef = {
            getElementById: vi.fn().mockImplementation(() => mockCyRefGetElementById),
            nodes: vi.fn().mockReturnValue([]),
            edges: vi.fn().mockReturnValue([]),
          } as unknown as cytoscape.Core;
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    function getInstance(): LayoutCorrectionService {
        return new LayoutCorrectionService();
    }

    it('should call getElementById and bounding box functions on nodes to determine the nodes to be moved', () => {
        const instance = getInstance();
        const nodes: Node[] = [
            {
                classes: "class1",
                data: {
                    description: "Node 1 description",
                    type: "type1",
                    label: "Node 1",
                    id: "node1",
                    _displayPlaceholderWithDesc: "Display 1 with desc",
                    _displayPlaceholderWithoutDesc: "Display 1 without desc",
                    extraField: "extraValue1",
                },
            },
            {
                classes: "class2",
                data: {
                    description: "Node 2 description",
                    type: "type2",
                    label: "Node 2",
                    id: "node2",
                    _displayPlaceholderWithDesc: "Display 2 with desc",
                    _displayPlaceholderWithoutDesc: "Display 2 without desc",
                    extraField: "extraValue2",
                },
            },
            {
                classes: "class3",
                data: {
                    description: "Node 3 description",
                    type: "type3",
                    label: "Node 3",
                    id: "node3",
                    parent: "node1",
                    _displayPlaceholderWithDesc: "Display 3 with desc",
                    _displayPlaceholderWithoutDesc: "Display 3 without desc",
                    extraField: "extraValue3",
                },
            },
        ];

        instance.calculateAndUpdateNodePositions(mockCyRef, nodes);
        expect(mockCyRef.getElementById).toHaveBeenCalledWith("node1");
        expect(mockCyRef.getElementById).toHaveBeenCalledWith("node2");
        expect(mockCyRef.getElementById).toHaveBeenCalledWith("node3");
        expect(mockCyRefGetElementById.boundingBox).toHaveBeenCalledTimes(7);
    });

    it('should update position for nodes that are inside non-parents', () => {
        const instance = getInstance();
        //Here, node 2 is inside node 1 but node 1 is not node 2's parent
        //So, node 2 is expected to be moved, but node 1 and node 3 are not
        const nodes: Node[] = [
            {
                classes: "class1",
                data: {
                    description: "Node 1 description",
                    type: "type1",
                    label: "Node 1",
                    id: "node1",
                    _displayPlaceholderWithDesc: "Display 1 with desc",
                    _displayPlaceholderWithoutDesc: "Display 1 without desc",
                    extraField: "extraValue1",
                },
            },
            {
                classes: "class2",
                data: {
                    description: "Node 2 description",
                    type: "type2",
                    label: "Node 2",
                    id: "node2",
                    _displayPlaceholderWithDesc: "Display 2 with desc",
                    _displayPlaceholderWithoutDesc: "Display 2 without desc",
                    extraField: "extraValue2",
                },
            },
            {
                classes: "class3",
                data: {
                    description: "Node 3 description",
                    type: "type3",
                    label: "Node 3",
                    id: "node3",
                    parent: "node1",
                    _displayPlaceholderWithDesc: "Display 3 with desc",
                    _displayPlaceholderWithoutDesc: "Display 3 without desc",
                    extraField: "extraValue3",
                },
            },
        ];

        instance.calculateAndUpdateNodePositions(mockCyRef, nodes);
        //Once for node 2
        expect(mockCyRefGetElementById.position).toHaveBeenCalledWith({
            x: -100, y: -100,
        });
    });

    it('should update position for nodes that are not inside their parents', () => {
        const instance = getInstance();
        const mockCyRefGetElementByIdNode1 = {
            boundingBox: vi.fn().mockReturnValue({
                x1: 0,
                y1: 0,
                x2: 100,
                y2: 100,
                w: 100,
                h: 100,
            }),
            position: vi.fn(),
        };
        const mockCyRefGetElementByIdNode2 = {
            boundingBox: vi.fn().mockReturnValue({
                x1: 150,
                y1: 150,
                x2: 250,
                y2: 250,
                w: 100,
                h: 100,
            }),
            position: vi.fn(),
        };
        const mockCyRefGetElementByIdNode3 = {
            boundingBox: vi.fn().mockReturnValue({
                x1: -150,
                y1: -150,
                x2: -50,
                y2: -50,
                w: 100,
                h: 100,
            }),
            position: vi.fn(),
        };
        mockCyRef = {
            getElementById: vi.fn().mockImplementation((id) => {
                if (id === "node1") return mockCyRefGetElementByIdNode1;
                if (id === "node2") return mockCyRefGetElementByIdNode2;
                if (id === "node3") return mockCyRefGetElementByIdNode3;
                return null;
            }),
            nodes: vi.fn().mockReturnValue([]),
            edges: vi.fn().mockReturnValue([]),
        } as unknown as cytoscape.Core;
        //Here, node 3 is not inside node 1 but node 1 is node 3's parent
        //So, node 3 is expected to be moved, but node 1 and node 2 are not
        const nodes: Node[] = [
            {
                classes: "class1",
                data: {
                    description: "Node 1 description",
                    type: "type1",
                    label: "Node 1",
                    id: "node1",
                    _displayPlaceholderWithDesc: "Display 1 with desc",
                    _displayPlaceholderWithoutDesc: "Display 1 without desc",
                    extraField: "extraValue1",
                },
            },
            {
                classes: "class2",
                data: {
                    description: "Node 2 description",
                    type: "type2",
                    label: "Node 2",
                    id: "node2",
                    _displayPlaceholderWithDesc: "Display 2 with desc",
                    _displayPlaceholderWithoutDesc: "Display 2 without desc",
                    extraField: "extraValue2",
                },
            },
            {
                classes: "class3",
                data: {
                    description: "Node 3 description",
                    type: "type3",
                    label: "Node 3",
                    id: "node3",
                    parent: "node1",
                    _displayPlaceholderWithDesc: "Display 3 with desc",
                    _displayPlaceholderWithoutDesc: "Display 3 without desc",
                    extraField: "extraValue3",
                },
            },
        ];

        instance.calculateAndUpdateNodePositions(mockCyRef, nodes);
        //Once for node 3
        expect(mockCyRefGetElementByIdNode3.position).toHaveBeenCalledWith({
            x: 50, y: 50,
        });
    });

    it('should be able to handle nested parents', () => {
        const instance = getInstance();
        const mockCyRefGetElementByIdNode1 = {
            boundingBox: vi.fn().mockReturnValue({
                x1: 0,
                y1: 0,
                x2: 100,
                y2: 100,
                w: 100,
                h: 100,
            }),
            position: vi.fn(),
        };
        const mockCyRefGetElementByIdNode2 = {
            boundingBox: vi.fn().mockReturnValue({
                x1: 50,
                y1: 50,
                x2: 120,
                y2: 120,
                w: 70,
                h: 70,
            }),
            position: vi.fn(),
        };
        const mockCyRefGetElementByIdNode3 = {
            boundingBox: vi.fn().mockReturnValue({
                x1: -50,
                y1: -50,
                x2: 0,
                y2: 0,
                w: 50,
                h: 50,
            }),
            position: vi.fn(),
        };
        mockCyRef = {
            getElementById: vi.fn().mockImplementation((id) => {
                if (id === "node1") return mockCyRefGetElementByIdNode1;
                if (id === "node2") return mockCyRefGetElementByIdNode2;
                if (id === "node3") return mockCyRefGetElementByIdNode3;
                return null;
            }),
            nodes: vi.fn().mockReturnValue([]),
            edges: vi.fn().mockReturnValue([]),
        } as unknown as cytoscape.Core;
        //Here, node 3 should be inside node 2 and node 2 should be inside node 1
        //So, nodes 2 first, then node 3 are expected to be moved, but node 1 is not
        const nodes: Node[] = [
            {
                classes: "class1",
                data: {
                    description: "Node 1 description",
                    type: "type1",
                    label: "Node 1",
                    id: "node1",
                    _displayPlaceholderWithDesc: "Display 1 with desc",
                    _displayPlaceholderWithoutDesc: "Display 1 without desc",
                    extraField: "extraValue1",
                },
            },
            {
                classes: "class2",
                data: {
                    description: "Node 2 description",
                    type: "type2",
                    label: "Node 2",
                    id: "node2",
                    parent: "node1",
                    _displayPlaceholderWithDesc: "Display 2 with desc",
                    _displayPlaceholderWithoutDesc: "Display 2 without desc",
                    extraField: "extraValue2",
                },
            },
            {
                classes: "class3",
                data: {
                    description: "Node 3 description",
                    type: "type3",
                    label: "Node 3",
                    id: "node3",
                    parent: "node2",
                    _displayPlaceholderWithDesc: "Display 3 with desc",
                    _displayPlaceholderWithoutDesc: "Display 3 without desc",
                    extraField: "extraValue3",
                },
            },
        ];

        instance.calculateAndUpdateNodePositions(mockCyRef, nodes);
        //Once for node 2 (move to centre of node 1)
        expect(mockCyRefGetElementByIdNode2.position).toHaveBeenCalledWith({
            x: 50, y: 50,
        });
        //Once for node 3 (move to centre of node 2, which has just moved)
        expect(mockCyRefGetElementByIdNode3.position).toHaveBeenCalledWith({
            x: 85, y: 85,
        });
    });

    it('should be able to place a node to be moved between two nodes if necessary', () => {
        const instance = getInstance();
        const mockCyRefGetElementByIdNode1 = {
            boundingBox: vi.fn().mockReturnValue({
                x1: 0,
                y1: 0,
                x2: 100,
                y2: 100,
                w: 100,
                h: 100,
            }),
            position: vi.fn(),
        };
        const mockCyRefGetElementByIdNode2 = {
            boundingBox: vi.fn().mockReturnValue({
                x1: -200,
                y1: -200,
                x2: -100,
                y2: -100,
                w: 100,
                h: 100,
            }),
            position: vi.fn(),
        };
        const mockCyRefGetElementByIdNode3 = {
            boundingBox: vi.fn().mockReturnValue({
                x1: 0,
                y1: 0,
                x2: 50,
                y2: 50,
                w: 50,
                h: 50,
            }),
            position: vi.fn(),
        };
        const mockCyRefGetElementByIdNode4 = {
            boundingBox: vi.fn().mockReturnValue({
                x1: 10,
                y1: 10,
                x2: 50,
                y2: 50,
                w: 40,
                h: 40,
            }),
            position: vi.fn(),
        };
        mockCyRef = {
            getElementById: vi.fn().mockImplementation((id) => {
                if (id === "node1") return mockCyRefGetElementByIdNode1;
                if (id === "node2") return mockCyRefGetElementByIdNode2;
                if (id === "node3") return mockCyRefGetElementByIdNode3;
                if (id === "node4") return mockCyRefGetElementByIdNode4;
                return null;
            }),
            nodes: vi.fn().mockReturnValue([]),
            edges: vi.fn().mockReturnValue([]),
        } as unknown as cytoscape.Core;
        //Here, node 3 should not be inside node 1. It will bemoved so as to not overlap with node 2.
        const nodes: Node[] = [
            {
                classes: "class1",
                data: {
                    description: "Node 1 description",
                    type: "type1",
                    label: "Node 1",
                    id: "node1",
                    _displayPlaceholderWithDesc: "Display 1 with desc",
                    _displayPlaceholderWithoutDesc: "Display 1 without desc",
                    extraField: "extraValue1",
                },
            },
            {
                classes: "class2",
                data: {
                    description: "Node 2 description",
                    type: "type2",
                    label: "Node 2",
                    id: "node2",
                    _displayPlaceholderWithDesc: "Display 2 with desc",
                    _displayPlaceholderWithoutDesc: "Display 2 without desc",
                    extraField: "extraValue2",
                },
            },
            {
                classes: "class3",
                data: {
                    description: "Node 3 description",
                    type: "type3",
                    label: "Node 3",
                    id: "node3",
                    _displayPlaceholderWithDesc: "Display 3 with desc",
                    _displayPlaceholderWithoutDesc: "Display 3 without desc",
                    extraField: "extraValue3",
                },
            },
            {
                classes: "class4",
                data: {
                    description: "Node 4 description",
                    type: "type4",
                    label: "Node 4",
                    id: "node4",
                    parent: "node1",
                    _displayPlaceholderWithDesc: "Display 4 with desc",
                    _displayPlaceholderWithoutDesc: "Display 4 without desc",
                    extraField: "extraValue4",
                },
            },
        ];

        instance.calculateAndUpdateNodePositions(mockCyRef, nodes);
        //Once for node 3 (move between node 1 and node 2)
        expect(mockCyRefGetElementByIdNode3.position).toHaveBeenCalledWith({
            x: -50, y: -50,
        });
    });
});