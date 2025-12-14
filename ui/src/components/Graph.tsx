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
import { PackageFilterPanel } from '@/components/PackageFilterPanel';
import { useSelection } from '@/hooks/useSelection';
import { useAutoLayout } from '@/hooks/useAutoLayout';
import { usePackageGroups } from '@/hooks/usePackageGroups';
import { usePackageVisibility } from '@/hooks/usePackageVisibility';
import { useIsMobile } from '@/hooks/useIsMobile';
import type { GraphData, NodeData, NodeType } from '@/types/graph';
import {
  NEON_MAGENTA,
  NEON_CYAN,
  NEON_YELLOW,
  NEON_GRAY,
  NEON_PURPLE,
  NEON_WHITE,
} from '@/constants/layout';
import { BUTTON_BASE_STYLES } from '@/constants/styles';

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
  visiblePackages: Set<string>;
  nodeToPackageMap: Map<string, string>;
}

// MiniMap node color mapping (memoized outside component)
const getNodeColor = (node: Node): string => {
  switch (node.type) {
    case 'service':
      return NEON_MAGENTA;
    case 'message':
      return NEON_CYAN;
    case 'enum':
      return NEON_YELLOW;
    case 'external':
      return NEON_GRAY;
    case 'package':
      return NEON_PURPLE;
    default:
      return NEON_WHITE;
  }
};

function calculateLayout(
  data: GraphData,
  options: CalculateLayoutOptions
): { nodes: Node[]; edges: Edge[] } {
  const { expandedPackages, togglePackage, visiblePackages, nodeToPackageMap } = options;
  const packageMap = new Map<string, typeof data.nodes>();

  // Group nodes by package (only visible packages)
  data.nodes.forEach((node) => {
    if (!visiblePackages.has(node.package)) return;
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

  // Create edges with smart routing (filter by visible packages)
  const edgeSet = new Set<string>();
  const edges: Edge[] = [];

  data.edges.forEach((edge, index) => {
    const sourcePackage = nodeToPackageMap.get(edge.source);
    const targetPackage = nodeToPackageMap.get(edge.target);

    // Skip edges where either endpoint's package is hidden
    if (sourcePackage && !visiblePackages.has(sourcePackage)) return;
    if (targetPackage && !visiblePackages.has(targetPackage)) return;

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

  const {
    visiblePackages,
    togglePackageVisibility,
    showAllPackages,
    hideAllPackages,
  } = usePackageVisibility(data);

  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

  const nodeToPackageMap = useMemo(() => {
    const map = new Map<string, string>();
    data.nodes.forEach((node) => {
      map.set(node.id, node.package);
    });
    return map;
  }, [data.nodes]);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => calculateLayout(data, { expandedPackages, togglePackage, visiblePackages, nodeToPackageMap }),
    [data, expandedPackages, togglePackage, visiblePackages, nodeToPackageMap]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { getLayoutedNodes } = useAutoLayout();
  const [layoutMode, setLayoutMode] = useState<'flat' | 'auto'>('flat');
  const isMobile = useIsMobile();

  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = calculateLayout(data, {
      expandedPackages,
      togglePackage,
      visiblePackages,
      nodeToPackageMap,
    });
    setNodes(newNodes);
    setEdges(newEdges);
  }, [expandedPackages, visiblePackages, data, togglePackage, nodeToPackageMap, setNodes, setEdges]);

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
            ? { stroke: 'var(--color-neon-cyan)', strokeWidth: 3 }
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
      const layoutedNodes = getLayoutedNodes(nodes, edges, 'TB');
      setNodes(layoutedNodes);
      setLayoutMode('auto');
    } else {
      const { nodes: flatNodes } = calculateLayout(data, {
        expandedPackages,
        togglePackage,
        visiblePackages,
        nodeToPackageMap,
      });
      setNodes(flatNodes);
      setLayoutMode('flat');
    }
  }, [layoutMode, nodes, edges, getLayoutedNodes, setNodes, data, expandedPackages, togglePackage, visiblePackages, nodeToPackageMap]);

  const handleFilterPanelToggle = useCallback(() => {
    setFilterPanelOpen((prev) => !prev);
  }, []);

  const handleFilterPanelClose = useCallback(() => {
    setFilterPanelOpen(false);
  }, []);

  const isAllExpanded = expandedCount === totalPackages;
  const isAllCollapsed = expandedCount === 0;

  return (
    <div className="relative flex-1 w-full h-full overflow-hidden">
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
        minZoom={0.1}
        maxZoom={2}
        panOnScroll={true}
        zoomOnPinch={true}
        preventScrolling={true}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="rgba(255, 255, 255, 0.1)"
        />
        <Controls className="neon-controls" />
        {/* MiniMap hidden on tablet and below */}
        {!isMobile && (
          <MiniMap
            className="neon-minimap"
            nodeColor={getNodeColor}
            maskColor="rgba(10, 10, 15, 0.8)"
          />
        )}
        <Panel position="top-right" className="m-2 flex flex-col sm:flex-row gap-2">
          <button
            className={`${BUTTON_BASE_STYLES} ${filterPanelOpen ? 'bg-neon-cyan/20 border-neon-cyan' : ''}`}
            onClick={handleFilterPanelToggle}
            title="Filter packages"
            aria-label="Filter packages"
          >
            <span className="sm:hidden">📦</span>
            <span className="hidden sm:inline">📦 Filter</span>
          </button>
          <button
            className={BUTTON_BASE_STYLES}
            onClick={expandAll}
            disabled={isAllExpanded}
            title="Expand all packages"
            aria-label="Expand all packages"
          >
            <span className="sm:hidden">📂</span>
            <span className="hidden sm:inline">📂 Expand All</span>
          </button>
          <button
            className={BUTTON_BASE_STYLES}
            onClick={collapseAll}
            disabled={isAllCollapsed}
            title="Collapse all packages"
            aria-label="Collapse all packages"
          >
            <span className="sm:hidden">📁</span>
            <span className="hidden sm:inline">📁 Collapse All</span>
          </button>
          <button
            className={BUTTON_BASE_STYLES}
            onClick={handleLayoutToggle}
            title={layoutMode === 'flat' ? 'Switch to hierarchical layout' : 'Switch to flat layout'}
            aria-label={layoutMode === 'flat' ? 'Switch to hierarchical layout' : 'Switch to flat layout'}
          >
            <span className="sm:hidden">{layoutMode === 'flat' ? '📊' : '📋'}</span>
            <span className="hidden sm:inline">
              {layoutMode === 'flat' ? '📊 AutoLayout' : '📋 FlatLayout'}
            </span>
          </button>
        </Panel>
      </ReactFlow>
      {filterPanelOpen && (
        <PackageFilterPanel
          packages={data.packages}
          visiblePackages={visiblePackages}
          onToggle={togglePackageVisibility}
          onShowAll={showAllPackages}
          onHideAll={hideAllPackages}
          onClose={handleFilterPanelClose}
        />
      )}
      <DetailPanel node={selectedNode} onClose={clearSelection} />
    </div>
  );
}
