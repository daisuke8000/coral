import { useMemo, useCallback, useState, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeMouseHandler,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import {
  ServiceNode,
  MessageNode,
  ExternalNode,
  EnumNode,
  PackageGroupNode,
  type PackageNodeData,
} from '@/components/nodes';
import { DetailPanel } from '@/components/DetailPanel';
import { useSelection } from '@/hooks/useSelection';
import { useAutoLayout } from '@/hooks/useAutoLayout';
import { usePackageGroups } from '@/hooks/usePackageGroups';
import type { GraphData, NodeData, NodeType } from '@/types/graph';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypes: Record<string, any> = {
  service: ServiceNode,
  message: MessageNode,
  enum: EnumNode,
  external: ExternalNode,
  package: PackageGroupNode,
};

interface GraphProps {
  data: GraphData;
}

interface CalculateLayoutOptions {
  expandedPackages: Set<string>;
  togglePackage: (packageId: string) => void;
}

function calculateLayout(
  data: GraphData,
  options: CalculateLayoutOptions
): { nodes: Node[]; edges: Edge[] } {
  const { expandedPackages, togglePackage } = options;
  const packageMap = new Map<string, typeof data.nodes>();

  // Group nodes by package
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
  const packageNodeHeight = 60;

  const parentChildEdges: Edge[] = [];

  packageMap.forEach((packageNodes, packageId) => {
    const isExpanded = expandedPackages.has(packageId);
    const packageLabel = packageId || 'default';
    const pkgNodeId = `pkg-${packageId}`;

    const packageNodeData: PackageNodeData = {
      label: packageLabel,
      packageId: packageId,
      nodeCount: packageNodes.length,
      isExpanded: isExpanded,
      onToggle: togglePackage,
    };

    nodes.push({
      id: pkgNodeId,
      type: 'package',
      position: {
        x: packageX + 50,
        y: 0,
      },
      data: packageNodeData,
    });

    if (isExpanded) {
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
            x: 0,
            y: (nodeIndex + 1) * nodeHeight + packageNodeHeight,
          },
          data: nodeData,
          parentId: pkgNodeId,
        });

        parentChildEdges.push({
          id: `pkg-edge-${pkgNodeId}-${node.id}`,
          source: pkgNodeId,
          target: node.id,
          type: 'smoothstep',
          style: { stroke: 'rgba(128, 128, 255, 0.4)', strokeWidth: 1, strokeDasharray: '4 2' },
        });
      });
    }

    packageX += packageWidth + packagePadding;
  });

  // Build node to package mapping for edge routing
  const nodeToPackage = new Map<string, string>();
  data.nodes.forEach((node) => {
    nodeToPackage.set(node.id, node.package);
  });

  // Create edges with smart routing
  const edgeSet = new Set<string>();
  const edges: Edge[] = [];

  data.edges.forEach((edge, index) => {
    const sourcePackage = nodeToPackage.get(edge.source);
    const targetPackage = nodeToPackage.get(edge.target);
    const sourceExpanded = sourcePackage ? expandedPackages.has(sourcePackage) : true;
    const targetExpanded = targetPackage ? expandedPackages.has(targetPackage) : true;

    // Determine actual source and target based on expansion state
    const actualSource = sourceExpanded ? edge.source : `pkg-${sourcePackage}`;
    const actualTarget = targetExpanded ? edge.target : `pkg-${targetPackage}`;

    // Skip self-loops on package level
    if (actualSource === actualTarget) return;

    // Deduplicate edges
    const edgeKey = `${actualSource}->${actualTarget}`;
    if (edgeSet.has(edgeKey)) return;
    edgeSet.add(edgeKey);

    edges.push({
      id: `edge-${index}-${edgeKey}`,
      source: actualSource,
      target: actualTarget,
      animated: true,
      style: { stroke: 'rgba(255, 255, 255, 0.4)', strokeWidth: 2 },
    });
  });

  return { nodes, edges: [...parentChildEdges, ...edges] };
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

  const {
    expandedPackages,
    togglePackage,
    expandAll,
    collapseAll,
    expandedCount,
    totalPackages,
  } = usePackageGroups(data);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => calculateLayout(data, { expandedPackages, togglePackage }),
    [data, expandedPackages, togglePackage]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { getLayoutedNodes } = useAutoLayout();
  const [layoutMode, setLayoutMode] = useState<'flat' | 'auto'>('flat');

  // Update nodes when expanded packages change
  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = calculateLayout(data, {
      expandedPackages,
      togglePackage,
    });
    setNodes(newNodes);
    setEdges(newEdges);
  }, [expandedPackages, data, togglePackage, setNodes, setEdges]);

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
      // Don't select package nodes for detail panel
      if (node.type !== 'package') {
        setSelectedNodeId(node.id);
      }
    },
    [setSelectedNodeId]
  );

  const onPaneClick = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  const handleLayoutToggle = useCallback(() => {
    if (layoutMode === 'flat') {
      // Apply dagre hierarchical layout
      const layoutedNodes = getLayoutedNodes(nodes, edges, 'TB');
      setNodes(layoutedNodes);
      setLayoutMode('auto');
    } else {
      // Reset to flat package-based layout
      const { nodes: flatNodes } = calculateLayout(data, {
        expandedPackages,
        togglePackage,
      });
      setNodes(flatNodes);
      setLayoutMode('flat');
    }
  }, [layoutMode, nodes, edges, getLayoutedNodes, setNodes, data, expandedPackages, togglePackage]);

  const isAllExpanded = expandedCount === totalPackages;
  const isAllCollapsed = expandedCount === 0;

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
              case 'enum':
                return '#ffcc00';
              case 'external':
                return '#666666';
              case 'package':
                return '#8080ff';
              default:
                return '#ffffff';
            }
          }}
          maskColor="rgba(10, 10, 15, 0.8)"
        />
        <Panel position="top-right" className="layout-panel">
          <button
            className="expand-all-button"
            onClick={expandAll}
            disabled={isAllExpanded}
            title="Expand all packages"
          >
            📂 Expand All
          </button>
          <button
            className="collapse-all-button"
            onClick={collapseAll}
            disabled={isAllCollapsed}
            title="Collapse all packages"
          >
            📁 Collapse All
          </button>
          <button
            className="layout-toggle-button"
            onClick={handleLayoutToggle}
            title={layoutMode === 'flat' ? 'Switch to hierarchical layout' : 'Switch to flat layout'}
          >
            {layoutMode === 'flat' ? '📊 AutoLayout' : '📋 FlatLayout'}
          </button>
        </Panel>
      </ReactFlow>
      <DetailPanel node={selectedNode} onClose={clearSelection} />
    </div>
  );
}
