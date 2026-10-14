import { useState, useCallback } from 'react';
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

  return {
    expandedPackages,
    togglePackage,
    expandAll,
    collapseAll,
    expandedCount: expandedPackages.size,
    totalPackages: data.packages.length,
  };
}
