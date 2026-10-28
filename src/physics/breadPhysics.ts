/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SpineNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  restX: number;
  restY: number;
  baseRadius: number;
  currentRadius: number;
  pinned: boolean;
  draggedByTouchId: number | null;
}

export type BreadEmotion = 'IDLE' | 'SQUEEZED' | 'STRETCHED' | 'TWISTED' | 'BOUNCING' | 'FLATTENED';

export interface BreadPhysicsConfig {
  nodeCount: number;
  restSegmentLength: number;
  baseRadius: number;
  springStiffness: number; // distance spring stiffness
  springDamping: number;
  anchorStiffness: number; // pulls nodes back to rest pose
  anchorDamping: number;
  bendStiffness: number; // resists sharp bending
  maxStretchRatio: number;
  maxSquishRatio: number;
}

export const DEFAULT_BREAD_CONFIG: BreadPhysicsConfig = {
  nodeCount: 9,
  restSegmentLength: 42,
  baseRadius: 52,
  springStiffness: 200,
  springDamping: 15,
  anchorStiffness: 44,
  anchorDamping: 11,
  bendStiffness: 130,
  maxStretchRatio: 2.5,
  maxSquishRatio: 0.4,
};

export interface TouchPointer {
  id: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  targetNodeIndex: number;
  isSqueezing?: boolean;
}

export interface BreadPhysicsState {
  nodes: SpineNode[];
  centerX: number;
  centerY: number;
  activePointers: Map<number, TouchPointer>;
  currentEmotion: BreadEmotion;
  emotionTimer: number;
  blinkTimer: number;
  isBlinking: boolean;
  totalLength: number;
  restTotalLength: number;
  stretchRatio: number;
  squishIntensity: number;
  twistAngle: number;
  recentBounceEnergy: number;
  lastInteractionTime: number;
  // Hammer Flattening & Dizzy Mechanics
  flattenRatio: number; // 0 = fluffy, 1 = pancake flat
  flattenRecoveryRate: number; // units/sec restored
  hammerStreak: number;
  lastHammerTime: number;
  hammerPauseTimer: number; // brief pause before dough starts rising
  isDizzy: boolean;
  dizzyTimer: number;
  flattenWobble: number;
}

/**
 * Creates the initial bread spine centered at (centerX, centerY).
 */
export function createBreadState(
  centerX: number,
  centerY: number,
  config: BreadPhysicsConfig = DEFAULT_BREAD_CONFIG
): BreadPhysicsState {
  const nodes: SpineNode[] = [];
  const half = (config.nodeCount - 1) / 2;

  for (let i = 0; i < config.nodeCount; i++) {
    const offsetX = (i - half) * config.restSegmentLength;
    const isEnd = i === 0 || i === config.nodeCount - 1;
    const isPenultimate = i === 1 || i === config.nodeCount - 2;
    // Strip-shaped loaf with nicely rounded tapered end caps
    let r = config.baseRadius;
    if (isEnd) r *= 0.78;
    else if (isPenultimate) r *= 0.92;

    nodes.push({
      x: centerX + offsetX,
      y: centerY,
      vx: 0,
      vy: 0,
      restX: centerX + offsetX,
      restY: centerY,
      baseRadius: r,
      currentRadius: r,
      pinned: false,
      draggedByTouchId: null,
    });
  }

  const restTotalLength = (config.nodeCount - 1) * config.restSegmentLength;

  return {
    nodes,
    centerX,
    centerY,
    activePointers: new Map(),
    currentEmotion: 'IDLE',
    emotionTimer: 0,
    blinkTimer: 3.5,
    isBlinking: false,
    totalLength: restTotalLength,
    restTotalLength,
    stretchRatio: 1.0,
    squishIntensity: 0,
    twistAngle: 0,
    recentBounceEnergy: 0,
    lastInteractionTime: 0,
    flattenRatio: 0,
    flattenRecoveryRate: 0.16,
    hammerStreak: 0,
    lastHammerTime: 0,
    hammerPauseTimer: 0,
    isDizzy: false,
    dizzyTimer: 0,
    flattenWobble: 0,
  };
}

