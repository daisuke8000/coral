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
  type NodeTypes,
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
} from '@/components/nodes';
import { calculateLayout } from '@/lib/graphView';
import { DetailPanel } from '@/components/DetailPanel';
import { PackageFilterPanel } from '@/components/PackageFilterPanel';
import { useSelection } from '@/hooks/useSelection';
import { useAutoLayout } from '@/hooks/useAutoLayout';
import { usePackageGroups } from '@/hooks/usePackageGroups';
import { usePackageVisibility } from '@/hooks/usePackageVisibility';
import { useIsMobile } from '@/hooks/useIsMobile';
import type { GraphData } from '@/types/graph';
import {
  NEON_MAGENTA,
  NEON_CYAN,
  NEON_YELLOW,
  NEON_GRAY,
  NEON_PURPLE,
  NEON_WHITE,
} from '@/constants/layout';
import { BUTTON_BASE_STYLES } from '@/constants/styles';

const nodeTypes: NodeTypes = {
  service: ServiceNode,
  message: MessageNode,
  enum: EnumNode,
  external: ExternalNode,
  package: PackageGroupNode,
};

interface GraphProps {
  data: GraphData;
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
  const [motionEnabled, setMotionEnabled] = useState(true);

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
    const newNodes = initialNodes;
    const newEdges = initialEdges;
    if (layoutMode === 'auto') {
      // Strip parentId so Dagre can layout all nodes flat
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const flatNodes = newNodes.map(({ parentId: _parentId, ...rest }) => rest);
      const layouted = getLayoutedNodes(flatNodes, newEdges, 'TB');
      setNodes(layouted);
    } else {
      setNodes(newNodes);
    }
    setEdges(newEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges, layoutMode, getLayoutedNodes]);

  const highlightedPackages = useMemo(() => new Set(
    data.nodes.filter((node) => isNodeHighlighted(node.id)).map((node) => node.package)
  ), [data.nodes, isNodeHighlighted]);

  const styledNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        className: isNodeHighlighted(node.id) || (node.type === 'package' && highlightedPackages.has(String(node.data.packageId))) ? '' : 'dimmed',
        selected: node.id === selectedNodeId,
      })),
    [nodes, selectedNodeId, isNodeHighlighted, highlightedPackages]
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
          animated: motionEnabled && highlighted,
        };
      }),
    [edges, isEdgeHighlighted, motionEnabled]
  );

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
    setLayoutMode((mode) => mode === 'flat' ? 'auto' : 'flat');
  }, []);

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
        nodesConnectable={false}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
        className={`neon-flow ${motionEnabled ? '' : 'quiet-flow'}`}
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
            className={BUTTON_BASE_STYLES}
            onClick={() => setMotionEnabled((enabled) => !enabled)}
            aria-pressed={motionEnabled}
            title="Toggle graph animations"
          >
            {motionEnabled ? 'Animations on' : 'Animations off'}
          </button>
          <button
            aria-expanded={filterPanelOpen}
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
      <DetailPanel key={selectedNode?.id} node={selectedNode} onClose={clearSelection} />
    </div>
  );
}
