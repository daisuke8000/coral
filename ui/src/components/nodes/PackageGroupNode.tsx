import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

export interface PackageNodeData extends Record<string, unknown> {
  label: string;
  packageId: string;
  nodeCount: number;
  isExpanded: boolean;
  onToggle: (packageId: string) => void;
}

interface PackageGroupNodeProps {
  data: PackageNodeData;
}

export const PackageGroupNode = memo(function PackageGroupNode({ data }: PackageGroupNodeProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    data.onToggle(data.packageId);
  };

  return (
    <div className="package-group-node bg-neon-purple/10 border-2 border-neon-purple rounded-xl p-2.5 sm:p-3 min-w-[160px] sm:min-w-[200px] shadow-[0_0_10px_rgba(128,128,255,0.5),0_0_20px_rgba(128,128,255,0.3)] transition-all duration-300 hover:shadow-[0_0_15px_rgba(128,128,255,0.6),0_0_30px_rgba(128,128,255,0.4)] hover:scale-[1.02]">
      <Handle type="target" position={Position.Top} className="handle-top" />
      <div className="flex items-center gap-2">
        <button
          className="bg-transparent border-none text-text-primary cursor-pointer p-1 text-xs sm:text-sm transition-transform duration-200 hover:scale-125 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center touch-manipulation"
          onClick={handleClick}
          aria-expanded={data.isExpanded}
          aria-label={data.isExpanded ? 'Collapse package' : 'Expand package'}
        >
          <span className="inline-block transition-transform duration-200">
            {data.isExpanded ? '▼' : '▶'}
          </span>
        </button>
        <div className="flex items-center gap-1.5 flex-1">
          <span className="text-base sm:text-lg">📦</span>
          <span className="font-semibold text-xs sm:text-sm text-neon-purple">{data.label}</span>
          <span className="text-[0.65rem] sm:text-xs text-text-secondary font-normal">({data.nodeCount})</span>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="handle-bottom" />
    </div>
  );
});
