import { useState, useCallback, useMemo } from 'react';
import type { GraphData } from '@/types/graph';

interface UsePackageGroupsReturn {
  /** Set of currently expanded package IDs */
  expandedPackages: Set<string>;
  /** Toggle a single package's expanded state */
  togglePackage: (packageId: string) => void;
  /** Expand all packages */
  expandAll: () => void;
  /** Collapse all packages */
  collapseAll: () => void;
  /** Check if a specific package is expanded */
  isPackageExpanded: (packageId: string) => boolean;
  /** Check if a node should be visible based on package expansion state */
  isNodeVisible: (nodeId: string) => boolean;
  /** Count of expanded packages */
  expandedCount: number;
  /** Total package count */
  totalPackages: number;
}

export function usePackageGroups(data: GraphData): UsePackageGroupsReturn {
  // Start with all packages collapsed
  const [expandedPackages, setExpandedPackages] = useState<Set<string>>(
    new Set()
  );

  // Build a lookup map: nodeId -> packageId
  const nodeToPackage = useMemo(() => {
    const map = new Map<string, string>();
    data.packages.forEach((pkg) => {
      pkg.nodeIds.forEach((nodeId) => {
        map.set(nodeId, pkg.id);
      });
    });
    return map;
  }, [data.packages]);

  const togglePackage = useCallback((packageId: string) => {
    setExpandedPackages((prev) => {
      const next = new Set(prev);
      if (next.has(packageId)) {
        next.delete(packageId);
      } else {
        next.add(packageId);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedPackages(new Set(data.packages.map((pkg) => pkg.id)));
  }, [data.packages]);

  const collapseAll = useCallback(() => {
    setExpandedPackages(new Set());
  }, []);

  const isPackageExpanded = useCallback(
    (packageId: string) => expandedPackages.has(packageId),
    [expandedPackages]
  );

  const isNodeVisible = useCallback(
    (nodeId: string) => {
      const packageId = nodeToPackage.get(nodeId);
      if (!packageId) return true; // Nodes without package are always visible
      return expandedPackages.has(packageId);
    },
    [nodeToPackage, expandedPackages]
  );

  return {
    expandedPackages,
    togglePackage,
    expandAll,
    collapseAll,
    isPackageExpanded,
    isNodeVisible,
    expandedCount: expandedPackages.size,
    totalPackages: data.packages.length,
  };
}
