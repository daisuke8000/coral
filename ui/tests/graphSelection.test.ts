import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSelectionIndex, styleGraphEdge } from '../src/lib/graphSelection.ts';
import { calculateLayout } from '../src/lib/graphView.ts';
import type { GraphData } from '../src/types/graph.ts';

const graph: GraphData = {
  nodes: ['api.A', 'api.B', 'lib.C', 'lib.D'].map((id) => ({
    id, label: id, package: id.split('.')[0], file: 'test.proto', type: 'message',
    details: { kind: 'Message', fields: [] },
  })),
  edges: [
    { source: 'api.A', target: 'lib.C' },
    { source: 'api.B', target: 'lib.D' },
    { source: 'api.A', target: 'missing' },
  ],
  packages: [{ id: 'api', nodeIds: ['api.A', 'api.B'] }, { id: 'lib', nodeIds: ['lib.C', 'lib.D'] }],
};

function view(expandedPackages: Set<string>) {
  return calculateLayout(graph, {
    expandedPackages, visiblePackages: new Set(['api', 'lib']), togglePackage: () => {},
    nodeToPackageMap: new Map(graph.nodes.map((node) => [node.id, node.package])),
  });
}

test('selection index is bidirectional, isolates unrelated nodes, and excludes dangling references', () => {
  const { nodes, neighbors } = buildSelectionIndex(graph);
  assert.equal(nodes.size, 4);
  assert.deepEqual(neighbors.get('api.A'), new Set(['lib.C']));
  assert.deepEqual(neighbors.get('lib.C'), new Set(['api.A']));
  assert.ok(!neighbors.has('missing'));
  assert.deepEqual(buildSelectionIndex(null), { nodes: new Map(), neighbors: new Map() });
});

test('default motion animates dependencies, not membership links', () => {
  const result = view(new Set(['api', 'lib']));
  for (const edge of result.edges) {
    const styled = styleGraphEdge(edge, null, null, true);
    assert.equal(styled.animated, edge.data?.kind === 'dependency');
    assert.equal(styled.style?.strokeWidth, edge.data?.kind === 'membership' ? 1 : 2);
  }
});

test('collapsed aggregated routes highlight either original endpoint, not every package neighbor', () => {
  const result = view(new Set());
  assert.equal(result.edges.length, 1);
  const edge = result.edges[0];
  for (const id of ['api.A', 'api.B', 'lib.C', 'lib.D']) {
    const styled = styleGraphEdge(edge, id, new Set([id]), true);
    assert.equal(styled.animated, true);
    assert.equal(styled.style?.strokeWidth, 3);
  }
  assert.equal(styleGraphEdge(edge, 'unrelated', new Set(['unrelated']), true).animated, false);
});

test('partial expansion highlights exact dependency routes and neighbor membership', () => {
  const result = view(new Set(['api']));
  const highlighted = new Set(['lib.C', 'api.A']);
  const dependency = result.edges.find((edge) => edge.source === 'api.A')!;
  const unrelated = result.edges.find((edge) => edge.source === 'api.B')!;
  const member = result.edges.find((edge) => edge.target === 'api.A' && edge.data?.kind === 'membership')!;
  assert.equal(styleGraphEdge(dependency, 'lib.C', highlighted, true).animated, true);
  assert.equal(styleGraphEdge(unrelated, 'lib.C', highlighted, true).style?.strokeOpacity, 0.1);
  const styledMember = styleGraphEdge(member, 'lib.C', highlighted, true);
  assert.equal(styledMember.animated, false);
  assert.equal(styledMember.style?.strokeOpacity, 0.4);
  assert.equal(styledMember.style?.strokeDasharray, '4 2');
});

test('explicit quiet mode stops flow without losing selection emphasis or mutating edges', () => {
  const edge = view(new Set()).edges[0];
  const original = structuredClone(edge);
  const styled = styleGraphEdge(edge, 'api.A', new Set(['api.A', 'lib.C']), false);
  assert.equal(styled.animated, false);
  assert.equal(styled.style?.strokeWidth, 3);
  assert.equal(styled.style?.strokeOpacity, 1);
  assert.deepEqual(edge, original);
});
