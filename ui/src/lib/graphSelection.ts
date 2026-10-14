import type { GraphViewEdge } from './graphView.ts';
import type { GraphData } from '../types/graph.ts';

export function buildSelectionIndex(data: GraphData | null) {
  const nodes = new Map(data?.nodes.map((node) => [node.id, node]));
  const neighbors = new Map<string, Set<string>>();
  for (const edge of data?.edges ?? []) {
    if (!nodes.has(edge.source) || !nodes.has(edge.target)) continue;
    for (const [source, target] of [[edge.source, edge.target], [edge.target, edge.source]]) {
      const ids = neighbors.get(source) ?? new Set<string>();
      ids.add(target);
      neighbors.set(source, ids);
    }
  }
  return { nodes, neighbors };
}

/** Membership links stay quiet; only actual dependencies carry animated flow. */
export function styleGraphEdge(
  edge: GraphViewEdge,
  selectedNodeId: string | null,
  highlightedNodeIds: Set<string> | null,
  motionEnabled: boolean
): GraphViewEdge {
  const membership = edge.data?.kind === 'membership';
  const definitionIds = edge.data?.definitionIds;
  const highlighted = selectedNodeId === null || (membership
    ? [...(definitionIds ?? [])].some((id) => highlightedNodeIds?.has(id))
    : definitionIds?.has(selectedNodeId) ?? (edge.source === selectedNodeId || edge.target === selectedNodeId));

  return {
    ...edge,
    animated: motionEnabled && highlighted && !membership,
    style: {
      ...edge.style,
      stroke: membership ? 'var(--color-neon-purple)' : 'var(--color-neon-cyan)',
      strokeOpacity: highlighted ? (membership ? 0.4 : selectedNodeId === null ? 0.55 : 1) : 0.1,
      strokeWidth: membership ? 1 : highlighted && selectedNodeId !== null ? 3 : highlighted ? 2 : 1,
    },
  };
}
