import type { Node, Edge } from '@xyflow/react';
import type { GraphData, NodeData, Package } from '../types/graph.ts';
import type { PackageNodeData } from '../components/nodes/PackageGroupNode.tsx';

interface GraphViewEdgeData extends Record<string, unknown> {
  kind: 'membership' | 'dependency';
  definitionIds: Set<string>;
}

export type GraphViewEdge = Edge<GraphViewEdgeData>;

/** Commit topology immediately without undoing positions chosen by the user. */
export function reconcileNodes(current: Node[], next: Node[]): Node[] {
  const previous = new Map(current.map((node) => [node.id, node]));
  return next.map((node) => {
    const existing = previous.get(node.id);
    return existing && existing.type === node.type && existing.parentId === node.parentId
      ? { ...existing, ...node, position: existing.position }
      : node;
  });
}

export function filterPackages(packages: Package[], query: string): Package[] {
  const term = query.trim().toLowerCase();
  return packages.filter((pkg) => `${pkg.id || 'default'} ${pkg.label ?? ''}`.toLowerCase().includes(term));
}

export function getVisiblePackageIds(packages: Package[], hiddenPackages: Set<string>): Set<string> {
  return new Set(packages.filter((pkg) => !hiddenPackages.has(pkg.id)).map((pkg) => pkg.id));
}

export function getExpandedPackageIds(packages: Package[], expandedPackages: Set<string>): Set<string> {
  return new Set(packages.filter((pkg) => expandedPackages.has(pkg.id)).map((pkg) => pkg.id));
}

interface CalculateLayoutOptions {
  expandedPackages: Set<string>;
  togglePackage: (packageId: string) => void;
  visiblePackages: Set<string>;
  nodeToPackageMap: Map<string, string>;
}

export function calculateLayout(
  data: GraphData,
  options: CalculateLayoutOptions
): { nodes: Node[]; edges: GraphViewEdge[] } {
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
  const packageWidth = 240;
  const nodeHeight = 168;
  const packagePadding = 100;
  const packageNodeHeight = 64;

  const parentChildEdges: GraphViewEdge[] = [];

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
      selectable: false,
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
          nodeType: node.type,
          details: node.details,
        };
        nodes.push({
          id: node.id,
          type: node.type,
          position: {
            x: 0,
            y: packageNodeHeight + 56 + nodeIndex * nodeHeight,
          },
          data: nodeData,
          parentId: pkgNodeId,
        });

        parentChildEdges.push({
          id: `pkg-edge-${pkgNodeId}-${node.id}`,
          source: pkgNodeId,
          target: node.id,
          type: 'smoothstep',
          data: { kind: 'membership', definitionIds: new Set([node.id]) },
          style: { stroke: 'var(--color-neon-purple)', strokeOpacity: 0.4, strokeWidth: 1, strokeDasharray: '4 2' },
        });
      });
    }

    packageX += packageWidth + packagePadding;
  });

  // Create edges with smart routing (filter by visible packages)
  const edgeMap = new Map<string, GraphViewEdge>();
  const edges: GraphViewEdge[] = [];

  data.edges.forEach((edge) => {
    const sourcePackage = nodeToPackageMap.get(edge.source);
    const targetPackage = nodeToPackageMap.get(edge.target);

    // Skip edges where either endpoint's package is hidden
    if (sourcePackage === undefined || !visiblePackages.has(sourcePackage)) return;
    if (targetPackage === undefined || !visiblePackages.has(targetPackage)) return;

    const sourceExpanded = expandedPackages.has(sourcePackage);
    const targetExpanded = expandedPackages.has(targetPackage);

    // Determine actual source and target based on expansion state
    const actualSource = sourceExpanded ? edge.source : `pkg-${sourcePackage}`;
    const actualTarget = targetExpanded ? edge.target : `pkg-${targetPackage}`;

    // Only suppress references hidden inside a collapsed package, not recursive
    // definition dependencies (e.g. a tree message referencing itself).
    if (actualSource === actualTarget && !sourceExpanded) return;

    // Retain every underlying endpoint so collapsed routes still highlight correctly.
    const edgeKey = JSON.stringify([actualSource, actualTarget]);
    const existing = edgeMap.get(edgeKey);
    if (existing) {
      existing.data?.definitionIds.add(edge.source);
      existing.data?.definitionIds.add(edge.target);
      return;
    }

    const routedEdge: GraphViewEdge = {
      id: `edge-${edgeKey}`,
      source: actualSource,
      target: actualTarget,
      type: actualSource === actualTarget ? 'selfReference' : 'default',
      data: { kind: 'dependency', definitionIds: new Set([edge.source, edge.target]) },
      animated: true,
      style: { stroke: 'var(--color-neon-cyan)', strokeOpacity: 0.55, strokeWidth: 2 },
    };
    edgeMap.set(edgeKey, routedEdge);
    edges.push(routedEdge);
  });

  return { nodes, edges: [...parentChildEdges, ...edges] };
}

/** Keep the same parent coordinate system in both layouts to avoid reparenting jumps. */
export function applyLayoutPositions(
  nodes: Node[],
  positions: Map<string, { x: number; y: number }>
): Node[] {
  return nodes.map((node) => {
    const position = positions.get(node.id);
    if (!position) return node;
    const parent = node.parentId ? positions.get(node.parentId) : undefined;
    return {
      ...node,
      position: parent
        ? { x: position.x - parent.x, y: position.y - parent.y }
        : position,
    };
  });
}

