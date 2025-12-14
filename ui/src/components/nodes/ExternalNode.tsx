import { memo } from 'react';
import type { NodeData } from '@/types/graph';
import { BaseNode } from './BaseNode';

interface ExternalNodeProps {
  data: NodeData;
}

export const ExternalNode = memo(function ExternalNode({ data }: ExternalNodeProps) {
  return (
    <BaseNode
      data={data}
      icon="📚"
      className="external-node bg-neon-gray/10 border-2 border-neon-gray opacity-70 hover:opacity-100 hover:border-white/40"
    />
  );
});
