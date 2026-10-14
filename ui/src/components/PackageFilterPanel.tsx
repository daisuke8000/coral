import { memo, useMemo, useState } from 'react';
import type { Package } from '@/types/graph';
import { filterPackages } from '@/lib/graphView';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useSwipeToClose } from '@/hooks/useSwipeToClose';
import { SWIPE_THRESHOLD } from '@/constants/layout';
import { BUTTON_PRIMARY_STYLES, BUTTON_SECONDARY_STYLES } from '@/constants/styles';

interface PackageFilterPanelProps {
  packages: Package[];
  visiblePackages: Set<string>;
  onToggle: (packageId: string) => void;
  onShowAll: () => void;
  onHideAll: () => void;
  onClose: () => void;
}

export const PackageFilterPanel = memo(function PackageFilterPanel({
  packages,
  visiblePackages,
  onToggle,
  onShowAll,
  onHideAll,
  onClose,
}: PackageFilterPanelProps) {
  const [query, setQuery] = useState('');
  const filteredPackages = useMemo(() => filterPackages(packages, query), [packages, query]);
  const isMobile = useIsMobile();
  const { handleTouchStart, handleTouchEnd } = useSwipeToClose(onClose, SWIPE_THRESHOLD);

  const visibleCount = visiblePackages.size;
  const totalCount = packages.length;

  return (
    <div
      id="package-filter-panel"
      role="region"
      aria-label="Package visibility"
      className={`
        workbench-panel custom-scrollbar absolute z-[100] overflow-y-auto
        left-0 top-0 h-full w-[260px] min-w-[220px] max-w-[40vw]
        border-r animate-slide-in-left
        max-sm:fixed max-sm:inset-x-0 max-sm:top-auto max-sm:bottom-0
        max-sm:h-[60vh] max-sm:max-h-[60vh] max-sm:w-full max-sm:min-w-full max-sm:max-w-full
        max-sm:border-r-0 max-sm:border-t max-sm:rounded-t-2xl
        max-sm:animate-slide-in-up
      `}
    >
      {isMobile && (
        <div className="flex justify-center pt-3 pb-1" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          <div className="w-10 h-1 bg-white/30 rounded-full" />
        </div>
      )}

      <div className="panel-header flex items-center justify-between p-3 sm:p-4 border-b sticky top-0 z-10">
        <div>
          <p className="panel-eyebrow">Visibility</p>
          <h2 className="text-base font-semibold">Packages <span className="text-xs text-text-secondary font-normal tabular-nums">{visibleCount}/{totalCount}</span></h2>
        </div>
        <button
          className="panel-close min-h-[44px] min-w-[44px] flex items-center justify-center
                     text-xl sm:text-2xl text-text-secondary hover:text-white
                     bg-transparent hover:bg-white/10 rounded-lg transition-colors duration-200 touch-manipulation"
          onClick={onClose}
          aria-label="Close package filter panel"
        >
          ×
        </button>
      </div>

      <div className="flex gap-2 p-3 border-b border-white/10">
        <button
          onClick={onShowAll}
          disabled={visibleCount === totalCount}
          aria-label="Show all packages"
          className={`
            ${BUTTON_PRIMARY_STYLES}
            ${visibleCount === totalCount ? 'opacity-40 cursor-not-allowed' : ''}
          `}
        >
          Show all
        </button>
        <button
          onClick={onHideAll}
          disabled={visibleCount === 0}
          aria-label="Hide all packages"
          className={`
            ${BUTTON_SECONDARY_STYLES}
            ${visibleCount === 0 ? 'opacity-40 cursor-not-allowed' : ''}
          `}
        >
          Hide all
        </button>
      </div>

      <div className="p-3">
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search packages"
          placeholder="Search packages…"
          className="w-full min-h-[44px] rounded-lg border border-border-subtle bg-bg-dark p-2.5 text-sm placeholder:text-text-muted"
        />
        <p className="mt-2 text-xs text-text-secondary" aria-live="polite">
          {filteredPackages.length} {filteredPackages.length === 1 ? 'match' : 'matches'} · Show/hide all affects every package
        </p>
      </div>
      <div className="p-2 sm:p-3 space-y-1">
        {filteredPackages.map((pkg) => {
          const isVisible = visiblePackages.has(pkg.id);
          const nodeCount = pkg.nodeIds.length;

          return (
            <label
              key={pkg.id}
              className={`
                package-filter-label flex items-center gap-3 p-2 sm:p-2.5 rounded-lg cursor-pointer
                transition-colors duration-200 select-none min-h-[44px]
                ${isVisible
                  ? 'bg-neon-cyan/10 hover:bg-neon-cyan/15'
                  : 'bg-white/5 hover:bg-white/10 opacity-60'}
              `}
            >
              <div
                className={`
                  w-5 h-5 flex-shrink-0 rounded border-2 flex items-center justify-center transition-all duration-200
                  ${isVisible ? 'bg-neon-cyan/20 border-neon-cyan' : 'bg-transparent border-white/30'}
                `}
              >
                {isVisible && (
                  <svg className="w-3 h-3 text-neon-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <input
                type="checkbox"
                checked={isVisible}
                onChange={() => onToggle(pkg.id)}
                className="sr-only"
                aria-label={`Toggle visibility for package ${pkg.id || 'default'}`}
              />
              <div className="flex-1 min-w-0">
                <span
                  className={`block text-sm font-medium truncate ${isVisible ? 'text-white' : 'text-text-secondary'}`}
                  title={pkg.id || 'default'}
                >
                  {pkg.label || pkg.id || 'default'}
                </span>
              </div>
              <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${isVisible ? 'bg-neon-cyan/20 text-neon-cyan' : 'bg-white/10 text-text-secondary'}`}>
                {nodeCount}
              </span>
            </label>
          );
        })}
      </div>

      {filteredPackages.length === 0 && (
        <div className="p-4 text-center text-text-secondary text-sm">
          No matching packages
        </div>
      )}
    </div>
  );
});
