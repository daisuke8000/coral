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
    <div className="package-group-node rounded-xl hover:shadow-[0_0_20px_rgba(128,128,255,0.4)]">
      <Handle type="target" position={Position.Top} className="handle-top" />
      <div className="flex items-center gap-2 h-full">
        <button
          className="package-toggle nodrag nopan"
          onClick={handleClick}
          aria-expanded={data.isExpanded}
          aria-label={`${data.isExpanded ? 'Collapse' : 'Expand'} package ${data.label}`}
        >
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform duration-200 ${data.isExpanded ? 'rotate-90' : ''}`}>
            <path d="m9 5 7 7-7 7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <span className="block text-xs font-semibold text-neon-purple truncate" title={data.label}>{data.label}</span>
          <span className="text-[11px] text-text-secondary tabular-nums">{data.nodeCount} definitions</span>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="handle-bottom" />
    </div>
  );
});
