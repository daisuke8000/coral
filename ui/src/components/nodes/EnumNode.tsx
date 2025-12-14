import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeData } from '@/types/graph';

interface EnumNodeProps {
  data: NodeData;
}

export const EnumNode = memo(function EnumNode({ data }: EnumNodeProps) {
  return (
    <div className="enum-node bg-neon-yellow/10 border-2 border-neon-yellow rounded-xl p-3 sm:p-4 min-w-[140px] sm:min-w-[180px] shadow-[0_0_10px_var(--color-neon-yellow),0_0_20px_rgba(255,204,0,0.4)] animate-pulse-yellow transition-all duration-300 hover:shadow-[0_0_15px_var(--color-neon-yellow),0_0_30px_var(--color-neon-yellow),0_0_50px_rgba(255,204,0,0.4)] hover:scale-[1.02]">
      <Handle type="target" position={Position.Top} className="handle-top" />
      <div className="text-center">
        <div className="text-xl sm:text-2xl mb-1 sm:mb-2">📋</div>
        <div className="font-semibold text-sm sm:text-base mb-1 break-words">{data.label}</div>
        <div className="text-[0.65rem] sm:text-xs text-text-secondary break-all max-sm:hidden">{data.file}</div>
      </div>
      <Handle type="source" position={Position.Bottom} className="handle-bottom" />
    </div>
  );
});
