import { memo } from 'react';
import type { NodeData } from '@/types/graph';
import { BaseNode } from './BaseNode';

interface ServiceNodeProps {
  data: NodeData;
}

export const ServiceNode = memo(function ServiceNode({ data }: ServiceNodeProps) {
  return (
    <BaseNode
      data={data}
      icon="⚡"
      className="service-node bg-neon-magenta/10 border-2 border-neon-magenta shadow-[0_0_10px_var(--color-neon-magenta),0_0_20px_var(--color-neon-magenta),0_0_40px_rgba(255,0,255,0.3)] animate-pulse-magenta hover:shadow-[0_0_15px_var(--color-neon-magenta),0_0_30px_var(--color-neon-magenta),0_0_60px_rgba(255,0,255,0.5)]"
    />
  );
});
