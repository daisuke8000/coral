import { Handle, Position } from '@xyflow/react';
import type { NodeData } from '@/types/graph';

interface ExternalNodeProps {
  data: NodeData;
}

export function ExternalNode({ data }: ExternalNodeProps) {
  return (
    <div className="external-node">
      <Handle type="target" position={Position.Top} className="handle-top" />
      <div className="node-content">
        <div className="node-icon">📚</div>
        <div className="node-label">{data.label}</div>
        <div className="node-file">{data.file}</div>
      </div>
      <Handle type="source" position={Position.Bottom} className="handle-bottom" />
    </div>
  );
}
