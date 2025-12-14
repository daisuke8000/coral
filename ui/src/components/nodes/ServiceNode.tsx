import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeData } from '@/types/graph';

interface ServiceNodeProps {
  data: NodeData;
}

export const ServiceNode = memo(function ServiceNode({ data }: ServiceNodeProps) {
  return (
    <div className="service-node bg-neon-magenta/10 border-2 border-neon-magenta rounded-xl p-3 sm:p-4 min-w-[140px] sm:min-w-[180px] shadow-[0_0_10px_var(--color-neon-magenta),0_0_20px_var(--color-neon-magenta),0_0_40px_rgba(255,0,255,0.3)] animate-pulse-magenta transition-all duration-300 hover:shadow-[0_0_15px_var(--color-neon-magenta),0_0_30px_var(--color-neon-magenta),0_0_60px_rgba(255,0,255,0.5)] hover:scale-[1.02]">
      <Handle type="target" position={Position.Top} className="handle-top" />
      <div className="text-center">
        <div className="text-xl sm:text-2xl mb-1 sm:mb-2">⚡</div>
        <div className="font-semibold text-sm sm:text-base mb-1 break-words">{data.label}</div>
        <div className="text-[0.65rem] sm:text-xs text-text-secondary break-all max-sm:hidden">{data.file}</div>
      </div>
      <Handle type="source" position={Position.Bottom} className="handle-bottom" />
    </div>
  );
});
