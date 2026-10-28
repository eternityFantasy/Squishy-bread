/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBreadState,
  calculateSpineLength,
  calculateCurvature,
  updatePhysics,
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  resetBreadToCenter,
  strikeBreadWithHammer,
  DEFAULT_BREAD_CONFIG,
} from './breadPhysics.ts';

test('createBreadState initializes nodes centered and in rest pose', () => {
  const state = createBreadState(400, 300, DEFAULT_BREAD_CONFIG);
  assert.equal(state.nodes.length, DEFAULT_BREAD_CONFIG.nodeCount);
  assert.equal(state.currentEmotion, 'IDLE');
  assert.equal(state.stretchRatio, 1.0);

  // Middle node should be close to center
  const midIndex = Math.floor(DEFAULT_BREAD_CONFIG.nodeCount / 2);
  assert.ok(Math.abs(state.nodes[midIndex].x - 400) < 1e-4);
  assert.ok(Math.abs(state.nodes[midIndex].y - 300) < 1e-4);
});

test('calculateSpineLength measures rest length accurately', () => {
  const state = createBreadState(400, 300, DEFAULT_BREAD_CONFIG);
  const expectedLen = (DEFAULT_BREAD_CONFIG.nodeCount - 1) * DEFAULT_BREAD_CONFIG.restSegmentLength;
  const computed = calculateSpineLength(state.nodes);
  assert.ok(Math.abs(computed - expectedLen) < 0.01, `Expected ~${expectedLen}, got ${computed}`);
});

test('stretching nodes increases stretchRatio and triggers STRETCHED emotion', () => {
  const state = createBreadState(400, 300, DEFAULT_BREAD_CONFIG);
  const lastIndex = state.nodes.length - 1;

  // Simulate grabbing the right tip and dragging it 150px to the right
  const ok = handlePointerDown(state, 1, state.nodes[lastIndex].x, state.nodes[lastIndex].y);
  assert.equal(ok, true);

  handlePointerMove(state, 1, state.nodes[lastIndex].x + 180, 300);

  // Run a few physics steps
  for (let i = 0; i < 20; i++) {
    updatePhysics(state, 0.016, DEFAULT_BREAD_CONFIG);
  }

  assert.ok(state.stretchRatio > 1.25, `Expected stretchRatio > 1.25, got ${state.stretchRatio}`);
  assert.equal(state.currentEmotion, 'STRETCHED');
});

test('volume conservation: compressed nodes bulge (thicker radius), stretched nodes thin', () => {
  const state = createBreadState(400, 300, DEFAULT_BREAD_CONFIG);
  const midIndex = 4;
  const initialRadius = state.nodes[midIndex].currentRadius;

  // Compress middle segments closer together
  state.nodes[3].x = state.nodes[midIndex].x - 15; // compressed (rest is 42)
  state.nodes[5].x = state.nodes[midIndex].x + 15;

  updatePhysics(state, 0.016, DEFAULT_BREAD_CONFIG);

  assert.ok(
    state.nodes[midIndex].currentRadius > initialRadius,
    `Compressed radius should increase (bulge). Got ${state.nodes[midIndex].currentRadius} vs ${initialRadius}`
  );
});

test('pointer release triggers BOUNCING emotion with energy and returns to rest pose', () => {
  const state = createBreadState(400, 300, DEFAULT_BREAD_CONFIG);
  const tipIndex = state.nodes.length - 1;

  handlePointerDown(state, 99, state.nodes[tipIndex].x, state.nodes[tipIndex].y);
  handlePointerMove(state, 99, state.nodes[tipIndex].x + 100, 350);

  for (let i = 0; i < 15; i++) {
    updatePhysics(state, 0.016, DEFAULT_BREAD_CONFIG);
  }

  const releaseResult = handlePointerUp(state, 99);
  assert.ok(releaseResult !== null);
  assert.ok(releaseResult.energy > 0.1);
  assert.equal(state.currentEmotion, 'BOUNCING');

  // After running simulation for ~1.5s, bread stabilizes back near rest pose
  for (let i = 0; i < 120; i++) {
    updatePhysics(state, 0.016, DEFAULT_BREAD_CONFIG);
  }

  const stabilizedLen = calculateSpineLength(state.nodes);
  assert.ok(
    Math.abs(stabilizedLen - state.restTotalLength) < 10,
    `Bread should settle near rest length. Got ${stabilizedLen}, expected ${state.restTotalLength}`
  );
});

