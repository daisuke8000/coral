import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateLayout } from '../src/lib/graphView.ts';
import type { GraphData } from '../src/types/graph.ts';

const graph: GraphData = {
  nodes: [
    { id: 'Default', label: 'Default', package: '', file: 'default.proto', type: 'message', details: { kind: 'Message', fields: [] } },
    { id: 'api.Other', label: 'Other', package: 'api', file: 'api.proto', type: 'message', details: { kind: 'Message', fields: [] } },
  ],
  edges: [{ source: 'Default', target: 'api.Other' }, { source: 'Default', target: 'missing.Type' }],
  packages: [{ id: '', nodeIds: ['Default'] }, { id: 'api', nodeIds: ['api.Other'] }],
};

function view(visiblePackages: Set<string>, expandedPackages = new Set<string>()) {
  return calculateLayout(graph, {
    visiblePackages, expandedPackages, togglePackage: () => {},
    nodeToPackageMap: new Map(graph.nodes.map((node) => [node.id, node.package])),
  });
}

test('collapsed default package routes through the package and excludes dangling edges', () => {
  const result = view(new Set(['', 'api']));
  assert.deepEqual(result.edges.map(({ source, target }) => [source, target]), [['pkg-', 'pkg-api']]);
  const ids = new Set(result.nodes.map((node) => node.id));
  assert.ok(result.edges.every((edge) => ids.has(edge.source) && ids.has(edge.target)));
});

test('hiding the default package removes every incident edge', () => {
  const result = view(new Set(['api']), new Set(['', 'api']));
  assert.ok(result.nodes.every((node) => node.id !== 'Default' && node.id !== 'pkg-'));
  assert.ok(result.edges.every((edge) => edge.source !== 'Default' && edge.target !== 'Default'));
});

test('expanded packages preserve definition endpoints', () => {
  const result = view(new Set(['', 'api']), new Set(['', 'api']));
  assert.ok(result.edges.some((edge) => edge.source === 'Default' && edge.target === 'api.Other'));
  assert.equal(result.nodes.find((node) => node.id === 'Default')?.parentId, 'pkg-');
});
