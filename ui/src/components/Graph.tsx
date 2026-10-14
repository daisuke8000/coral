import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
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
  type NodeChange,
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
import { styleGraphEdge } from '@/lib/graphSelection';
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
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const workbenchRef = useRef<HTMLDivElement>(null);

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

  const selectableNodeIds = useMemo(() => new Set(
    initialNodes.filter((node) => node.type !== 'package').map((node) => node.id)
  ), [initialNodes]);
  const {
    selectedNodeId, selectedNode, setSelectedNodeId,
    isNodeHighlighted, highlightedNodeIds, clearSelection,
  } = useSelection(data, selectableNodeIds);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { getLayoutedNodes } = useAutoLayout();
  const [layoutMode, setLayoutMode] = useState<'flat' | 'auto'>('flat');
  const isMobile = useIsMobile();

  useEffect(() => {
    const newNodes = initialNodes;
    const newEdges = initialEdges;
    if (layoutMode === 'auto') {
      const layouted = getLayoutedNodes(newNodes, newEdges, 'TB');
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
      edges.map((edge) => styleGraphEdge(edge, selectedNodeId, highlightedNodeIds, motionEnabled)),
    [edges, selectedNodeId, highlightedNodeIds, motionEnabled]
  );

  const selectDefinition = useCallback((id: string) => {
    setSelectedNodeId(id);
    if (isMobile) setFilterPanelOpen(false);
  }, [setSelectedNodeId, isMobile]);

  const handleNodesChange = useCallback((changes: NodeChange<Node>[]) => {
    onNodesChange(changes);
    // React Flow's keyboard selection uses node changes rather than a mouse click.
    const selection = changes.find((change) => change.type === 'select' && change.selected);
    if (selection?.type === 'select' && selectableNodeIds.has(selection.id)) selectDefinition(selection.id);
  }, [onNodesChange, selectableNodeIds, selectDefinition]);

  const onNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      // Don't select package nodes for detail panel
      if (node.type !== 'package') {
        selectDefinition(node.id);
      }
    },
    [selectDefinition]
  );

  const handleDetailClose = useCallback(() => {
    if (selectedNodeId !== null) {
      workbenchRef.current?.querySelector<HTMLElement>(
        `.react-flow__node[data-id="${CSS.escape(selectedNodeId)}"]`
      )?.focus();
    }
    clearSelection();
  }, [selectedNodeId, clearSelection]);

  const onPaneClick = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  const handleLayoutToggle = useCallback(() => {
    setLayoutMode((mode) => mode === 'flat' ? 'auto' : 'flat');
  }, []);

  const handleFilterPanelToggle = useCallback(() => {
    // On narrow screens the two bottom sheets would otherwise cover each other.
    if (isMobile) clearSelection();
    setFilterPanelOpen((prev) => !prev);
  }, [isMobile, clearSelection]);

  const handleFilterPanelClose = useCallback(() => {
    setFilterPanelOpen(false);
    filterButtonRef.current?.focus();
  }, []);

  const isAllExpanded = expandedCount === totalPackages;
  const isAllCollapsed = expandedCount === 0;

  return (
    <div
      ref={workbenchRef}
      className="graph-workbench relative flex-1 w-full h-full min-h-0 overflow-hidden"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          handleDetailClose();
          if (filterPanelOpen) handleFilterPanelClose();
        }
      }}
    >
      <ReactFlow
        nodes={styledNodes}
        edges={styledEdges}
        onNodesChange={handleNodesChange}
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
        <Controls className="neon-controls" fitViewOptions={{ duration: motionEnabled ? 500 : 0 }} />
        {/* MiniMap hidden on tablet and below */}
        {!isMobile && (
          <MiniMap
            className="neon-minimap"
            nodeColor={getNodeColor}
            maskColor="rgba(10, 10, 15, 0.8)"
          />
        )}
        <Panel position="top-right" className="graph-toolbar" role="group" aria-label="Graph tools">
          <button
            className={BUTTON_BASE_STYLES}
            onClick={() => setMotionEnabled((enabled) => !enabled)}
            aria-pressed={motionEnabled}
            title="Toggle graph animations"
          >
            {motionEnabled ? 'Motion on' : 'Motion off'}
          </button>
          <button
            ref={filterButtonRef}
            aria-expanded={filterPanelOpen}
            aria-controls="package-filter-panel"
            className={BUTTON_BASE_STYLES}
            onClick={handleFilterPanelToggle}
            title="Filter packages"
            aria-label="Filter packages"
          >
            Packages
          </button>
          <button
            className={BUTTON_BASE_STYLES}
            onClick={expandAll}
            disabled={isAllExpanded}
            title="Expand all packages"
            aria-label="Expand all packages"
          >
            Expand all
          </button>
          <button
            className={BUTTON_BASE_STYLES}
            onClick={collapseAll}
            disabled={isAllCollapsed}
            title="Collapse all packages"
            aria-label="Collapse all packages"
          >
            Collapse all
          </button>
          <button
            className={BUTTON_BASE_STYLES}
            aria-pressed={layoutMode === 'auto'}
            onClick={handleLayoutToggle}
            title={layoutMode === 'flat' ? 'Switch to hierarchical layout' : 'Switch to flat layout'}
            aria-label={layoutMode === 'flat' ? 'Switch to hierarchical layout' : 'Switch to flat layout'}
          >
            {layoutMode === 'flat' ? 'AutoLayout' : 'Flat layout'}
          </button>
        </Panel>
        {visiblePackages.size === 0 && totalPackages > 0 && (
          <Panel position="bottom-center" className="graph-empty">
            <p className="text-sm text-text-secondary">All packages are hidden.</p>
            <button className={BUTTON_BASE_STYLES} onClick={showAllPackages}>Show all packages</button>
          </Panel>
        )}
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
      <DetailPanel node={selectedNode} onClose={handleDetailClose} />
    </div>
  );
}
