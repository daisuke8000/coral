import { useState, useCallback, useMemo } from 'react';
import type { GraphData, GraphNode } from '@/types/graph';
import { buildSelectionIndex } from '@/lib/graphSelection';

export function useSelection(data: GraphData | null, selectableNodeIds?: Set<string>) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const index = useMemo(() => buildSelectionIndex(data), [data]);

  // A hidden, collapsed, or removed definition must not leave an invisible selection.
  if (selectedNodeId !== null && (!index.nodes.has(selectedNodeId) ||
    (selectableNodeIds && !selectableNodeIds.has(selectedNodeId)))) {
    setSelectedNodeId(null);
  }

  const selectedNode: GraphNode | null = selectedNodeId !== null ? index.nodes.get(selectedNodeId) ?? null : null;
  const highlightedNodeIds = useMemo(() => selectedNodeId === null ? null : new Set([
    selectedNodeId,
    ...(index.neighbors.get(selectedNodeId) ?? []),
  ]), [selectedNodeId, index]);

  const isNodeHighlighted = useCallback(
    (nodeId: string): boolean => highlightedNodeIds === null || highlightedNodeIds.has(nodeId),
    [highlightedNodeIds]
  );

  const clearSelection = useCallback(() => setSelectedNodeId(null), []);

  return { selectedNodeId, selectedNode, setSelectedNodeId, highlightedNodeIds, isNodeHighlighted, clearSelection };
}