test('resetBreadToCenter cleanly restores coordinates without NaN or jumps', () => {
  const state = createBreadState(400, 300, DEFAULT_BREAD_CONFIG);
  // displace nodes randomly
  state.nodes[2].x += 80;
  state.nodes[2].y -= 40;

  resetBreadToCenter(state);

  for (const node of state.nodes) {
    assert.equal(node.x, node.restX);
    assert.equal(node.y, node.restY);
    assert.equal(node.vx, 0);
    assert.equal(node.vy, 0);
  }
  assert.equal(state.activePointers.size, 0);
});

test('strikeBreadWithHammer flattens bread and triggers downward/lateral impulse', () => {
  const state = createBreadState(400, 300, DEFAULT_BREAD_CONFIG);
  const midIndex = 4;
  const initialY = state.nodes[midIndex].y;

  const result = strikeBreadWithHammer(state, 400, 300, 1.0);

  assert.equal(result.struckNodeIndex, midIndex);
  assert.equal(result.streak, 1);
  assert.ok(state.flattenRatio > 0.3, `flattenRatio should increase, got ${state.flattenRatio}`);
  assert.equal(state.currentEmotion, 'FLATTENED');
  // Struck node should have positive vertical velocity (downward squash)
  assert.ok(state.nodes[midIndex].vy > 0);
});

test('flattened bread gradually returns to its original fluffy shape', () => {
  const state = createBreadState(400, 300, DEFAULT_BREAD_CONFIG);
  strikeBreadWithHammer(state, 400, 300, 1.0);
  const initialFlat = state.flattenRatio;
  assert.ok(initialFlat > 0.3);

  // Run physics for ~2 seconds (125 steps at 16ms)
  for (let i = 0; i < 125; i++) {
    updatePhysics(state, 0.016, DEFAULT_BREAD_CONFIG);
  }

  assert.ok(
    state.flattenRatio < initialFlat,
    `flattenRatio should decrease gradually: went from ${initialFlat} to ${state.flattenRatio}`
  );

  // Run physics for another ~3 seconds
  for (let i = 0; i < 200; i++) {
    updatePhysics(state, 0.016, DEFAULT_BREAD_CONFIG);
  }

  assert.ok(
    state.flattenRatio < 0.05,
    `bread should have gradually recovered near 0: got ${state.flattenRatio}`
  );
  assert.equal(state.isDizzy, false);
});

test('repeatedly striking bread keeps it flattened and triggers dizzy combo state', () => {
  const state = createBreadState(400, 300, DEFAULT_BREAD_CONFIG);

  // First strike
  strikeBreadWithHammer(state, 400, 300, 1.0);
  const streak1 = state.hammerStreak;

  // Second strike immediately
  const res2 = strikeBreadWithHammer(state, 400, 300, 1.0);
  assert.equal(res2.streak, streak1 + 1);
  assert.equal(res2.isDizzy, true);
  assert.equal(state.currentEmotion, 'FLATTENED');

  // Third strike
  const res3 = strikeBreadWithHammer(state, 400, 300, 1.0);
  assert.equal(res3.streak, 3);
  assert.ok(res3.flattenRatio >= 0.65, `Repeated strikes should produce heavy flattening, got ${res3.flattenRatio}`);
  assert.equal(state.isDizzy, true);
});

test('resetBreadToCenter clears flattenRatio, hammerStreak and dizzy states', () => {
  const state = createBreadState(400, 300, DEFAULT_BREAD_CONFIG);
  strikeBreadWithHammer(state, 400, 300, 1.0);
  strikeBreadWithHammer(state, 400, 300, 1.0);
  assert.ok(state.flattenRatio > 0.5);
  assert.equal(state.isDizzy, true);

  resetBreadToCenter(state);

  assert.equal(state.flattenRatio, 0);
  assert.equal(state.hammerStreak, 0);
  assert.equal(state.isDizzy, false);
  assert.equal(state.flattenWobble, 0);
});

