import { memo } from 'react';
import type { NodeData } from '@/types/graph';
import { BaseNode } from './BaseNode';

interface MessageNodeProps {
  data: NodeData;
}

export const MessageNode = memo(function MessageNode({ data }: MessageNodeProps) {
  return (
    <BaseNode
      data={data}
      icon="📦"
      className="message-node bg-neon-cyan/10 border-2 border-neon-cyan shadow-[0_0_10px_var(--color-neon-cyan),0_0_20px_rgba(0,255,255,0.4)] animate-pulse-cyan hover:shadow-[0_0_15px_var(--color-neon-cyan),0_0_30px_var(--color-neon-cyan),0_0_50px_rgba(0,255,255,0.4)]"
    />
  );
});
