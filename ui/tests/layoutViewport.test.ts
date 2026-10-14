import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { FitViewOptions, Node, ReactFlowInstance, Viewport } from '@xyflow/react';
import { scheduleLayoutFit } from '../src/lib/layoutViewport.ts';

type LayoutViewport = Pick<ReactFlowInstance, 'getNodes' | 'fitView' | 'getViewport' | 'setViewport'>;
const target: Node[] = [
  { id: 'pkg-api', position: { x: 300, y: 20 }, data: {} },
  { id: 'api.Service', parentId: 'pkg-api', position: { x: 0, y: 120 }, data: {} },
];
const measured = () => target.map((node) => ({ ...node, measured: { width: 220, height: 132 } }));

function harness() {
  let rendered: Node[] = [];
  let initialized = true;
  let duration = 500;
  let nextFrame = 0;
  const frames = new Map<number, FrameRequestCallback>();
  const fits: FitViewOptions[] = [];
  const stopped: { viewport: Viewport; duration?: number }[] = [];
  let finishFit: (fitted: boolean) => void = () => {};
  const viewport = { x: 10, y: 20, zoom: 0.5 };
  const flow: LayoutViewport = {
    getNodes: () => rendered,
    fitView: (options) => {
      fits.push(options ?? {});
      return new Promise((resolve) => { finishFit = resolve; });
    },
    getViewport: () => viewport,
    setViewport: async (position, options) => {
      stopped.push({ viewport: position, duration: options?.duration });
      return true;
    },
  };
  return {
    fits, stopped, frames,
    render(nodes: Node[]) { rendered = nodes; },
    initialize(value: boolean) { initialized = value; },
    motion(milliseconds: number) { duration = milliseconds; },
    finish() { finishFit(true); },
    start(nodes = target) {
      return scheduleLayoutFit(
        () => initialized ? flow : null, nodes, () => duration,
        (callback) => { frames.set(++nextFrame, callback); return nextFrame; },
        (id) => { frames.delete(id); },
      );
    },
    flush() {
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach((callback) => callback(0));
    },
  };
}

test('framing waits for initialization, committed positions/parents, and all measurements', () => {
  const state = harness();
  state.initialize(false);
  const { cancel } = state.start();
  state.flush();
  assert.equal(state.fits.length, 0);
  state.initialize(true);
  state.render(target);
  state.flush();
  assert.equal(state.fits.length, 0);
  state.render(measured().map((node) => ({ ...node, position: { x: 0, y: 0 } })));
  state.flush();
  assert.equal(state.fits.length, 0);
  state.render(measured().map((node) => ({ ...node, parentId: undefined })));
  state.flush();
  assert.equal(state.fits.length, 0);
  state.render(measured());
  state.flush();
  assert.deepEqual(state.fits, [{ nodes: target, padding: 0.2, minZoom: 0.01, maxZoom: 1, duration: 500 }]);
  state.flush();
  assert.equal(state.fits.length, 1);
  cancel();
});

test('cancelling a pending fit prevents a stale layout from moving the viewport', () => {
  const state = harness();
  const { cancel } = state.start();
  state.flush();
  const staleCallback = [...state.frames.values()][0];
  cancel();
  state.render(measured());
  staleCallback(0);
  state.flush();
  assert.equal(state.fits.length, 0);
  assert.equal(state.frames.size, 0);
});

test('duration is read when framing starts, so Motion off/reduced motion can snap immediately', () => {
  const state = harness();
  const { cancel } = state.start();
  state.flush();
  state.motion(0);
  state.render(measured());
  state.flush();
  assert.equal(state.fits[0].duration, 0);
  cancel();
});

test('cancelling an in-flight fit freezes the current viewport; completed fits are not interrupted', async () => {
  const active = harness();
  active.render(measured());
  const { cancel: cancelActive } = active.start();
  active.flush();
  cancelActive();
  assert.deepEqual(active.stopped, [{ viewport: { x: 10, y: 20, zoom: 0.5 }, duration: 0 }]);

  const complete = harness();
  complete.render(measured());
  const { cancel: cancelComplete } = complete.start();
  complete.flush();
  complete.finish();
  await Promise.resolve();
  cancelComplete();
  assert.deepEqual(complete.stopped, []);
});

test('Motion off/reduced motion finishes an active fit immediately without starting a later one', () => {
  const state = harness();
  state.render(measured());
  const fit = state.start();
  state.flush();
  assert.equal(state.fits[0].duration, 500);
  fit.finishWithoutMotion();
  assert.equal(state.fits[1].duration, 0);
  fit.cancel();
  fit.finishWithoutMotion();
  state.flush();
  assert.equal(state.fits.length, 2);
});

test('empty graphs do not schedule frames or change the viewport', () => {
  const state = harness();
  const { cancel } = state.start([]);
  state.flush();
  cancel();
  assert.equal(state.frames.size, 0);
  assert.equal(state.fits.length, 0);
  assert.equal(state.stopped.length, 0);
});
