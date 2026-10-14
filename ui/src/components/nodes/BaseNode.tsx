import { memo, type ReactNode } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeData } from '@/types/graph';

interface BaseNodeProps {
  data: NodeData;
  className: string;
  icon: string;
  children?: ReactNode;
}

/**
 * Base node component that provides common structure for all node types
 * Handles positioning, handles (connection points), and responsive styling
 */
export const BaseNode = memo(function BaseNode({
  data,
  className,
  icon,
  children
}: BaseNodeProps) {
  return (
    <div className={`graph-node rounded-xl transition-transform duration-300 hover:scale-[1.02] ${className}`}>
      <Handle type="target" position={Position.Top} className="handle-top" />
      <div className="text-left min-w-0">
        <div className="node-kind"><span aria-hidden="true">{icon}</span>{data.nodeType}</div>
        <div className="node-label" title={data.label}>{data.label}</div>
        <div className="node-file" title={data.file}>{data.file}</div>
        {children}
      </div>
      <Handle type="source" position={Position.Bottom} className="handle-bottom" />
    </div>
  );
});
