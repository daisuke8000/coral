import { test as base, expect, type Page } from '@playwright/test';
import type { GraphData } from '../../src/types/graph';

// A failed RAF callback must fail the test, not leave partial passing counters.
const test = base.extend({
  page: async ({ page }, runTest) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await runTest(page);
    expect(errors, 'browser pageerror (including the geometry probe)').toEqual([]);
  },
});

const graph: GraphData = {
  nodes: ['p.A', 'p.B', 'q.C', 'r.D'].map((id) => ({
    id, label: id, package: id[0], file: `${id[0]}.proto`, type: 'message',
    details: { kind: 'Message', fields: [] },
  })),
  edges: [
    { source: 'p.A', target: 'q.C' }, { source: 'p.B', target: 'r.D' },
    { source: 'q.C', target: 'r.D' }, { source: 'p.A', target: 'p.A' },
  ],
  packages: ['p', 'q', 'r'].map((id) => ({ id, nodeIds: id === 'p' ? ['p.A', 'p.B'] : [id === 'q' ? 'q.C' : 'r.D'] })),
};

// Sample every animation frame throughout graph actions.
// Compare in screen coordinates (including the live camera transform), not node data.
async function installProbe(page: Page) {
  await page.evaluate(() => {
    const probe = { frames: 0, endpoints: 0, maxError: 0, maxCenterError: 0, worst: '', running: true };
    Object.assign(window, { edgeProbe: probe });
    function sample() {
      if (!probe.running) return;
      probe.frames++;
      for (const edge of document.querySelectorAll('.react-flow__edge')) {
        const path = edge.querySelector<SVGPathElement>('.react-flow__edge-path');
        const matrix = path?.getScreenCTM();
        if (!path || !matrix) continue;
        const label = edge.getAttribute('aria-label') ?? '';
        // React Flow exposes original endpoint IDs in the accessible edge label.
        const match = /^Edge from (.+) to (.+)$/.exec(label);
        if (!match) throw new Error(`Unrecognized edge label: ${label}`);
        const length = path.getTotalLength();
        for (const [index, id] of [match[1], match[2]].entries()) {
          const node = document.querySelector(`.react-flow__node[data-id="${CSS.escape(id)}"]`);
          const handle = node?.querySelector(index === 0 ? '.source' : '.target');
          if (!handle) throw new Error(`Missing rendered handle: ${label}`);
          const rect = handle.getBoundingClientRect();
          const point = path.getPointAtLength(index === 0 ? 0 : length);
          const screen = new DOMPoint(point.x, point.y).matrixTransform(matrix);
          const x = rect.x + rect.width / 2;
          const centerY = rect.y + rect.height / 2;
          // xyflow attaches to the OUTER edge of Top/Bottom handles, not the center.
          const y = index === 0 ? rect.bottom : rect.top;
          const error = Math.hypot(screen.x - x, screen.y - y);
          probe.maxCenterError = Math.max(probe.maxCenterError, Math.hypot(screen.x - x, screen.y - centerY));
          probe.endpoints++;
          if (error > probe.maxError) { probe.maxError = error; probe.worst = `${label} endpoint ${index}`; }
        }
      }
      requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  });
}

async function checkProbe(page: Page, label: string) {
  const result = await page.evaluate(() => {
    const probe = (window as unknown as { edgeProbe: { frames: number; endpoints: number; maxError: number; maxCenterError: number; worst: string } }).edgeProbe;
    const result = { ...probe };
    probe.frames = probe.endpoints = probe.maxError = probe.maxCenterError = 0;
    probe.worst = '';
    return result;
  });
  console.log(label, result);
  expect(result.frames, label).toBeGreaterThan(2);
  expect(result.endpoints, label).toBeGreaterThan(0);
  // Subpixel SVG/DOM rounding is acceptable; a whole CSS pixel is not.
  expect(result.maxError, `${label}: ${result.worst}`).toBeLessThan(0.75);
}

async function load(page: Page) {
  await page.route('**/api/graph', (route) => route.fulfill({ json: graph }));
  await page.route('**/graph.json', (route) => route.fulfill({ json: graph }));
  await page.goto('/');
  await expect(page.locator('.react-flow__node')).toHaveCount(3);
  await expect(page.locator('.react-flow__edge-path').first()).toBeVisible();
  await installProbe(page);
}

for (const mode of ['motion', 'off', 'reduced'] as const) {
  test(`edge attachment during topology, layout, hover, drag and rapid operations (${mode})`, async ({ page }) => {
    if (mode === 'reduced') await page.emulateMedia({ reducedMotion: 'reduce' });
    await load(page);
    if (mode === 'off') await page.getByRole('button', { name: 'Motion on', exact: true }).click();
    await page.getByRole('button', { name: 'Expand all packages', exact: true }).click();
    await expect(page.locator('.react-flow__node')).toHaveCount(7);
    await page.waitForTimeout(650);
    await checkProbe(page, `${mode}: expand`);

    for (const name of ['Switch to hierarchical layout', 'Switch to flat layout']) {
      await page.getByRole('button', { name, exact: true }).click();
      await page.waitForTimeout(700);
      await checkProbe(page, `${mode}: ${name}`);
    }
    const node = page.locator('.react-flow__node[data-id="p.A"]');
    await node.hover();
    await page.waitForTimeout(350);
    await checkProbe(page, `${mode}: hover`);
    const box = await node.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2 + 80, box!.y + box!.height / 2 + 50, { steps: 20 });
    await page.mouse.up();
    await page.waitForTimeout(150);
    await checkProbe(page, `${mode}: drag`);
    await page.getByRole('button', { name: 'Collapse package p', exact: true }).click();
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: 'Expand package p', exact: true }).click();
    await page.waitForTimeout(600);
    await checkProbe(page, `${mode}: package toggle`);

    // Dispatch real clicks a frame apart; don't let locator actionability wait out motion.
    for (let i = 0; i < 8; i++) {
      await page.getByRole('button', { name: i % 2 ? 'Expand all packages' : 'Collapse all packages', exact: true }).evaluate((button: HTMLButtonElement) => button.click());
      await page.getByRole('button', { name: /Switch to (hierarchical|flat) layout/ }).evaluate((button: HTMLButtonElement) => button.click());
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    }
    await page.waitForTimeout(750);
    await expect(page.locator('.react-flow__node')).toHaveCount(7);
    await checkProbe(page, `${mode}: rapid expand/collapse/layout`);

    await page.getByRole('button', { name: 'Filter packages', exact: true }).click();
    const visibility = page.getByRole('checkbox', { name: 'Toggle visibility for package q', exact: true });
    const packageLabel = page.locator('label').filter({ has: visibility });
    await packageLabel.click();
    await expect(visibility).not.toBeChecked();
    await expect(page.locator('.react-flow__node')).toHaveCount(5);
    await packageLabel.click();
    await expect(visibility).toBeChecked();
    await page.waitForTimeout(600);
    await checkProbe(page, `${mode}: filtering`);
    await page.getByRole('button', { name: 'Collapse all packages', exact: true }).click();
    await page.waitForTimeout(600);
    await checkProbe(page, `${mode}: collapse`);
  });
}

