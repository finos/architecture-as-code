import { useMemo } from 'react';
import { parse } from 'json-source-map';
import { extractId } from '@/utils/calmHelpers';

export interface SourcePosition {
  line: number;
  column: number;
  pos: number;
}

export interface SourceLocation {
  value?: SourcePosition;
  valueEnd?: SourcePosition;
  // Legacy format support
  start?: SourcePosition;
  end?: SourcePosition;
}

export interface PositionMap {
  nodes: Map<string, SourceLocation>;
  relationships: Map<string, SourceLocation>;
  controls: Map<string, SourceLocation>; // Key format: "nodeId/controlId" or "relationshipId/controlId"
  interfaces: Map<string, SourceLocation>; // Key format: "nodeId/interfaceId"
}

/**
 * Hook to build a map of node/relationship IDs to their positions in the JSON source
 */
export const useJsonPositionMap = (jsonString: string): PositionMap => {
  return useMemo(() => {
    const map: PositionMap = {
      nodes: new Map(),
      relationships: new Map(),
      controls: new Map(),
      interfaces: new Map(),
    };

    try {
      const result = parse(jsonString);
      const { data, pointers } = result;

      // Map nodes by their unique-id
      if (data.nodes && Array.isArray(data.nodes)) {
        data.nodes.forEach((node: any, index: number) => {
          const nodeId = extractId(node);
          if (nodeId) {
            const pointer = `/nodes/${index}`;
            const location = pointers[pointer];

            if (location) {
              map.nodes.set(nodeId, location);
            }

            // Map controls within this node
            if (node.controls && typeof node.controls === 'object') {
              Object.keys(node.controls).forEach((controlId) => {
                const controlPointer = `/nodes/${index}/controls/${controlId}`;
                const controlLocation = pointers[controlPointer];

                if (controlLocation) {
                  const key = `${nodeId}/${controlId}`;
                  map.controls.set(key, controlLocation);
                }
              });
            }

            // Map interfaces within this node
            if (node.interfaces && Array.isArray(node.interfaces)) {
              node.interfaces.forEach((iface: any, ifaceIndex: number) => {
                const interfaceId = extractId(iface);
                if (interfaceId) {
                  const interfacePointer = `/nodes/${index}/interfaces/${ifaceIndex}`;
                  const interfaceLocation = pointers[interfacePointer];

                  if (interfaceLocation) {
                    const key = `${nodeId}/${interfaceId}`;
                    map.interfaces.set(key, interfaceLocation);
                  }
                }
              });
            }
          }
        });
      }

      // Map relationships by their unique-id
      if (data.relationships && Array.isArray(data.relationships)) {
        data.relationships.forEach((rel: any, index: number) => {
          const relId = extractId(rel);
          if (relId) {
            const pointer = `/relationships/${index}`;
            const location = pointers[pointer];

            if (location) {
              map.relationships.set(relId, location);
            }

            // Map controls within this relationship
            if (rel.controls && typeof rel.controls === 'object') {
              Object.keys(rel.controls).forEach((controlId) => {
                const controlPointer = `/relationships/${index}/controls/${controlId}`;
                const controlLocation = pointers[controlPointer];

                if (controlLocation) {
                  const key = `${relId}/${controlId}`;
                  map.controls.set(key, controlLocation);
                }
              });
            }
          }
        });
      }
    } catch (error) {
      console.error('Error building position map:', error);
    }

    return map;
  }, [jsonString]);
};
