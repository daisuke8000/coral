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
    <div className={`rounded-xl p-3 sm:p-4 min-w-[140px] sm:min-w-[180px] transition-all duration-300 hover:scale-[1.02] ${className}`}>
      <Handle type="target" position={Position.Top} className="handle-top" />
      <div className="text-center">
        <div className="text-xl sm:text-2xl mb-1 sm:mb-2">{icon}</div>
        <div className="font-semibold text-sm sm:text-base mb-1 break-words">{data.label}</div>
        <div className="text-[0.65rem] sm:text-xs text-text-secondary break-all max-sm:hidden">{data.file}</div>
        {children}
      </div>
      <Handle type="source" position={Position.Bottom} className="handle-bottom" />
    </div>
  );
});
