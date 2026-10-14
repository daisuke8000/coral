import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';
import { setImmediate } from 'node:timers';
import { runInNewContext } from 'node:vm';
import type { Node } from '@xyflow/react';
import { calculateLayout, reconcileNodes, type GraphViewEdge } from '../src/lib/graphView.ts';
import type { GraphData } from '../src/types/graph.ts';

// Execute the actual effect/cancellation callbacks, not a second implementation.
// React mounting and throttled chunk loading remain host browser checks.
const source = readFileSync(new URL('../src/components/Graph.tsx', import.meta.url), 'utf8');
const effect = source.match(/useEffect\(\(\) => \{(\n {4}const controller = new AbortController\(\);[\s\S]*?)\n {2}\}, \[data, initialNodes/)!;
const drag = source.match(/const handleNodeDragStart = useCallback\(\(\) => \{([\s\S]*?)\n {2}\},/)!;
assert.ok(effect && drag, 'layout callbacks must remain exercised by this regression');

const graph: GraphData = {
  nodes: ['p.M', 'q.N'].map((id) => ({
    id, label: id, package: id[0], file: 'test.proto', type: 'message',
    details: { kind: 'Message', fields: [] },
  })),
  edges: [{ source: 'p.M', target: 'q.N' }],
  packages: [{ id: 'p', nodeIds: ['p.M'] }, { id: 'q', nodeIds: ['q.N'] }],
};
const view = (visible: string[], expanded: string[]) => calculateLayout(graph, {
  visiblePackages: new Set(visible), expandedPackages: new Set(expanded), togglePackage: () => {},
  nodeToPackageMap: new Map(graph.nodes.map((node) => [node.id, node.package])),
});

function harness(initial: ReturnType<typeof view>) {
  let nodes = initial.nodes;
  let edges = initial.edges;
  let frames = 0;
  const pending: (() => void)[] = [];
  const fitRef: { current: { cancel: () => void } | null } = { current: null };
  const context = {
    AbortController, reconcileNodes, data: graph, layoutMode: 'auto',
    layoutControllerRef: { current: null }, fitRequestedFor: { current: graph }, fitRef,
    flowRef: { current: null }, fitDurationRef: { current: 500 },
    setNodes(next: Node[] | ((current: Node[]) => Node[])) {
      nodes = typeof next === 'function' ? next(nodes) : next;
    },
    setEdges(next: GraphViewEdge[]) { edges = next; },
    setLayoutError() { assert.fail('cancelled work must not report an error'); },
    cancelPendingFit() { fitRef.current?.cancel(); fitRef.current = null; },
    scheduleLayoutFit() { frames++; return { cancel() {} }; },
    getLayoutedNodes(next: Node[], _edges: GraphViewEdge[], _direction: string, signal: AbortSignal) {
      return new Promise<Node[]>((resolve, reject) => pending.push(() => {
        if (signal.aborted) reject(signal.reason);
        else resolve(next);
      }));
    },
  };
  return {
    get nodes() { return nodes; },
    get edges() { return edges; },
    start(next: ReturnType<typeof view>) {
      return runInNewContext(stripTypeScriptTypes(`(() => {${effect[1]}\n})()`), {
        ...context, initialNodes: next.nodes, initialEdges: next.edges,
      }) as () => void;
    },
    drag() {
      runInNewContext(drag[1], context);
      nodes = nodes.map((node) => node.id === 'pkg-p'
        ? { ...node, position: { x: 777, y: 88 } } : node);
    },
    async resolve() {
      pending.forEach((finish) => finish());
      await new Promise((resolve) => setImmediate(resolve));
      assert.equal(frames, 0, 'drag must cancel pending camera work');
      assert.deepEqual(nodes.find((node) => node.id === 'pkg-p')?.position, { x: 777, y: 88 });
    },
  };
}

test('expand during lazy loading then drag commits topology without late layout or camera overwrite', async () => {
  const state = harness(view(['p', 'q'], []));
  const obsolete = state.start(view(['p', 'q'], []));
  obsolete();
  const expanded = view(['p', 'q'], ['p', 'q']);
  const cleanup = state.start(expanded);
  state.drag();
  await state.resolve();
  assert.deepEqual(state.nodes.map((node) => node.id), expanded.nodes.map((node) => node.id));
  assert.deepEqual(state.edges, expanded.edges);
  assert.equal(state.nodes.find((node) => node.id === 'pkg-p')?.data.isExpanded, true);
  cleanup();
});

test('filter during lazy loading then drag removes hidden topology and retains surviving positions', async () => {
  const state = harness(view(['p', 'q'], ['p', 'q']));
  state.drag();
  const filtered = view(['p'], ['p', 'q']);
  const cleanup = state.start(filtered);
  assert.deepEqual(state.nodes[0].position, { x: 777, y: 88 });
  state.drag();
  await state.resolve();
  assert.deepEqual(state.nodes.map((node) => node.id), ['pkg-p', 'p.M']);
  assert.deepEqual(state.edges, filtered.edges);
  cleanup();
});
