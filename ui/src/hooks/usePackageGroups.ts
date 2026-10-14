import { useState, useCallback, useMemo } from 'react';
import type { GraphData } from '@/types/graph';
import { getExpandedPackageIds } from '@/lib/graphView';

export function usePackageGroups(data: GraphData) {
  // Start with all packages collapsed
  const [expandedIds, setExpandedPackages] = useState<Set<string>>(new Set());
  const expandedPackages = useMemo(
    () => getExpandedPackageIds(data.packages, expandedIds),
    [data.packages, expandedIds]
  );

  const togglePackage = useCallback((packageId: string) => {
    setExpandedPackages((prev) => {
      const next = new Set(prev);
      if (!next.delete(packageId)) next.add(packageId);
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
