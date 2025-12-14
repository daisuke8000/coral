import { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeMouseHandler,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { ServiceNode, MessageNode, ExternalNode } from '@/components/nodes';
import { DetailPanel } from '@/components/DetailPanel';
import { useSelection } from '@/hooks/useSelection';
import type { GraphData, NodeData, NodeType } from '@/types/graph';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypes: Record<string, any> = {
  service: ServiceNode,
  message: MessageNode,
  external: ExternalNode,
};

interface GraphProps {
  data: GraphData;
}

function calculateLayout(data: GraphData): { nodes: Node[]; edges: Edge[] } {
  const packageMap = new Map<string, typeof data.nodes>();

  data.nodes.forEach((node) => {
    const existing = packageMap.get(node.package) || [];
    existing.push(node);
    packageMap.set(node.package, existing);
  });

  const nodes: Node[] = [];
  let packageX = 0;
  const packageWidth = 300;
  const nodeHeight = 120;
  const packagePadding = 100;

  packageMap.forEach((packageNodes) => {
    packageNodes.forEach((node, nodeIndex) => {
      const nodeData: NodeData = {
        label: node.label,
        file: node.file,
        package: node.package,
        nodeType: node.type as NodeType,
        details: node.details,
      };
      nodes.push({
        id: node.id,
        type: node.type,
        position: {
          x: packageX + 50,
          y: nodeIndex * nodeHeight + 50,
        },
        data: nodeData,
      });
    });
    packageX += packageWidth + packagePadding;
  });

  const edges: Edge[] = data.edges.map((edge, index) => ({
    id: `edge-${index}`,
    source: edge.source,
    target: edge.target,
    animated: true,
    style: { stroke: 'rgba(255, 255, 255, 0.4)', strokeWidth: 2 },
  }));

  return { nodes, edges };
}

export function Graph({ data }: GraphProps) {
  const {
    selectedNodeId,
    selectedNode,
    setSelectedNodeId,
    isNodeHighlighted,
    isEdgeHighlighted,
    clearSelection,
  } = useSelection(data);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => calculateLayout(data),
    [data]
  );

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const styledNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        className: isNodeHighlighted(node.id) ? '' : 'dimmed',
        selected: node.id === selectedNodeId,
      })),
    [nodes, selectedNodeId, isNodeHighlighted]
  );

  const styledEdges = useMemo(
    () =>
      edges.map((edge) => {
        const highlighted = isEdgeHighlighted(edge.source, edge.target);
        return {
          ...edge,
          style: highlighted
            ? { stroke: 'var(--neon-cyan)', strokeWidth: 3 }
            : { stroke: 'rgba(255, 255, 255, 0.1)', strokeWidth: 1 },
          animated: highlighted,
        };
      }),
    [edges, isEdgeHighlighted]
  );

  const onConnect = useCallback(() => {}, []);

  const onNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      setSelectedNodeId(node.id);
    },
    [setSelectedNodeId]
  );

  const onPaneClick = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  return (
    <div className="graph-container">
      <ReactFlow
        nodes={styledNodes}
        edges={styledEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
        className="neon-flow"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="rgba(255, 255, 255, 0.1)"
        />
        <Controls className="neon-controls" />
        <MiniMap
          className="neon-minimap"
          nodeColor={(node) => {
            switch (node.type) {
              case 'service':
                return '#ff00ff';
              case 'message':
                return '#00ffff';
              case 'external':
                return '#666666';
              default:
                return '#ffffff';
            }
          }}
          maskColor="rgba(10, 10, 15, 0.8)"
        />
      </ReactFlow>
      <DetailPanel node={selectedNode} onClose={clearSelection} />
    </div>
  );
}
