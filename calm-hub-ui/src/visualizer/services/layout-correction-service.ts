import cytoscape from "cytoscape";
import { BoundingBox, IdAndBoundingBox, CalmNode, NodeLayoutViolations } from '../contracts/contracts.js';
import { difference, intersection, union } from "../helpers/set-functions.js";

export class LayoutCorrectionService {
    
    //PUBLIC METHODS-------------------------

    /**
     * Goes over all the nodes in the graph to identify nodes violating rules of the layout i.e., any node must render
     * inside its ancestors and not inside non-ancestors. It calculates a non-violating positions for these nodes and updates
     * them in such a way that the entire graph respects the layout rules.
     * @param cyRef Reference to cytoscape graph.
     * @param nodes Nodes to seatch over.
     */
    public calculateAndUpdateNodePositions(cyRef: cytoscape.Core, nodes: CalmNode[]): void {
        this.identifyNodesToBeMoved(cyRef, nodes);
        //Make sure all parentless containers are correctly placed first, followed by child containers of these parents
        const containers = new Set<string>([...this._nodeEnclosureMap.keys()]);
        const containersWithoutParents = intersection(this._parentlessNodes, containers);
        const containersWithParents = difference(containers, containersWithoutParents);
        containersWithoutParents.forEach((nodeId: string) => {
            this.correctNodePosition(cyRef, nodeId);
        });
        containersWithParents.forEach((nodeId: string) => {
            this.correctNodePosition(cyRef, nodeId);
        });
        //Then correct the remaining nodes
        difference(this._allNodes, containers).forEach((nodeId: string) => {
            this.correctNodePosition(cyRef, nodeId);
        });
    }

    //PRIVATE MEMBERS---------------------------
    
    //Maps Node IDs to their bounding boxes, as well as those of parents for which they violate layout rules.
    private _layoutViolations = new Map<string, NodeLayoutViolations>();

    //Maps node IDs to IDs of nodes that should render within them
    private _nodeEnclosureMap = new Map<string, Set<string>>();

    //Nodes without any parents
    private _parentlessNodes = new Set<string>();

    //Set of all nodes in the graph
    private _allNodes = new Set<string>();


    //PRIVATE METHODS----------------------------

    /**
     * Identifies nodes that are not rendered within their parents (or grandparents and higher ancestors), as well
     * as nodes rendered within non-ancestors.
     * @param cyRef Reference to cytoscape graph.
     * @param nodes Nodes to search over.
     * @returns An object describing nodes not contained within their ancestors, as well as nodes within non-ancestors, along with bounding boxes
     */
    private identifyNodesToBeMoved(cyRef: cytoscape.Core, nodes: CalmNode[]): Map<string, NodeLayoutViolations> {
        this._layoutViolations.clear();
        this._nodeEnclosureMap.clear();
        this._allNodes.clear();
        this._parentlessNodes.clear();
        
        //Iterate through nodes and populate node enclosure map
        nodes.forEach((node: CalmNode) => {
            const nodeParentId = node.data.parent;
            if(nodeParentId != null) {
                if (this._nodeEnclosureMap.get(nodeParentId) != null) {
                    this._nodeEnclosureMap.get(nodeParentId)?.add(node.data.id);
                } else {
                    this._nodeEnclosureMap.set(nodeParentId, new Set<string>([node.data.id]));
                }
                //We can also identify nodes that are not within their parent if the parent is defined
                const parentBoundingBox = this.getNodeBoundingBox(cyRef, nodeParentId);
                const nodeBoundingBox = this.getNodeBoundingBox(cyRef, node.data.id);
                if(!this.boxContainedIn(nodeBoundingBox, parentBoundingBox)) {
                    this.addLayoutViolation(node.data.id, nodeBoundingBox, nodeParentId, parentBoundingBox, true);
                }
            } else {
                this._parentlessNodes.add(node.data.id);
            }
        })

        this._allNodes = new Set<string>(nodes.map((node: CalmNode) => node.data.id));

        const visited = new Set<string>();
        this._nodeEnclosureMap.forEach((_: Set<string>, nodeId: string) => {
            this.updateEnclosedNodesMap(nodeId, this._nodeEnclosureMap, visited);
        })

        //Iterate over keys in map to check if any non-enclosed nodes are intersecting
        this._nodeEnclosureMap.forEach((enclosed: Set<string>, parentId: string, nodeEnclosureMap: Map<string, Set<string>>) => {
            const nonEnclosedNodes = difference(this._allNodes, enclosed.add(parentId));
            nonEnclosedNodes.forEach((nonEnclosedNodeId: string) => {
                //If the current parent is supposed to be enclosed by the non enclosed node id
                if(!(nodeEnclosureMap.get(nonEnclosedNodeId)?.has(parentId) ?? false)) {
                    const nonParentBoundingBox = this.getNodeBoundingBox(cyRef, parentId);
                    const nonEnclosedNodeBoundingBox = this.getNodeBoundingBox(cyRef, nonEnclosedNodeId);
                    if (this.boxesIntersect(nonParentBoundingBox, nonEnclosedNodeBoundingBox)) {
                        this.addLayoutViolation(nonEnclosedNodeId, nonEnclosedNodeBoundingBox, parentId, nonParentBoundingBox, false);
                    }
                }   
            })
        })
        return this._layoutViolations;
    }

