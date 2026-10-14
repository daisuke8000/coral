import type { Node, Edge } from '@xyflow/react';
import type { GraphData, NodeData } from '../types/graph.ts';
import type { PackageNodeData } from '../components/nodes/PackageGroupNode.tsx';

interface CalculateLayoutOptions {
  expandedPackages: Set<string>;
  togglePackage: (packageId: string) => void;
  visiblePackages: Set<string>;
  nodeToPackageMap: Map<string, string>;
}

export function calculateLayout(
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
          nodeType: node.type,
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
    if (sourcePackage === undefined || !visiblePackages.has(sourcePackage)) return;
    if (targetPackage === undefined || !visiblePackages.has(targetPackage)) return;

    const sourceExpanded = expandedPackages.has(sourcePackage);
    const targetExpanded = expandedPackages.has(targetPackage);

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
      animated: false,
      style: { stroke: 'rgba(255, 255, 255, 0.4)', strokeWidth: 2 },
    });
  });

  return { nodes, edges: [...parentChildEdges, ...edges] };
}