test('expanded self-reference survives; keyboard cannot delete read-only nodes', async ({ page }) => {
  await load(page);
  await page.getByRole('button', { name: 'Expand all packages', exact: true }).click();
  await expect(page.getByLabel('Edge from p.A to p.A', { exact: true })).toHaveCount(1);
  const node = page.locator('.react-flow__node[data-id="p.A"]');
  await expect(node).toBeVisible();
  await node.focus();
  await expect(node).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: 'p.A details', exact: true })).toBeVisible();
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Delete');
  await expect(node).toHaveCount(1);
  await expect(page.locator('.react-flow__node[data-id="p.B"]')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('region', { name: 'p.A details', exact: true })).toHaveCount(0);
  await page.waitForTimeout(600);
  await checkProbe(page, 'self-reference and keyboard');
});

test('mobile sheets are exclusive, close by Escape and return focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await load(page);
  await page.getByRole('button', { name: 'Expand all packages', exact: true }).click();
  const node = page.locator('.react-flow__node[data-id="p.A"]');
  await expect(node).toBeVisible();
  await node.focus();
  await expect(node).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: 'p.A details', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Filter packages', exact: true }).click();
  await expect(page.getByRole('region', { name: 'p.A details', exact: true })).toHaveCount(0);
  await expect(page.getByRole('searchbox', { name: 'Search packages', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('region', { name: 'Package visibility', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Filter packages', exact: true })).toBeFocused();
  await page.waitForTimeout(600);
  await checkProbe(page, 'mobile sheets');
});