    /**
     * Updates a node to its calculated position based on layout violations. Does nothing if the node does not violate the layout.
     * @param cyRef Reference to cytoscape graph
     * @param nodeId Id of the node to be corrected
     */
    private correctNodePosition(cyRef: cytoscape.Core, nodeId: string): void {
        const layoutViolationsForNode = this._layoutViolations.get(nodeId);
        if (layoutViolationsForNode != null) {
            const correctedPosition = this.getCorrectedPosition(cyRef, nodeId, layoutViolationsForNode);
            cyRef.getElementById(nodeId).position(correctedPosition);
        }
    }

    /**
     * Recursive function that updates the node enclosure map based on parent-child relationships. Used to build up the
     * node enclosure map and to ensure that all nodes are accounted for.
     * @param currentValue 
     * @param enclosureMap 
     * @param visited 
     */
    private updateEnclosedNodesMap(currentValue: string, enclosureMap: Map<string, Set<string>>, visited: Set<string>): void {
        //If we have already visited child from another node, no need to go again
        if(!visited.has(currentValue)) {
            visited.add(currentValue);
            const children = enclosureMap.get(currentValue);
            //Recursion only if children defined
            if (children != null) {
                //The initial set of values we set is the children
                let fullSet = new Set<string>(children);
                //We go through children and update them
                children.forEach((childId: string) => {
                    this.updateEnclosedNodesMap(childId, enclosureMap, visited);
                    fullSet = union(fullSet, enclosureMap.get(childId) ?? new Set<string>());
                });
                //Update enclosure map based on updated children
                enclosureMap.set(currentValue, fullSet);
            }
        }
    }

    /**
     * Checks if box1 is enclosed within box 2
     * @param box1 Bounding box 1 which is checked to see if it enclosed in box 2
     * @param box2 Bounding box 2 which is checked to see if it encloses box 1
     * @returns a boolean: `true` if box 1 is within box 2, else `false`
     */
    private boxContainedIn(box1: BoundingBox, box2: BoundingBox): boolean {
        const boxHorizontallyInside = (box1.x1 > box2.x1) && (box1.x2 < box2.x2);
        const boxVerticallyInside = (box1.y1 > box2.y1) && (box1.y2 < box2.y2);
        return boxHorizontallyInside && boxVerticallyInside;
    }

    /**
     * Checks if two bounding boxes intersect
     * @param box1 Bounding box 1
     * @param box2 Bounding box 2
     * @returns a boolean: `true` if boxes intersect, else `false`
     */
    private boxesIntersect(box1: BoundingBox, box2: BoundingBox): boolean {
        const boxHorizontallyOutside = (box1.x1 > box2.x2) || (box2.x1 > box1.x2);
        const boxVerticallyOutside = (box1.y1 > box2.y2) || (box2.y1 > box1.y2);
        return !(boxHorizontallyOutside || boxVerticallyOutside);
    }

