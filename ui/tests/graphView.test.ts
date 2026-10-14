import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyLayoutPositions, calculateLayout, filterPackages, getExpandedPackageIds, getVisiblePackageIds } from '../src/lib/graphView.ts';
import type { GraphData } from '../src/types/graph.ts';

const graph: GraphData = {
  nodes: [
    { id: 'Default', label: 'Default', package: '', file: 'default.proto', type: 'message', details: { kind: 'Message', fields: [] } },
    { id: 'api.Other', label: 'Other', package: 'api', file: 'api.proto', type: 'message', details: { kind: 'Message', fields: [] } },
  ],
  edges: [{ source: 'Default', target: 'api.Other' }, { source: 'Default', target: 'missing.Type' }],
  packages: [{ id: '', nodeIds: ['Default'] }, { id: 'api', nodeIds: ['api.Other'] }],
};

const togglePackage = () => {};

function view(visiblePackages: Set<string>, expandedPackages = new Set<string>(), data = graph) {
  return calculateLayout(data, {
    visiblePackages, expandedPackages, togglePackage,
    nodeToPackageMap: new Map(data.nodes.map((node) => [node.id, node.package])),
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

test('mixed expansion routes through collapsed neighbors and keeps definition data', () => {
  const result = view(new Set(['', 'api']), new Set(['']));
  assert.ok(result.edges.some((edge) => edge.source === 'Default' && edge.target === 'pkg-api'));
  assert.deepEqual(result.nodes.find((node) => node.id === 'Default')?.data.details, graph.nodes[0].details);
  assert.ok(result.nodes.find((node) => node.id === 'pkg-api')?.selectable === false);
});

test('every visibility/expansion combination has only rendered endpoints and ordered parents', () => {
  for (let visible = 0; visible < 4; visible++) {
    for (let expanded = 0; expanded < 4; expanded++) {
      const ids = ['', 'api'];
      const result = view(new Set(ids.filter((_, i) => visible & (1 << i))), new Set(ids.filter((_, i) => expanded & (1 << i))));
      const indices = new Map(result.nodes.map((node, i) => [node.id, i]));
      assert.ok(result.edges.every((edge) => indices.has(edge.source) && indices.has(edge.target)));
      assert.ok(result.nodes.every((node, i) => !node.parentId || (indices.get(node.parentId) ?? Infinity) < i));
    }
  }
});

test('deduplicated collapsed routes retain all definition IDs and direction', () => {
  const data: GraphData = {
    ...graph,
    nodes: [...graph.nodes, { ...graph.nodes[0], id: 'Second' }],
    edges: [
      { source: 'Default', target: 'api.Other' },
      { source: 'Second', target: 'api.Other' },
      { source: 'Default', target: 'api.Other' },
      { source: 'api.Other', target: 'Default' },
      { source: 'Default', target: 'Second' },
    ],
  };
  const result = view(new Set(['', 'api']), new Set(), data);
  assert.equal(result.edges.length, 2);
  assert.deepEqual(result.edges[0].data?.definitionIds, new Set(['Default', 'Second', 'api.Other']));
  assert.equal(result.edges[1].source, 'pkg-api');
  const repeated = view(new Set(['', 'api']), new Set(), { ...data, edges: [...data.edges].reverse() });
  assert.deepEqual(new Set(result.edges.map((edge) => edge.id)), new Set(repeated.edges.map((edge) => edge.id)));
});

test('collapse/re-expand is deterministic, preserves data, and does not mutate the graph', () => {
  const original = structuredClone(graph);
  const first = view(new Set(['', 'api']), new Set(['', 'api']));
  view(new Set(['', 'api']));
  const second = view(new Set(['', 'api']), new Set(['', 'api']));
  assert.deepEqual(first, second);
  assert.deepEqual(graph, original);
  assert.ok(first.nodes.find((node) => node.id === 'Default')!.position.y > 64);
});

test('absolute layout positions are converted to the same parent-relative system', () => {
  const { nodes } = view(new Set(['', 'api']), new Set(['', 'api']));
  const original = structuredClone(nodes.map(({ id, position, parentId }) => ({ id, position, parentId })));
  const positions = new Map([
    ['pkg-', { x: 300, y: 20 }], ['Default', { x: 280, y: 200 }],
    ['pkg-api', { x: 600, y: 20 }], ['api.Other', { x: 640, y: 400 }],
  ]);
  const layouted = applyLayoutPositions(nodes, positions);
  const child = layouted.find((node) => node.id === 'Default')!;
  assert.equal(child.parentId, 'pkg-');
  assert.deepEqual(child.position, { x: -20, y: 180 });
  assert.deepEqual(layouted.find((node) => node.id === 'pkg-')?.position, { x: 300, y: 20 });
  assert.deepEqual(applyLayoutPositions(layouted, positions), layouted);
  assert.deepEqual(nodes.map(({ id, position, parentId }) => ({ id, position, parentId })), original);
});

test('package state follows fetched IDs while preserving visibility and expansion choices', () => {
  const packages = [graph.packages[0], { id: 'new', nodeIds: [] }];
  assert.deepEqual(getVisiblePackageIds(packages, new Set(['api'])), new Set(['', 'new']));
  assert.deepEqual(getVisiblePackageIds(packages, new Set([''])), new Set(['new']));
  assert.deepEqual(getExpandedPackageIds(packages, new Set(['', 'api'])), new Set(['']));
  assert.deepEqual(getExpandedPackageIds(packages, new Set()), new Set());
});

test('package search is trimmed, case-insensitive, and matches labels and default package', () => {
  const packages = [...graph.packages, { id: 'grpc.v1', label: 'Public API', nodeIds: [] }];
  assert.deepEqual(filterPackages(packages, '  DEFAULT '), [packages[0]]);
  assert.deepEqual(filterPackages(packages, 'public'), [packages[2]]);
  assert.deepEqual(filterPackages(packages, 'Grpc'), [packages[2]]);
  assert.deepEqual(filterPackages(packages, '   '), packages);
  assert.deepEqual(filterPackages(packages, 'missing'), []);
});
