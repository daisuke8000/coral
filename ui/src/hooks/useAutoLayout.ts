import dagre from 'dagre';
import type { Node, Edge } from '@xyflow/react';

const NODE_WIDTH = 200;
const NODE_HEIGHT = 140;

export function useAutoLayout() {
  const getLayoutedNodes = (
    nodes: Node[],
    edges: Edge[],
    direction: 'TB' | 'LR' = 'TB'
  ): Node[] => {
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: direction, nodesep: 80, ranksep: 100 });
    g.setDefaultEdgeLabel(() => ({}));

    nodes.forEach((node) => {
      g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
    });

    edges.forEach((edge) => {
      g.setEdge(edge.source, edge.target);
    });

    dagre.layout(g);

    return nodes.map((node) => {
      const pos = g.node(node.id);
      return {
        ...node,
        parentId: undefined,
        position: {
          x: pos.x - NODE_WIDTH / 2,
          y: pos.y - NODE_HEIGHT / 2,
        },
      };
    });
  };

  return { getLayoutedNodes };
}