    /**
     * Adds a layout violation to the map from node ids to their respective violations
     * @param nodeId Id of the violating node
     * @param nodeBoundingBox Bounding box of the violating node
     * @param parentId Id of the node being violated
     * @param parentBoundingBox Bounding box of the node being violated
     * @param shouldBeInside Boolean describing the type of violation
     */
    private addLayoutViolation(nodeId: string, nodeBoundingBox: BoundingBox, parentId: string, parentBoundingBox: BoundingBox, shouldBeInside: boolean): void {
        const constraint: IdAndBoundingBox = {
            nodeId: parentId,
            boundingBox: parentBoundingBox
        };

        let nodeViolationEntry = this._layoutViolations.get(nodeId);

        if (nodeViolationEntry == null) {
            nodeViolationEntry = {
                nodeBoundingBox: nodeBoundingBox,
                shouldBeInside: [],
                shouldBeOutside: []
            };
        } 

        if (shouldBeInside) {
            nodeViolationEntry.shouldBeInside.push(constraint);
        } else {
            nodeViolationEntry.shouldBeOutside.push(constraint);
        }

        this._layoutViolations.set(nodeId, nodeViolationEntry);
    }

    /**
     * Based on node violations, suggests a corrected position for a violating node. It finds allowed
     * positions for the node and suggests one of these allowed positions
     * @param violations An object containing the bounding box of the node and related nodes for which its rendered position
     * violates the layout rules - these may be ancestors the node is not rendering in or non-ancestors the node is rendering in.
     * @returns The suggested position as an object.
     */
    private getCorrectedPosition(cyref: cytoscape.Core, nodeId: string, violations: NodeLayoutViolations): cytoscape.Position {
        const xRanges: [number, number][] = [[-Infinity, Infinity]];
        const yRanges: [number, number][] = [[-Infinity, Infinity]];
        //Update ranges based on containers the node needs to be in
        //We will not get an invalid range because we make sure that all containers are in order first
        violations.shouldBeInside.forEach((container: IdAndBoundingBox) => {
            xRanges[0][0] = Math.max(xRanges[0][0], container.boundingBox.x1);
            yRanges[0][0] = Math.max(yRanges[0][0], container.boundingBox.y1);
            xRanges[0][1] = Math.min(xRanges[0][1], container.boundingBox.x2);
            yRanges[0][1] = Math.min(yRanges[0][1], container.boundingBox.y2);
        });
        //Update ranges so that the new node position cannot intersect with other non-ancestor nodes
        difference(this._allNodes, this.getLineage(nodeId)).forEach((nonCollisionNodeId: string) => {
            const boundingBox = this.getNodeBoundingBox(cyref, nonCollisionNodeId);
            this.updateRanges(xRanges, [boundingBox.x1, boundingBox.x2]);
            this.updateRanges(yRanges, [boundingBox.y1, boundingBox.y2]);
        });
        //Find nearest range to current position of node
        const xRange = this.findClosestRange(xRanges, [violations.nodeBoundingBox.x1, violations.nodeBoundingBox.x2]);
        const yRange = this.findClosestRange(yRanges, [violations.nodeBoundingBox.y1, violations.nodeBoundingBox.y2]);
        return {
            x: this.findPositionFromRange(xRange, violations.nodeBoundingBox.w),
            y: this.findPositionFromRange(yRange, violations.nodeBoundingBox.h)
        };
    }

    /**
     * Returns the rendered bounding box of node by Id.
     * @param cyRef Reference to cytoscape graph
     * @param nodeId Id of node to look up
     * @returns Object indicating rendered bounding box of node
     */
    private getNodeBoundingBox(cyRef: cytoscape.Core, nodeId: string): BoundingBox {
        return cyRef.getElementById(nodeId).boundingBox();
    }

    /**
     * Returns the lineage of a node, i.e. all nodes that are ancestors of the node in the graph.
     * @param nodeId Id of the node to get the lineage for
     * @returns A set of node ids that are ancestors of the node
     */
    private getLineage(nodeId: string): Set<string> {
        const lineage: Set<string> = new Set<string>([nodeId]);
        this._nodeEnclosureMap.forEach((enclosed: Set<string>, parentId: string) => {
            if (enclosed.has(nodeId)) {
                lineage.add(parentId);
            }
        });
        return lineage;
    }

