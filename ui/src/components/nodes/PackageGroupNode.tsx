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

export function PackageGroupNode({ data }: PackageGroupNodeProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    data.onToggle(data.packageId);
  };

  return (
    <div className="package-group-node">
      <Handle type="target" position={Position.Top} className="handle-top" />
      <div className="node-content">
        <button
          className="package-toggle"
          onClick={handleClick}
          aria-expanded={data.isExpanded}
          aria-label={data.isExpanded ? 'Collapse package' : 'Expand package'}
        >
          <span className="toggle-icon">
            {data.isExpanded ? '▼' : '▶'}
          </span>
        </button>
        <div className="package-info">
          <span className="node-icon">📦</span>
          <span className="node-label">{data.label}</span>
          <span className="node-count">({data.nodeCount})</span>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="handle-bottom" />
    </div>
  );
}
