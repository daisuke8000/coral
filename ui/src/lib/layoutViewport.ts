import type { Node, ReactFlowInstance } from '@xyflow/react';

type LayoutViewport = Pick<ReactFlowInstance, 'getNodes' | 'fitView' | 'getViewport' | 'setViewport'>;

export interface LayoutFit {
  cancel: () => void;
  finishWithoutMotion: () => void;
}

/** Wait for React Flow to adopt and measure the committed layout, not a CSS timer. */
export function scheduleLayoutFit(
  getFlow: () => LayoutViewport | null,
  nodes: Node[],
  getDuration: () => number,
  requestFrame = requestAnimationFrame,
  cancelFrame = cancelAnimationFrame,
): LayoutFit {
  if (nodes.length === 0) return { cancel: () => {}, finishWithoutMotion: () => {} };

  let frame = 0;
  let cancelled = false;
  let fittingFlow: LayoutViewport | null = null;
  const fit = (flow: LayoutViewport, duration: number) => {
    fittingFlow = flow;
    void flow.fitView({ nodes, padding: 0.2, minZoom: 0.01, maxZoom: 1, duration }).then(
      () => { fittingFlow = null; },
      () => { fittingFlow = null; },
    );
  };
  const fitWhenReady = () => {
    if (cancelled) return;
    const flow = getFlow();
    const rendered = new Map(flow?.getNodes().map((node) => [node.id, node]));
    const ready = rendered.size === nodes.length && nodes.every((node) => {
      const current = rendered.get(node.id);
      return !!current && current.position.x === node.position.x && current.position.y === node.position.y &&
        current.parentId === node.parentId && !!current.measured?.width && !!current.measured?.height;
    });
    if (!flow || !ready) {
      frame = requestFrame(fitWhenReady);
      return;
    }
    fit(flow, getDuration());
  };
  frame = requestFrame(fitWhenReady);

  return {
    cancel() {
      cancelled = true;
      cancelFrame(frame);
      // A newer layout or a user drag must also interrupt an already-started camera move.
      if (fittingFlow) {
        void fittingFlow.setViewport(fittingFlow.getViewport(), { duration: 0 }).catch(() => {});
        fittingFlow = null;
      }
    },
    finishWithoutMotion() {
      if (!cancelled && fittingFlow) fit(fittingFlow, 0);
    },
  };
}
