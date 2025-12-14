import { useState, useCallback, useMemo } from 'react';
import type { GraphData } from '@/types/graph';

export interface UsePackageVisibilityReturn {
  visiblePackages: Set<string>;
  togglePackageVisibility: (packageId: string) => void;
  showAllPackages: () => void;
  hideAllPackages: () => void;
  isPackageVisible: (packageId: string) => boolean;
  isNodeInVisiblePackage: (nodeId: string) => boolean;
  visibleCount: number;
  totalPackages: number;
}

export function usePackageVisibility(data: GraphData): UsePackageVisibilityReturn {
  const [visiblePackages, setVisiblePackages] = useState<Set<string>>(() =>
    new Set(data.packages.map((pkg) => pkg.id))
  );

  const nodeToPackage = useMemo(() => {
    const map = new Map<string, string>();
    data.packages.forEach((pkg) => {
      pkg.nodeIds.forEach((nodeId) => {
        map.set(nodeId, pkg.id);
      });
    });
    return map;
  }, [data.packages]);

  const togglePackageVisibility = useCallback((packageId: string) => {
    setVisiblePackages((prev) => {
      const next = new Set(prev);
      if (next.has(packageId)) {
        next.delete(packageId);
      } else {
        next.add(packageId);
      }
      return next;
    });
  }, []);

  const showAllPackages = useCallback(() => {
    setVisiblePackages(new Set(data.packages.map((pkg) => pkg.id)));
  }, [data.packages]);

  const hideAllPackages = useCallback(() => {
    setVisiblePackages(new Set());
  }, []);

  const isPackageVisible = useCallback(
    (packageId: string) => visiblePackages.has(packageId),
    [visiblePackages]
  );

  const isNodeInVisiblePackage = useCallback(
    (nodeId: string) => {
      const packageId = nodeToPackage.get(nodeId);
      if (!packageId) return true; // Nodes without package are always visible
      return visiblePackages.has(packageId);
    },
    [nodeToPackage, visiblePackages]
  );

  return {
    visiblePackages,
    togglePackageVisibility,
    showAllPackages,
    hideAllPackages,
    isPackageVisible,
    isNodeInVisiblePackage,
    visibleCount: visiblePackages.size,
    totalPackages: data.packages.length,
  };
}
