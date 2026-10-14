import { useState, useCallback, useMemo } from 'react';
import type { GraphData, GraphNode } from '@/types/graph';

export function useSelection(data: GraphData | null) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const index = useMemo(() => {
    const nodes = new Map(data?.nodes.map((node) => [node.id, node]));
    const neighbors = new Map<string, Set<string>>();
    for (const edge of data?.edges ?? []) {
      for (const [source, target] of [[edge.source, edge.target], [edge.target, edge.source]]) {
        const ids = neighbors.get(source) ?? new Set<string>();
        ids.add(target);
        neighbors.set(source, ids);
      }
    }
    return { nodes, neighbors };
  }, [data]);

  const selectedNode: GraphNode | null = selectedNodeId ? index.nodes.get(selectedNodeId) ?? null : null;
  const connectedNodeIds = selectedNodeId ? index.neighbors.get(selectedNodeId) : undefined;

  const isNodeHighlighted = useCallback(
    (nodeId: string): boolean => {
      if (!selectedNodeId) return true;
      return nodeId === selectedNodeId || (connectedNodeIds?.has(nodeId) ?? false);
    },
    [selectedNodeId, connectedNodeIds]
  );

  const isEdgeHighlighted = useCallback(
    (source: string, target: string): boolean => {
      if (!selectedNodeId) return true;
      return source === selectedNodeId || target === selectedNodeId;
    },
    [selectedNodeId]
  );

  const clearSelection = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  return {
    selectedNodeId,
    selectedNode,
    setSelectedNodeId,
    isNodeHighlighted,
    isEdgeHighlighted,
    clearSelection,
  };
}