/**
 * Recalculates rest positions and sizes if the canvas resizes.
 */
export function recenterBread(
  state: BreadPhysicsState,
  newCenterX: number,
  newCenterY: number,
  config: BreadPhysicsConfig = DEFAULT_BREAD_CONFIG
): void {
  const dx = newCenterX - state.centerX;
  const dy = newCenterY - state.centerY;
  state.centerX = newCenterX;
  state.centerY = newCenterY;

  const half = (config.nodeCount - 1) / 2;
  const restTotalLength = (config.nodeCount - 1) * config.restSegmentLength;
  state.restTotalLength = restTotalLength;

  for (let i = 0; i < state.nodes.length; i++) {
    const node = state.nodes[i];
    node.restX = newCenterX + (i - half) * config.restSegmentLength;
    node.restY = newCenterY;
    node.x += dx;
    node.y += dy;

    const isEnd = i === 0 || i === config.nodeCount - 1;
    const isPenultimate = i === 1 || i === config.nodeCount - 2;
    let r = config.baseRadius;
    if (isEnd) r *= 0.78;
    else if (isPenultimate) r *= 0.92;

    node.baseRadius = r;
    if (state.activePointers.size === 0) {
      node.currentRadius = r;
    }
  }
}

/**
 * Find the nearest spine node to a given point.
 */
export function findNearestNodeIndex(
  nodes: SpineNode[],
  x: number,
  y: number,
  maxDistance = 160
): number {
  let minIndex = -1;
  let minDist = maxDistance;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const d = Math.hypot(node.x - x, node.y - y);
    if (d < minDist) {
      minDist = d;
      minIndex = i;
    }
  }

  return minIndex;
}

/**
 * Handle touch/mouse press down.
 */
export function handlePointerDown(
  state: BreadPhysicsState,
  pointerId: number,
  x: number,
  y: number,
  isSqueezeGesture = false
): boolean {
  const nearestIndex = findNearestNodeIndex(state.nodes, x, y);
  if (nearestIndex === -1) {
    return false;
  }

  state.activePointers.set(pointerId, {
    id: pointerId,
    x,
    y,
    startX: x,
    startY: y,
    targetNodeIndex: nearestIndex,
    isSqueezing: isSqueezeGesture,
  });

  const node = state.nodes[nearestIndex];
  node.draggedByTouchId = pointerId;
  state.lastInteractionTime = Date.now();

  return true;
}

/**
 * Handle pointer movement.
 */
export function handlePointerMove(
  state: BreadPhysicsState,
  pointerId: number,
  x: number,
  y: number
): void {
  const pointer = state.activePointers.get(pointerId);
  if (!pointer) return;

  pointer.x = x;
  pointer.y = y;
  state.lastInteractionTime = Date.now();
}

/**
 * Handle pointer release.
 * Returns the release velocity and energy for sound & haptics.
 */
export function handlePointerUp(
  state: BreadPhysicsState,
  pointerId: number
): { releasedIndex: number; energy: number; wasStretched: boolean; wasSqueezed: boolean } | null {
  const pointer = state.activePointers.get(pointerId);
  if (!pointer) return null;

  const nodeIndex = pointer.targetNodeIndex;
  const node = state.nodes[nodeIndex];
  if (node && node.draggedByTouchId === pointerId) {
    node.draggedByTouchId = null;
  }

  const wasStretched = state.stretchRatio > 1.25;
  const wasSqueezed = state.squishIntensity > 0.2 || state.stretchRatio < 0.85;
  const displacement = node ? Math.hypot(node.x - node.restX, node.y - node.restY) : 0;
  const velocity = node ? Math.hypot(node.vx, node.vy) : 0;
  const energy = Math.min(1.0, (displacement + velocity * 0.1) / 120);

  state.recentBounceEnergy = Math.max(state.recentBounceEnergy, energy);
  state.activePointers.delete(pointerId);

  if (energy > 0.15) {
    state.currentEmotion = 'BOUNCING';
    state.emotionTimer = 0.8;
  }

  return {
    releasedIndex: nodeIndex,
    energy,
    wasStretched,
    wasSqueezed,
  };
}

