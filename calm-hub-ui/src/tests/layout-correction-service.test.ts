import { describe, it, vi, beforeEach, expect } from "vitest";
import cytoscape from "cytoscape";
import { LayoutCorrectionService } from "../visualizer/services/layout-correction-service.js";
import { BoundingBox, Node } from '../visualizer/contracts/contracts.js';
import { afterEach } from "node:test";

function generateMockNodeObj(id: string, parentId?: string): Node {
    const nodeObj = {
        classes: `class-${id}`,
        data: {
            description: `Node ${id} description`,
            type: `type-${id}`,
            label: `Node ${id}`,
            id: id,
            parent: parentId,
            _displayPlaceholderWithDesc: `Display ${id} with desc`,
            _displayPlaceholderWithoutDesc: `Display ${id} without desc`,
            extraField: `extraValue-${id}`,
        },
    };
    if (parentId != null) {
        nodeObj.data.parent = parentId;
    }
    return nodeObj as Node;
}

function generateBoundingBox(x1: number, y1: number, w: number, h: number): BoundingBox {
    return {
        x1: x1,
        x2: x1 + w,
        y1: y1,
        y2: y1 + h,
        w: w,
        h: h
    };
}

function generateMockCyRefGetElementById(x1: number, y1: number, w: number, h: number): cytoscape.NodeSingular {
    return {
        boundingBox: vi.fn().mockReturnValue(generateBoundingBox(x1, y1, w, h)),
        position: vi.fn(),
    } as unknown as cytoscape.NodeSingular;
}

describe(LayoutCorrectionService.name, () => {

    let mockCyRef: cytoscape.Core;
    let mockCyRefGetElementById: cytoscape.NodeSingular;

    beforeEach(() => {
        mockCyRefGetElementById = generateMockCyRefGetElementById(0, 0, 100, 100);
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
            generateMockNodeObj('node1'),
            generateMockNodeObj('node2'),
            generateMockNodeObj('node3', 'node1'),
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
            generateMockNodeObj('node1'),
            generateMockNodeObj('node2'),
            generateMockNodeObj('node3', 'node1'),
        ];

        instance.calculateAndUpdateNodePositions(mockCyRef, nodes);
        //Once for node 2
        expect(mockCyRefGetElementById.position).toHaveBeenCalledWith({
            x: -100, y: -100,
        });
    });

    it('should update position for nodes that are not inside their parents', () => {
        const instance = getInstance();
        //Here, node 3 is not inside node 1 but node 1 is node 3's parent
        //So, node 3 is expected to be moved, but node 1 and node 2 are not
        const mockCyRefGetElementByIdNode1 = generateMockCyRefGetElementById(0, 0, 100, 100);
        const mockCyRefGetElementByIdNode2 = generateMockCyRefGetElementById(150, 150, 100, 100);
        const mockCyRefGetElementByIdNode3 = generateMockCyRefGetElementById(-150, -150, 100, 100);
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
        
        const nodes: Node[] = [
            generateMockNodeObj('node1'),
            generateMockNodeObj('node2'),
            generateMockNodeObj('node3', 'node1')
        ];

        instance.calculateAndUpdateNodePositions(mockCyRef, nodes);
        //Once for node 3
        expect(mockCyRefGetElementByIdNode3.position).toHaveBeenCalledWith({
            x: 50, y: 50,
        });
    });

    it('should be able to handle nested parents', () => {
        const instance = getInstance();
        //Here, node 3 should be inside node 2 and node 2 should be inside node 1
        //So, nodes 2 first, then node 3 are expected to be moved, but node 1 is not
        const mockCyRefGetElementByIdNode1 = generateMockCyRefGetElementById(0, 0, 100, 100);
        const mockCyRefGetElementByIdNode2 = generateMockCyRefGetElementById(50, 50, 70, 70);
        const mockCyRefGetElementByIdNode3 = generateMockCyRefGetElementById(-50, -50, 50, 50);
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
        
        const nodes: Node[] = [
            generateMockNodeObj('node1'),
            generateMockNodeObj('node2', 'node1'),
            generateMockNodeObj('node3', 'node2'),
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
        //Here, node 3 should not be inside node 1. It will bemoved so as to not overlap with node 2.
        const mockCyRefGetElementByIdNode1 = generateMockCyRefGetElementById(0, 0, 100, 100);
        const mockCyRefGetElementByIdNode2 = generateMockCyRefGetElementById(-200, -200, 100, 100);
        const mockCyRefGetElementByIdNode3 = generateMockCyRefGetElementById(0, 0, 50, 50);
        const mockCyRefGetElementByIdNode4 = generateMockCyRefGetElementById(10, 10, 40, 40);
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
        
        const nodes: Node[] = [
            generateMockNodeObj('node1'),
            generateMockNodeObj('node2'),
            generateMockNodeObj('node3'),
            generateMockNodeObj('node4', 'node1'),
        ];

        instance.calculateAndUpdateNodePositions(mockCyRef, nodes);
        //Once for node 3 (move between node 1 and node 2)
        expect(mockCyRefGetElementByIdNode3.position).toHaveBeenCalledWith({
            x: -50, y: -50,
        });
    });
});