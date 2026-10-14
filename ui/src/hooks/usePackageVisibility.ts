import { useState, useCallback } from 'react';
import type { GraphData } from '@/types/graph';

export interface UsePackageVisibilityReturn {
  visiblePackages: Set<string>;
  togglePackageVisibility: (packageId: string) => void;
  showAllPackages: () => void;
  hideAllPackages: () => void;

}

export function usePackageVisibility(data: GraphData): UsePackageVisibilityReturn {
  const [visiblePackages, setVisiblePackages] = useState<Set<string>>(() =>
    new Set(data.packages.map((pkg) => pkg.id))
  );

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

  return {
    visiblePackages,
    togglePackageVisibility,
    showAllPackages,
    hideAllPackages,
  };
}