/**
 * Apply direct squeeze pressure (e.g. pinch or two fingers compressing).
 */
export function applySqueezeAt(
  state: BreadPhysicsState,
  x: number,
  y: number,
  intensity = 0.5
): void {
  const index = findNearestNodeIndex(state.nodes, x, y);
  if (index === -1) return;

  state.squishIntensity = Math.min(1.0, state.squishIntensity + intensity);
  state.currentEmotion = 'SQUEEZED';
  state.emotionTimer = 0.6;
}

/**
 * Strike the bread with the toy hammer to flatten it.
 * The bread squashes down and spreads outward, entering a dizzy flattened state
 * when repeatedly struck.
 */
export function strikeBreadWithHammer(
  state: BreadPhysicsState,
  hitX: number,
  hitY: number,
  power = 1.0
): {
  struckNodeIndex: number;
  streak: number;
  flattenRatio: number;
  isDizzy: boolean;
} {
  let targetIndex = findNearestNodeIndex(state.nodes, hitX, hitY, 320);
  if (targetIndex === -1) {
    targetIndex = Math.floor(state.nodes.length / 2);
  }

  const now = Date.now();
  if (now - state.lastHammerTime < 2400) {
    state.hammerStreak += 1;
  } else {
    state.hammerStreak = 1;
  }
  state.lastHammerTime = now;
  state.lastInteractionTime = now;

  // Flattening increases with strike, with soft ceiling at 0.92 (pancake flat)
  const squashIncrement = (1 - state.flattenRatio) * 0.52 * power;
  state.flattenRatio = Math.min(0.92, state.flattenRatio + squashIncrement);
  state.flattenWobble = 1.0;
  state.hammerPauseTimer = 0.35; // 0.35s simulation pause before dough starts rising

  // Sustained or repeated strikes trigger comical dizzy flattened state
  const isDizzy = state.hammerStreak >= 2 || state.flattenRatio >= 0.42;
  state.isDizzy = isDizzy;
  state.currentEmotion = 'FLATTENED';
  state.emotionTimer = 2.0;

  // Physics impulse: struck node pushed down violently, neighbors spread laterally outward
  const struckNode = state.nodes[targetIndex];
  if (struckNode) {
    struckNode.vy += 90 * power;
  }

  const mid = (state.nodes.length - 1) / 2;
  for (let i = 0; i < state.nodes.length; i++) {
    const node = state.nodes[i];
    const diff = i - targetIndex;
    if (diff !== 0) {
      // Lateral outward pancake expansion
      const spreadDir = Math.sign(diff);
      node.vx += spreadDir * (42 * power) / Math.max(1, Math.abs(diff) * 0.8);
    } else {
      // Slight outward spread from center
      const fromMid = i - mid;
      if (fromMid !== 0) {
        node.vx += Math.sign(fromMid) * 15 * power;
      }
    }
    // Downward squash impulse to surrounding nodes
    if (i !== targetIndex) {
      node.vy += (35 * power) / (Math.abs(diff) * 0.9 + 1);
    }
  }

  return {
    struckNodeIndex: targetIndex,
    streak: state.hammerStreak,
    flattenRatio: state.flattenRatio,
    isDizzy: state.isDizzy,
  };
}

/**
 * Compute the total length along the spine chain.
 */
export function calculateSpineLength(nodes: SpineNode[]): number {
  let len = 0;
  for (let i = 0; i < nodes.length - 1; i++) {
    len += Math.hypot(nodes[i + 1].x - nodes[i].x, nodes[i + 1].y - nodes[i].y);
  }
  return len;
}

/**
 * Calculate curvature/bend metric of the spine.
 */
export function calculateCurvature(nodes: SpineNode[]): number {
  if (nodes.length < 3) return 0;
  let totalAngleDiff = 0;

  for (let i = 1; i < nodes.length - 1; i++) {
    const prev = nodes[i - 1];
    const curr = nodes[i];
    const next = nodes[i + 1];

    const angle1 = Math.atan2(curr.y - prev.y, curr.x - prev.x);
    const angle2 = Math.atan2(next.y - curr.y, next.x - curr.x);
    let diff = Math.abs(angle2 - angle1);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    totalAngleDiff += diff;
  }

  return totalAngleDiff;
}

