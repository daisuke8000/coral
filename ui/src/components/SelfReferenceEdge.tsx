import { BaseEdge, type EdgeProps } from '@xyflow/react';

/** Opposite handles on one card need an outside loop, not a line through the card. */
export function SelfReferenceEdge({ sourceX, sourceY, targetX, targetY, ...props }: EdgeProps) {
  const right = Math.max(sourceX, targetX) + 180;
  const middle = (sourceY + targetY) / 2;
  const path = `M ${sourceX},${sourceY} C ${sourceX},${sourceY + 60} ${right},${sourceY + 60} ${right},${middle} C ${right},${targetY - 60} ${targetX},${targetY - 60} ${targetX},${targetY}`;
  return <BaseEdge id={props.id} path={path} style={props.style} markerStart={props.markerStart} markerEnd={props.markerEnd} interactionWidth={props.interactionWidth} />;
}
