import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeData } from '@/types/graph';

interface ExternalNodeProps {
  data: NodeData;
}

export const ExternalNode = memo(function ExternalNode({ data }: ExternalNodeProps) {
  return (
    <div className="external-node bg-neon-gray/10 border-2 border-neon-gray rounded-xl p-3 sm:p-4 min-w-[140px] sm:min-w-[180px] opacity-70 transition-all duration-300 hover:opacity-100 hover:border-white/40">
      <Handle type="target" position={Position.Top} className="handle-top" />
      <div className="text-center">
        <div className="text-xl sm:text-2xl mb-1 sm:mb-2">📚</div>
        <div className="font-semibold text-sm sm:text-base mb-1 break-words">{data.label}</div>
        <div className="text-[0.65rem] sm:text-xs text-text-secondary break-all max-sm:hidden">{data.file}</div>
      </div>
      <Handle type="source" position={Position.Bottom} className="handle-bottom" />
    </div>
  );
});
