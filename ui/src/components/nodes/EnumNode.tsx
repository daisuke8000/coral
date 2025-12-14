import { Handle, Position } from '@xyflow/react';
import type { NodeData } from '@/types/graph';

interface EnumNodeProps {
  data: NodeData;
}

export function EnumNode({ data }: EnumNodeProps) {
  return (
    <div className="enum-node">
      <Handle type="target" position={Position.Top} className="handle-top" />
      <div className="node-content">
        <div className="node-icon">📋</div>
        <div className="node-label">{data.label}</div>
        <div className="node-file">{data.file}</div>
      </div>
      <Handle type="source" position={Position.Bottom} className="handle-bottom" />
    </div>
  );
}