    /**
     * Uses `this.binarySearchOverRanges` to identify how to update the list of ranges based on the knowledge that newRange must be excluded.
     * @param ranges List of ranges expressed as [number, number][]
     * @param newRange The new range within which values are not permitted
     */
    private updateRanges(ranges: [number, number][], newRange: [number, number]): void {
        const leftResult = this.binarySearchOverRanges(ranges, newRange[0]);
        const rightResult = this.binarySearchOverRanges(ranges, newRange[1]);
        
        if (leftResult.intersects && rightResult.intersects) {
            //If the new range falls within another range, we have to split the range
            if (leftResult.index == rightResult.index) {
                const oldRangeRight = ranges[leftResult.index][1];
                ranges[leftResult.index][1] = newRange[0];
                ranges.splice(leftResult.index + 1, 0, [newRange[1], oldRangeRight]);
            }
            //If the ranges are different, delete all ranges in between 
            else {
                ranges[leftResult.index][1] = newRange[0];
                ranges[rightResult.index][0] = newRange[1];
                ranges.splice(leftResult.index + 1, rightResult.index - leftResult.index - 1);
            }
        }
        //If only one or neither range intersects, delete ranges falling between if any
        else if (leftResult.intersects) {
            ranges[leftResult.index][1] = newRange[0];
            ranges.splice(leftResult.index + 1, rightResult.index - leftResult.index - 1);
        }
        else if(rightResult.intersects) {
            ranges[rightResult.index][0] = newRange[1];
            ranges.splice(leftResult.index, rightResult.index - leftResult.index);
        }
        else {
            ranges.splice(leftResult.index, rightResult.index - leftResult.index);
        }
    }

    /**
     * Searches over a list of ranges to find one which contains the search value. If no range found, it returns the range index which the search value precedes.
     * @param ranges List of ranges expressed as [number, number][]
     * @param searchValue Value to search in ranges
     * @returns object containing a numerical index and a boolean indicating whether the value intersects the range
     */
    private binarySearchOverRanges(ranges: [number, number][], searchValue: number): { index: number, intersects: boolean } {
        let left = 0;
        let right = ranges.length - 1;
        let precedes = ranges.length;

        while (left <= right) {
            const mid = Math.floor((left + right)/2);
            const midIndexedRange = ranges[mid];
            if ((midIndexedRange[0] <= searchValue) && (midIndexedRange[1] >= searchValue)) {
                return { index: mid, intersects: true };
            }
            else if (searchValue > midIndexedRange[1]) {
                left = mid + 1;
            } else {
                right = mid - 1;
                precedes = mid;
            }
        }
        return { index: precedes, intersects: false };  
    }

    /**
     * Given a list of ranges, find the one that is closest to a provided range and which the provided range fits within.
     * @param ranges List of ranges expressed as [number, number][]
     * @param searchRange The provided range
     * @returns The closest range.
     */
    private findClosestRange(ranges: [number, number][], searchRange: [number, number]): [number, number] {
        const rangeSpan = searchRange[1] - searchRange[0];

        let closestRange = ranges[0];
        let closestDistance = Math.min(Math.abs(searchRange[0] - ranges[0][0]), Math.abs(searchRange[1] - ranges[0][1]))
        ranges.forEach((currentRange: [number, number]) => {
            const currentDistance = Math.min(Math.abs(searchRange[0] - currentRange[0]), Math.abs(searchRange[1] - currentRange[1]));
            const currentSpan = currentRange[1] - currentRange[0];
            if ((currentDistance < closestDistance) && (rangeSpan < currentSpan)) {
                closestRange = currentRange;
                closestDistance = currentDistance;
            }
        });
        return closestRange;
    }

    /**
     * Given a range that can be taken by a value, selects a value within that range based on rules
     * @param range The range
     * @returns A value within the range
     */
    private findPositionFromRange(range: [number, number], padding: number): number {
        if (!Number.isFinite(range[0]) && !Number.isFinite(range[1])) {
            return 0;
        }
        else if (!Number.isFinite(range[0])) {
            return range[1] - padding;
        }
        else if (!Number.isFinite(range[1])) {
            return range[0] + padding;
        } 
        else {
            return (range[0] + range[1])/2;
        }
    }
}