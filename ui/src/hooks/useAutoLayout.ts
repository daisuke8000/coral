import { useCallback } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { applyLayoutPositions } from '@/lib/graphView';

export function useAutoLayout() {
  const getLayoutedNodes = useCallback(async (
    nodes: Node[],
    edges: Edge[],
    direction: 'TB' | 'LR' = 'TB',
    signal?: AbortSignal,
  ): Promise<Node[]> => {
    signal?.throwIfAborted();
    const { default: dagre } = await import('dagre');
    // Import itself cannot be aborted; skip obsolete work once the shared chunk arrives.
    signal?.throwIfAborted();
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: direction, nodesep: 80, ranksep: 100 });
    g.setDefaultEdgeLabel(() => ({}));

    // Cards show a compact summary, not every detail field. Match their CSS bounds.
    nodes.forEach((node) => {
      g.setNode(node.id, node.type === 'package'
        ? { width: 240, height: 64 }
        : { width: 220, height: 132 });
    });
    edges.forEach((edge) => {
      if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
        g.setEdge(edge.source, edge.target);
      }
    });
    dagre.layout(g);

    const positions = new Map(nodes.map((node) => {
      const { x, y, width, height } = g.node(node.id);
      return [node.id, { x: x - width / 2, y: y - height / 2 }] as const;
    }));
    return applyLayoutPositions(nodes, positions);
  }, []);

  return { getLayoutedNodes };
}
