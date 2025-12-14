import { useState, useCallback, useMemo } from 'react';
import type { GraphData, GraphNode } from '@/types/graph';

export function useSelection(data: GraphData | null) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const selectedNode = useMemo((): GraphNode | null => {
    if (!selectedNodeId || !data) return null;
    return data.nodes.find((n) => n.id === selectedNodeId) ?? null;
  }, [selectedNodeId, data]);

  const connectedNodeIds = useMemo((): Set<string> => {
    if (!selectedNodeId || !data) return new Set<string>();
    const ids = new Set<string>();
    data.edges.forEach((e) => {
      if (e.source === selectedNodeId) ids.add(e.target);
      if (e.target === selectedNodeId) ids.add(e.source);
    });
    return ids;
  }, [selectedNodeId, data]);

  const isNodeHighlighted = useCallback(
    (nodeId: string): boolean => {
      if (!selectedNodeId) return true;
      return nodeId === selectedNodeId || connectedNodeIds.has(nodeId);
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
