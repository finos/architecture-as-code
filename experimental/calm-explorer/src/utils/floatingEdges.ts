import { Position, Node } from 'reactflow';

// Helper function to calculate the intersection point of a line from the center of one node to another
// with the node's bounding box
function getNodeIntersection(intersectionNode: Node, targetNode: Node) {
  const {
    width: intersectionNodeWidth,
    height: intersectionNodeHeight,
    positionAbsolute: intersectionNodePosition,
  } = intersectionNode;
  const targetPosition = targetNode.positionAbsolute;

  if (!intersectionNodePosition || !targetPosition || !intersectionNodeWidth || !intersectionNodeHeight) {
    return null;
  }

  const w = intersectionNodeWidth / 2;
  const h = intersectionNodeHeight / 2;

  const x2 = intersectionNodePosition.x + w;
  const y2 = intersectionNodePosition.y + h;
  const x1 = targetPosition.x + (targetNode.width || 0) / 2;
  const y1 = targetPosition.y + (targetNode.height || 0) / 2;

  const xx1 = (x1 - x2) / (2 * w) - (y1 - y2) / (2 * h);
  const yy1 = (x1 - x2) / (2 * w) + (y1 - y2) / (2 * h);
  const a = 1 / (Math.abs(xx1) + Math.abs(yy1));
  const xx3 = a * xx1;
  const yy3 = a * yy1;
  const x = w * (xx3 + yy3) + x2;
  const y = h * (-xx3 + yy3) + y2;

  return { x, y };
}

// Get the position (top, right, bottom, left) of the intersection point on the node
function getEdgePosition(node: Node, intersectionPoint: { x: number; y: number } | null) {
  if (!intersectionPoint || !node.positionAbsolute) return Position.Top;

  const nx = node.positionAbsolute.x;
  const ny = node.positionAbsolute.y;
  const px = intersectionPoint.x;
  const py = intersectionPoint.y;
  const nw = node.width || 0;
  const nh = node.height || 0;

  // Calculate which side of the node the point is closest to
  const distances = {
    [Position.Top]: Math.abs(py - ny),
    [Position.Right]: Math.abs(px - (nx + nw)),
    [Position.Bottom]: Math.abs(py - (ny + nh)),
    [Position.Left]: Math.abs(px - nx),
  };

  return Object.keys(distances).reduce((minPos, pos) => {
    const currentPos = pos as unknown as Position;
    const minPosition = minPos as Position;
    return distances[currentPos] < distances[minPosition] ? currentPos : minPos;
  }, Position.Top) as Position;
}

// Main function to calculate edge parameters for floating edges
export function getEdgeParams(source: Node, target: Node) {
  const sourceIntersectionPoint = getNodeIntersection(source, target);
  const targetIntersectionPoint = getNodeIntersection(target, source);

  const sourcePos = getEdgePosition(source, sourceIntersectionPoint);
  const targetPos = getEdgePosition(target, targetIntersectionPoint);

  return {
    sx: sourceIntersectionPoint?.x || source.positionAbsolute?.x || 0,
    sy: sourceIntersectionPoint?.y || source.positionAbsolute?.y || 0,
    tx: targetIntersectionPoint?.x || target.positionAbsolute?.x || 0,
    ty: targetIntersectionPoint?.y || target.positionAbsolute?.y || 0,
    sourcePos,
    targetPos,
  };
}
