import { memo } from 'react';
import type { NodeData } from '@/types/graph';
import { BaseNode } from './BaseNode';

interface EnumNodeProps {
  data: NodeData;
}

export const EnumNode = memo(function EnumNode({ data }: EnumNodeProps) {
  return (
    <BaseNode
      data={data}
      icon="📋"
      className="enum-node bg-neon-yellow/10 border-2 border-neon-yellow shadow-[0_0_10px_var(--color-neon-yellow),0_0_20px_rgba(255,204,0,0.4)] animate-pulse-yellow hover:shadow-[0_0_15px_var(--color-neon-yellow),0_0_30px_var(--color-neon-yellow),0_0_50px_rgba(255,204,0,0.4)]"
    />
  );
});