/**
 * Physics integration step (Semi-implicit Euler / Verlet-like spring integration).
 */
export function updatePhysics(
  state: BreadPhysicsState,
  dt: number,
  config: BreadPhysicsConfig = DEFAULT_BREAD_CONFIG
): void {
  // Clamp dt to avoid instability if frames skip
  const step = Math.min(dt, 0.033);
  const { nodes } = state;
  const n = nodes.length;

  // 1. Process active pointer drags
  for (const pointer of state.activePointers.values()) {
    const targetNode = nodes[pointer.targetNodeIndex];
    if (targetNode) {
      // Spring drag with strong stiffness towards pointer position
      const dx = pointer.x - targetNode.x;
      const dy = pointer.y - targetNode.y;
      targetNode.vx += dx * 28;
      targetNode.vy += dy * 28;
      targetNode.vx *= 0.55;
      targetNode.vy *= 0.55;
    }
  }

  // 2. Pairwise distance springs between adjacent nodes
  for (let i = 0; i < n - 1; i++) {
    const a = nodes[i];
    const b = nodes[i + 1];

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy) || 0.001;
    const diff = dist - config.restSegmentLength;

    const nx = dx / dist;
    const ny = dy / dist;

    // Relative velocity along spring direction
    const rvx = b.vx - a.vx;
    const rvy = b.vy - a.vy;
    const dampForce = (rvx * nx + rvy * ny) * config.springDamping;

    const springForce = diff * config.springStiffness + dampForce;

    const fx = nx * springForce;
    const fy = ny * springForce;

    if (!a.pinned && a.draggedByTouchId === null) {
      a.vx += fx * step;
      a.vy += fy * step;
    }
    if (!b.pinned && b.draggedByTouchId === null) {
      b.vx -= fx * step;
      b.vy -= fy * step;
    }
  }

  // 3. Angular bending resistance (straightening spring)
  for (let i = 1; i < n - 1; i++) {
    const prev = nodes[i - 1];
    const curr = nodes[i];
    const next = nodes[i + 1];

    // Midpoint of neighbors
    const midX = (prev.x + next.x) * 0.5;
    const midY = (prev.y + next.y) * 0.5;

    // Force that pulls curr towards the line connecting prev and next
    const bx = (midX - curr.x) * config.bendStiffness;
    const by = (midY - curr.y) * config.bendStiffness;

    if (curr.draggedByTouchId === null) {
      curr.vx += bx * step;
      curr.vy += by * step;
    }
  }

  // 4. Global restoring anchor to rest pose + center of mass stabilization
  for (let i = 0; i < n; i++) {
    const node = nodes[i];
    const dx = node.restX - node.x;
    const dy = node.restY - node.y;

    const anchorFx = dx * config.anchorStiffness - node.vx * config.anchorDamping;
    const anchorFy = dy * config.anchorStiffness - node.vy * config.anchorDamping;

    if (node.draggedByTouchId === null) {
      node.vx += anchorFx * step;
      node.vy += anchorFy * step;
    }
  }

  // 5. Integrate positions & apply air damping
  for (let i = 0; i < n; i++) {
    const node = nodes[i];
    node.vx *= 0.94;
    node.vy *= 0.94;

    node.x += node.vx * step;
    node.y += node.vy * step;
  }

  // 6. Metrics & Volume Conservation (Bulge when compressed, thinning when stretched)
  const currentTotalLength = calculateSpineLength(nodes);
  state.totalLength = currentTotalLength;
  state.stretchRatio = currentTotalLength / state.restTotalLength;

  // Local bulge calculation for each node
  for (let i = 0; i < n; i++) {
    const node = nodes[i];
    let localDist = config.restSegmentLength;
    if (i === 0) {
      localDist = Math.hypot(nodes[1].x - node.x, nodes[1].y - node.y);
    } else if (i === n - 1) {
      localDist = Math.hypot(node.x - nodes[n - 2].x, node.y - nodes[n - 2].y);
    } else {
      const d1 = Math.hypot(node.x - nodes[i - 1].x, node.y - nodes[i - 1].y);
      const d2 = Math.hypot(nodes[i + 1].x - node.x, nodes[i + 1].y - node.y);
      localDist = (d1 + d2) * 0.5;
    }

    const localRatio = Math.max(0.3, Math.min(3.0, localDist / config.restSegmentLength));
    // Volume conservation: as segment stretches along spine, it thins perpendicularly
    // As it squishes, it bulges outwards!
    const thicknessMultiplier = Math.max(0.65, Math.min(1.8, Math.sqrt(1 / localRatio)));
    node.currentRadius = node.baseRadius * thicknessMultiplier;
  }

  // Decay squish intensity & bounce energy smoothly
  state.squishIntensity = Math.max(0, state.squishIntensity - step * 1.5);
  state.recentBounceEnergy = Math.max(0, state.recentBounceEnergy - step * 2.0);

  // Flattening recovery: bread gradually returns to its original fluffy shape
  if (state.flattenRatio > 0) {
    if (state.hammerPauseTimer > 0) {
      state.hammerPauseTimer -= step;
    } else {
      const recoveryStep = state.flattenRecoveryRate * step;
      state.flattenRatio = Math.max(0, state.flattenRatio - recoveryStep);
    }
    if (state.flattenRatio < 0.08) {
      state.isDizzy = false;
    }
  }

  // Hammer streak decay (resets after 2.6s without strikes)
  if (Date.now() - state.lastHammerTime > 2600 && state.hammerStreak > 0) {
    state.hammerStreak = 0;
  }

  // Dizzy timer & wobble decay
  state.dizzyTimer += step;
  if (state.flattenWobble > 0) {
    state.flattenWobble = Math.max(0, state.flattenWobble - step * 2.5);
  }

  // 7. Curvature & Emotion update
  const curvature = calculateCurvature(nodes);

  if (state.emotionTimer > 0) {
    state.emotionTimer -= step;
  } else {
    // Determine emotion based on real deformation state
    if (state.flattenRatio > 0.28 || state.isDizzy) {
      state.currentEmotion = 'FLATTENED';
    } else if (state.activePointers.size > 0) {
      if (state.stretchRatio > 1.25) {
        state.currentEmotion = 'STRETCHED';
      } else if (state.stretchRatio < 0.88 || state.squishIntensity > 0.15) {
        state.currentEmotion = 'SQUEEZED';
      } else if (curvature > 0.8) {
        state.currentEmotion = 'TWISTED';
      } else {
        state.currentEmotion = 'SQUEEZED';
      }
    } else {
      state.currentEmotion = 'IDLE';
    }
  }

  // 8. Natural blinking loop
  state.blinkTimer -= step;
  if (state.blinkTimer <= 0) {
    state.isBlinking = true;
    if (state.blinkTimer <= -0.16) {
      state.isBlinking = false;
      state.blinkTimer = 2.5 + Math.random() * 2.5; // Blink every 2.5 to 5s
    }
  }
}

/**
 * Resets the bread state immediately to its pristine centered rest pose.
 */
export function resetBreadToCenter(state: BreadPhysicsState): void {
  for (let i = 0; i < state.nodes.length; i++) {
    const node = state.nodes[i];
    node.x = node.restX;
    node.y = node.restY;
    node.vx = 0;
    node.vy = 0;
    node.currentRadius = node.baseRadius;
    node.draggedByTouchId = null;
  }
  state.activePointers.clear();
  state.currentEmotion = 'BOUNCING';
  state.emotionTimer = 0.5;
  state.stretchRatio = 1.0;
  state.squishIntensity = 0;
  state.recentBounceEnergy = 0.8;
  state.flattenRatio = 0;
  state.hammerStreak = 0;
  state.hammerPauseTimer = 0;
  state.isDizzy = false;
  state.flattenWobble = 0;
}
