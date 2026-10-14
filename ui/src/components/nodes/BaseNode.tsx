import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeData } from '@/types/graph';

const appearance = {
  service: {
    icon: '⚡',
    className: 'service-node bg-neon-magenta/10 border-2 border-neon-magenta shadow-[0_0_10px_var(--color-neon-magenta),0_0_20px_var(--color-neon-magenta),0_0_40px_rgba(255,0,255,0.3)] animate-pulse-magenta hover:shadow-[0_0_15px_var(--color-neon-magenta),0_0_30px_var(--color-neon-magenta),0_0_60px_rgba(255,0,255,0.5)]',
  },
  message: {
    icon: '📦',
    className: 'message-node bg-neon-cyan/10 border-2 border-neon-cyan shadow-[0_0_10px_var(--color-neon-cyan),0_0_20px_rgba(0,255,255,0.4)] animate-pulse-cyan hover:shadow-[0_0_15px_var(--color-neon-cyan),0_0_30px_var(--color-neon-cyan),0_0_50px_rgba(0,255,255,0.4)]',
  },
  enum: {
    icon: '📋',
    className: 'enum-node bg-neon-yellow/10 border-2 border-neon-yellow shadow-[0_0_10px_var(--color-neon-yellow),0_0_20px_rgba(255,204,0,0.4)] animate-pulse-yellow hover:shadow-[0_0_15px_var(--color-neon-yellow),0_0_30px_var(--color-neon-yellow),0_0_50px_rgba(255,204,0,0.4)]',
  },
  external: {
    icon: '📚',
    className: 'external-node bg-neon-gray/10 border-2 border-neon-gray opacity-70 hover:opacity-100 hover:border-white/40',
  },
};

/**
 * Base node component that provides common structure for all node types
 * Handles positioning, handles (connection points), and responsive styling
 */
export const BaseNode = memo(function BaseNode({ data }: { data: NodeData }) {
  const { className, icon } = appearance[data.nodeType];
  return (
    <div className={`graph-node rounded-xl transition-transform duration-300 hover:scale-[1.02] ${className}`}>
      <Handle type="target" position={Position.Top} className="handle-top" />
      <div className="text-left min-w-0">
        <div className="node-kind"><span aria-hidden="true">{icon}</span>{data.nodeType}</div>
        <div className="node-label" title={data.label}>{data.label}</div>
        <div className="node-file" title={data.file}>{data.file}</div>
      </div>
      <Handle type="source" position={Position.Bottom} className="handle-bottom" />
    </div>
  );
});
