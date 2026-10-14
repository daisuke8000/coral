import { useState, useCallback, useMemo } from 'react';
import type { GraphData } from '@/types/graph';
import { getVisiblePackageIds } from '@/lib/graphView';

export interface UsePackageVisibilityReturn {
  visiblePackages: Set<string>;
  togglePackageVisibility: (packageId: string) => void;
  showAllPackages: () => void;
  hideAllPackages: () => void;
}

export function usePackageVisibility(data: GraphData): UsePackageVisibilityReturn {
  // Store exclusions so newly fetched packages are visible by default.
  const [hiddenPackages, setHiddenPackages] = useState<Set<string>>(new Set());
  const visiblePackages = useMemo(
    () => getVisiblePackageIds(data.packages, hiddenPackages),
    [data.packages, hiddenPackages]
  );

  const togglePackageVisibility = useCallback((packageId: string) => {
    setHiddenPackages((prev) => {
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
    setHiddenPackages(new Set());
  }, []);

  const hideAllPackages = useCallback(() => {
    setHiddenPackages(new Set(data.packages.map((pkg) => pkg.id)));
  }, [data.packages]);

  return {
    visiblePackages,
    togglePackageVisibility,
    showAllPackages,
    hideAllPackages,
  };
}
