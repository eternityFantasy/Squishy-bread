/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  BreadPhysicsState,
  createBreadState,
  recenterBread,
  updatePhysics,
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  resetBreadToCenter,
  applySqueezeAt,
  strikeBreadWithHammer,
  DEFAULT_BREAD_CONFIG,
} from '../physics/breadPhysics.ts';
import { breadAudio } from '../audio/soundEffects.ts';
import { breadHaptics } from '../haptics/vibration.ts';
import { BreadTheme } from '../types/breadTheme.ts';
import { Hammer, Hand } from 'lucide-react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  type: 'flour' | 'sparkle' | 'heart' | 'star' | 'bonkText';
  text?: string;
}

interface SquishyBreadCanvasProps {
  theme: BreadTheme;
  isSoundMuted: boolean;
  isHapticsEnabled: boolean;
  reducedMotion: boolean;
  onResetRef?: React.MutableRefObject<(() => void) | null>;
  onBreadInteract?: () => void;
  activeTool?: 'hand' | 'hammer';
  onSelectTool?: (tool: 'hand' | 'hammer') => void;
}

export const SquishyBreadCanvas: React.FC<SquishyBreadCanvasProps> = ({
  theme,
  isSoundMuted,
  isHapticsEnabled,
  reducedMotion,
  onResetRef,
  onBreadInteract,
  activeTool: activeToolProp,
  onSelectTool,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<BreadPhysicsState | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const particlesRef = useRef<Particle[]>([]);
  const lastStretchStepRef = useRef<number>(1.0);
  const prevFlattenRef = useRef<number>(0);
  const [interactionHint, setInteractionHint] = useState<string>('Squish, stretch, or pull me!');

  // Active Tool state (Hand vs Toy Hammer)
  const [internalTool, setInternalTool] = useState<'hand' | 'hammer'>('hand');
  const currentTool = activeToolProp ?? internalTool;
  const setTool = useCallback((tool: 'hand' | 'hammer') => {
    setInternalTool(tool);
    onSelectTool?.(tool);
    if (tool === 'hammer') {
      setInteractionHint('Toy Hammer equipped! Tap to flatten the bread! 🔨');
    } else {
      setInteractionHint('Hand mode active: Squeeze, stretch, or pinch!');
    }
  }, [onSelectTool]);

  // Hammer swing tracking
  const hammerSwingRef = useRef<{
    active: boolean;
    startTime: number;
    duration: number;
    hitX: number;
    hitY: number;
  }>({
    active: false,
    startTime: 0,
    duration: 180,
    hitX: 0,
    hitY: 0,
  });

  // Track cursor position for smooth hammer follower
  const cursorPosRef = useRef<{ x: number; y: number; isOver: boolean }>({
    x: 0,
    y: 0,
    isOver: false,
  });

  // Sync audio and haptics state
  useEffect(() => {
    breadAudio.setMuted(isSoundMuted);
  }, [isSoundMuted]);

  useEffect(() => {
    breadHaptics.setEnabled(isHapticsEnabled);
  }, [isHapticsEnabled]);

  // Spawn visual feedback particle
  const spawnParticles = useCallback((
    x: number,
    y: number,
    count = 6,
    type: 'flour' | 'sparkle' | 'heart' | 'star' | 'bonkText' = 'sparkle',
    text?: string
  ) => {
    if (reducedMotion && type !== 'bonkText') return;

    if (type === 'bonkText') {
      particlesRef.current.push({
        x,
        y: y - 10,
        vx: (Math.random() - 0.5) * 0.8,
        vy: -1.6,
        size: 18,
        color: '#FFAE33',
        alpha: 1.0,
        life: 0,
        maxLife: 40,
        type: 'bonkText',
        text: text || 'BONK!',
      });
      return;
    }

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 2.8;
      particlesRef.current.push({
        x: x + (Math.random() - 0.5) * 32,
        y: y + (Math.random() - 0.5) * 22,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.4,
        size: type === 'heart' ? 12 : type === 'star' ? 8 + Math.random() * 4 : 2.5 + Math.random() * 3.5,
        color: type === 'heart' ? '#FF6584' : type === 'flour' ? '#FFFFFF' : type === 'star' ? '#FFD13B' : theme.crumbColor,
        alpha: 0.95,
        life: 0,
        maxLife: 35 + Math.random() * 25,
        type,
      });
    }
  }, [theme.crumbColor, reducedMotion]);

  // Reset bread function exposed to parent
  const handleReset = useCallback(() => {
    if (!stateRef.current) return;
    resetBreadToCenter(stateRef.current);
    breadAudio.playBoing(0.8);
    breadHaptics.boing();
    spawnParticles(stateRef.current.centerX, stateRef.current.centerY, 12, 'sparkle');
    setInteractionHint('Boing! Fresh and soft again!');
    onBreadInteract?.();
  }, [onBreadInteract, spawnParticles]);

  useEffect(() => {
    if (onResetRef) {
      onResetRef.current = handleReset;
    }
  }, [onResetRef, handleReset]);

  const configRef = useRef<typeof DEFAULT_BREAD_CONFIG>(DEFAULT_BREAD_CONFIG);

  const getAdaptiveConfig = useCallback((width: number) => {
    const isMobile = width < 600;
    const restSegmentLength = isMobile
      ? Math.max(26, Math.min(35, (width - 90) / 8))
      : 42;
    const baseRadius = isMobile
      ? Math.max(34, Math.min(45, width * 0.11))
      : 52;
    return {
      ...DEFAULT_BREAD_CONFIG,
      restSegmentLength,
      baseRadius,
    };
  }, []);

  // Canvas size and physics state initialization
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height);

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const cx = width / 2;
      const cy = height / 2;
      const currentConfig = getAdaptiveConfig(width);
      configRef.current = currentConfig;

      if (!stateRef.current) {
        stateRef.current = createBreadState(cx, cy, currentConfig);
      } else {
        recenterBread(stateRef.current, cx, cy, currentConfig);
      }
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [getAdaptiveConfig]);

  // Main animation / render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;

    const render = (time: number) => {
      if (!isRunning) return;
      const dt = Math.min((time - lastTimeRef.current) / 1000, 0.033);
      lastTimeRef.current = time;

      const state = stateRef.current;
      if (state) {
        // Physics update with active adaptive config
        updatePhysics(state, dt, configRef.current);

        // Continuous audio stretch update
        const isDragging = state.activePointers.size > 0;
        breadAudio.updateStretchSound(state.stretchRatio, isDragging);

        // Tactile ticks on stretching
        if (isDragging && Math.abs(state.stretchRatio - lastStretchStepRef.current) > 0.15) {
          breadHaptics.stretchTick();
          lastStretchStepRef.current = state.stretchRatio;
        }

        // Check if bread was flattened and just finished gradually recovering to fluffy shape
        if (prevFlattenRef.current > 0.18 && state.flattenRatio <= 0.04) {
          breadAudio.playRestoredPop();
          spawnParticles(state.centerX, state.centerY, 10, 'sparkle');
          setInteractionHint('Poof! Puffed right back to full fluffiness! ✨');
        }
        prevFlattenRef.current = state.flattenRatio;

        // Draw Frame
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = canvas.width / dpr;
        const h = canvas.height / dpr;

        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, w, h);

        // 1. Draw soft table drop shadow
        drawBreadShadow(ctx, state);

        // 2. Draw soft-body bread mesh (pillowy loaf)
        drawBreadBody(ctx, state, theme, time);

        // 3. Draw cute facial expressions
        drawBreadFace(ctx, state, theme, time);

        // 4. Draw orbiting cartoon dizzy stars when repeatedly struck / flat
        drawDizzyStars(ctx, state, time);

        // 5. Draw interactive particles (crumbs, flour, sparkles, bonk text)
        drawParticles(ctx, dt);

        // 6. Draw Toy Hammer overlay & animated swing
        drawHammer(ctx, time);

        ctx.restore();
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      breadAudio.stopStretch();
    };
  }, [theme]);

  // Helper: Draw soft reactive shadow
  const drawBreadShadow = (ctx: CanvasRenderingContext2D, state: BreadPhysicsState) => {
    const nodes = state.nodes;
    if (nodes.length < 2) return;

    ctx.save();
    const midIdx = Math.floor(nodes.length / 2);
    const midNode = nodes[midIdx];
    const vertFlatten = Math.max(0.24, 1 - state.flattenRatio * 0.72);
    const totalW = Math.max(140, state.totalLength * (1.05 + state.flattenRatio * 0.35));
    const shadowY = midNode.y + midNode.currentRadius * vertFlatten * 0.95 + 14;
    const shadowH = Math.max(12, (38 / Math.sqrt(state.stretchRatio)) * (1 - state.flattenRatio * 0.42));

    // Smooth soft radial gradient for contact shadow
    const grad = ctx.createRadialGradient(
      midNode.x,
      shadowY,
      shadowH * 0.2,
      midNode.x,
      shadowY,
      totalW * 0.55
    );
    const alpha = Math.max(0.08, Math.min(0.25, 0.2 - (state.stretchRatio - 1) * 0.05 + state.flattenRatio * 0.06));
    grad.addColorStop(0, `rgba(148, 102, 65, ${alpha * 1.5})`);
    grad.addColorStop(0.4, `rgba(170, 125, 85, ${alpha * 0.8})`);
    grad.addColorStop(1, 'rgba(180, 135, 95, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(midNode.x, shadowY, totalW * 0.52, shadowH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // Helper: Draw main bread body with baker slashes and crust highlights
  const drawBreadBody = (
    ctx: CanvasRenderingContext2D,
    state: BreadPhysicsState,
    t: BreadTheme,
    time: number
  ) => {
    const nodes = state.nodes;
    const n = nodes.length;
    if (n < 2) return;

    const vertFlatten = Math.max(0.24, 1 - state.flattenRatio * 0.72);

    // Compute normals for top and bottom ribbon contour
    const topPoints: { x: number; y: number }[] = [];
    const botPoints: { x: number; y: number }[] = [];

    for (let i = 0; i < n; i++) {
      const curr = nodes[i];
      let tx: number;
      let ty: number;

      if (i === 0) {
        tx = nodes[1].x - curr.x;
        ty = nodes[1].y - curr.y;
      } else if (i === n - 1) {
        tx = curr.x - nodes[n - 2].x;
        ty = curr.y - nodes[n - 2].y;
      } else {
        tx = nodes[i + 1].x - nodes[i - 1].x;
        ty = nodes[i + 1].y - nodes[i - 1].y;
      }

      const len = Math.hypot(tx, ty) || 1;
      // Normal vector pointing "up" (perpendicular to spine)
      const nx = -ty / len;
      const ny = tx / len;

      const wobbleOffset = state.flattenWobble > 0 ? Math.sin(time * 0.045 + i * 1.5) * state.flattenWobble * 3.5 : 0;
      const r = curr.currentRadius * vertFlatten;
      topPoints.push({ x: curr.x + nx * r, y: curr.y + ny * r + wobbleOffset });
      botPoints.push({ x: curr.x - nx * r, y: curr.y - ny * r + wobbleOffset });
    }

    // Path construction: Single continuous smooth closed loop with tangent-continuous end caps
    ctx.save();
    ctx.beginPath();

    // Start at topPoints[0]
    ctx.moveTo(topPoints[0].x, topPoints[0].y);

    // 1. Top contour spline from 0 to n-1
    for (let i = 1; i < n; i++) {
      const prev = topPoints[i - 1];
      const curr = topPoints[i];
      const midX = (prev.x + curr.x) * 0.5;
      const midY = (prev.y + curr.y) * 0.5;
      ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
    }
    ctx.lineTo(topPoints[n - 1].x, topPoints[n - 1].y);

    // 2. Right end cap: Smooth rounded hemisphere around node n-1
    const endNode = nodes[n - 1];
    const prevEnd = nodes[n - 2];
    const endTx = endNode.x - prevEnd.x;
    const endTy = endNode.y - prevEnd.y;
    const endTDist = Math.hypot(endTx, endTy) || 1;
    const endDirX = endTx / endTDist;
    const endDirY = endTy / endTDist;
    const capOutR = endNode.currentRadius * (1.35 + state.flattenRatio * 0.35);

    // Control points pushing outward past the end node
    const cp1x = topPoints[n - 1].x + endDirX * capOutR;
    const cp1y = topPoints[n - 1].y + endDirY * capOutR * vertFlatten;
    const cp2x = botPoints[n - 1].x + endDirX * capOutR;
    const cp2y = botPoints[n - 1].y + endDirY * capOutR * vertFlatten;
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, botPoints[n - 1].x, botPoints[n - 1].y);

    // 3. Bottom contour spline backwards from n-1 to 0
    for (let i = n - 2; i >= 0; i--) {
      const prev = botPoints[i + 1];
      const curr = botPoints[i];
      const midX = (prev.x + curr.x) * 0.5;
      const midY = (prev.y + curr.y) * 0.5;
      ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
    }
    ctx.lineTo(botPoints[0].x, botPoints[0].y);

    // 4. Left end cap: Smooth rounded hemisphere around node 0
    const startNode = nodes[0];
    const nextStart = nodes[1];
    const startTx = startNode.x - nextStart.x;
    const startTy = startNode.y - nextStart.y;
    const startTDist = Math.hypot(startTx, startTy) || 1;
    const startDirX = startTx / startTDist;
    const startDirY = startTy / startTDist;
    const capStartR = startNode.currentRadius * (1.35 + state.flattenRatio * 0.35);

    const scp1x = botPoints[0].x + startDirX * capStartR;
    const scp1y = botPoints[0].y + startDirY * capStartR * vertFlatten;
    const scp2x = topPoints[0].x + startDirX * capStartR;
    const scp2y = topPoints[0].y + startDirY * capStartR * vertFlatten;
    ctx.bezierCurveTo(scp1x, scp1y, scp2x, scp2y, topPoints[0].x, topPoints[0].y);

    ctx.closePath();

    // Fill with soft warm gradient
    const midNode = nodes[Math.floor(n / 2)];
    const grad = ctx.createLinearGradient(
      midNode.x,
      midNode.y - midNode.currentRadius * vertFlatten * 1.2,
      midNode.x,
      midNode.y + midNode.currentRadius * vertFlatten * 1.2
    );
    grad.addColorStop(0, t.bodyColorLight);
    grad.addColorStop(0.3, t.bodyColor);
    grad.addColorStop(0.85, t.bodyColor);
    grad.addColorStop(1, t.crustColor);

    ctx.fillStyle = grad;
    ctx.fill();

    // Outer crust stroke
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = t.crustAccent;
    ctx.stroke();

    // Glossy vinyl shine along top ridge
    ctx.save();
    ctx.clip(); // clip inside bread body

    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const p = topPoints[i];
      const node = nodes[i];
      // Offset shine slightly inside the top border
      const sx = p.x * 0.85 + node.x * 0.15;
      const sy = p.y * 0.85 + node.y * 0.15;
      if (i === 0) ctx.moveTo(sx, sy);
      else {
        const prev = topPoints[i - 1];
        const prevNode = nodes[i - 1];
        const psx = prev.x * 0.85 + prevNode.x * 0.15;
        const psy = prev.y * 0.85 + prevNode.y * 0.15;
        ctx.quadraticCurveTo(psx, psy, (psx + sx) * 0.5, (psy + sy) * 0.5);
      }
    }
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineCap = 'round';
    ctx.stroke();

    // Baker scars / scores on bread (classic French bread slits)
    drawBakerScores(ctx, nodes, t, vertFlatten);

    // Cute toppings (e.g. melting butter pat or sesame)
    if (t.toppings === 'butter') {
      drawButterPat(ctx, nodes, time, vertFlatten);
    } else if (t.toppings === 'sesame' || t.toppings === 'strawberry') {
      drawSprinkles(ctx, nodes, t, vertFlatten);
    } else if (t.toppings === 'choco-drizzle') {
      drawChocoDrizzle(ctx, nodes, t, vertFlatten);
    }

    ctx.restore(); // restore clip
    ctx.restore(); // restore main save
  };

  // Helper: Draw cute diagonal baker cuts
  const drawBakerScores = (
    ctx: CanvasRenderingContext2D,
    nodes: BreadPhysicsState['nodes'],
    t: BreadTheme,
    vertFlatten = 1.0
  ) => {
    const scoreIndices = [2, 4, 6];
    ctx.save();
    ctx.strokeStyle = t.crustColor;
    ctx.lineWidth = 3.5 * Math.max(0.65, vertFlatten);
    ctx.lineCap = 'round';

    for (const idx of scoreIndices) {
      if (idx >= nodes.length - 1) continue;
      const node = nodes[idx];
      const r = node.currentRadius * vertFlatten * 0.65;

      // Diagonal slant across spine
      ctx.beginPath();
      ctx.moveTo(node.x - 14, node.y - r * 0.7);
      ctx.quadraticCurveTo(node.x, node.y - r * 0.2, node.x + 14, node.y + r * 0.6);
      ctx.stroke();

      // Soft highlight edge inside the cut
      ctx.beginPath();
      ctx.moveTo(node.x - 13, node.y - r * 0.65);
      ctx.quadraticCurveTo(node.x + 1, node.y - r * 0.15, node.x + 15, node.y + r * 0.65);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.strokeStyle = t.crustColor;
      ctx.lineWidth = 3.5 * Math.max(0.65, vertFlatten);
    }
    ctx.restore();
  };

  // Helper: Draw cute melting butter pat
  const drawButterPat = (
    ctx: CanvasRenderingContext2D,
    nodes: BreadPhysicsState['nodes'],
    time: number,
    vertFlatten = 1.0
  ) => {
    const midIdx = Math.floor(nodes.length / 2);
    const node = nodes[midIdx];
    const prev = nodes[midIdx - 1];
    const next = nodes[midIdx + 1];

    const angle = Math.atan2(next.y - prev.y, next.x - prev.x);

    ctx.save();
    // Position butter on top of bread curve
    ctx.translate(node.x, node.y - node.currentRadius * vertFlatten * 0.95);
    ctx.rotate(angle);
    ctx.scale(1.0, Math.max(0.48, vertFlatten));

    // Gentle melting drip
    const drip = Math.sin(time * 0.003) * 2;

    // Golden butter slab
    ctx.fillStyle = '#FFE66D';
    ctx.beginPath();
    ctx.roundRect(-20, -12 + drip, 40, 20, [8, 8, 10, 10]);
    ctx.fill();

    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#F7C948';
    ctx.stroke();

    // Gloss highlight
    ctx.fillStyle = '#FFF8D6';
    ctx.beginPath();
    ctx.ellipse(-8, -8 + drip, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  // Helper: Draw sesame / berry seeds
  const drawSprinkles = (
    ctx: CanvasRenderingContext2D,
    nodes: BreadPhysicsState['nodes'],
    t: BreadTheme,
    vertFlatten = 1.0
  ) => {
    ctx.save();
    ctx.fillStyle = t.toppings === 'strawberry' ? '#9E2A2B' : '#FFF3C4';
    for (let i = 1; i < nodes.length - 1; i += 2) {
      const node = nodes[i];
      for (let s = -1; s <= 1; s += 2) {
        ctx.beginPath();
        ctx.ellipse(node.x + s * 14, node.y - node.currentRadius * vertFlatten * 0.45, 3, 5 * vertFlatten, s * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  };

  // Helper: Draw choco swirl drizzle
  const drawChocoDrizzle = (
    ctx: CanvasRenderingContext2D,
    nodes: BreadPhysicsState['nodes'],
    t: BreadTheme,
    vertFlatten = 1.0
  ) => {
    ctx.save();
    ctx.strokeStyle = t.crustAccent;
    ctx.lineWidth = 5 * Math.max(0.65, vertFlatten);
    ctx.lineCap = 'round';
    ctx.beginPath();

    for (let i = 1; i < nodes.length - 1; i++) {
      const node = nodes[i];
      const sign = i % 2 === 0 ? 1 : -1;
      const yOff = sign * (node.currentRadius * vertFlatten * 0.5);
      if (i === 1) ctx.moveTo(node.x, node.y + yOff);
      else ctx.lineTo(node.x, node.y + yOff);
    }
    ctx.stroke();
    ctx.restore();
  };

  // Helper: Draw expressive kawaii cartoon face
  const drawBreadFace = (
    ctx: CanvasRenderingContext2D,
    state: BreadPhysicsState,
    t: BreadTheme,
    time: number
  ) => {
    const midIdx = Math.floor(state.nodes.length / 2);
    const node = state.nodes[midIdx];
    const prev = state.nodes[midIdx - 1];
    const next = state.nodes[midIdx + 1];

    const angle = Math.atan2(next.y - prev.y, next.x - prev.x);
    const vertFlattenFace = Math.max(0.28, 1 - state.flattenRatio * 0.65);

    ctx.save();
    ctx.translate(node.x, node.y + 2 * vertFlattenFace);
    ctx.rotate(angle);

    const faceScale = Math.max(0.65, Math.min(1.3, node.currentRadius / 52));
    const horizScaleFace = 1 + state.flattenRatio * 0.35;
    ctx.scale(faceScale * horizScaleFace, faceScale * vertFlattenFace);

    const emotion = state.currentEmotion;
    const isBlinking = state.isBlinking;
    const eyeSpacing = 28;
    const eyeY = -5;

    // 1. Cheeks (Always cute, puffed up when squeezed or hammered!)
    const isSquished = emotion === 'SQUEEZED' || emotion === 'FLATTENED' || state.squishIntensity > 0.15;
    const cheekRadius = isSquished ? 13 : 10;
    ctx.fillStyle = t.cheekColor;
    ctx.save();
    ctx.globalAlpha = isSquished ? 0.95 : 0.75;

    // Left cheek
    ctx.beginPath();
    ctx.ellipse(-eyeSpacing - 10, eyeY + 11, cheekRadius * 1.25, cheekRadius * 0.95, 0, 0, Math.PI * 2);
    ctx.fill();

    // Right cheek
    ctx.beginPath();
    ctx.ellipse(eyeSpacing + 10, eyeY + 11, cheekRadius * 1.25, cheekRadius * 0.95, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cheek blush highlights
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.beginPath();
    ctx.arc(-eyeSpacing - 8, eyeY + 8, 2.8, 0, Math.PI * 2);
    ctx.arc(eyeSpacing + 12, eyeY + 8, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. Eyes based on emotion
    ctx.strokeStyle = '#2B1810';
    ctx.fillStyle = '#2B1810';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';

    if (emotion === 'FLATTENED') {
      if (state.isDizzy) {
        // Rotating dizzy cartoon spiral eyes
        for (const side of [-1, 1]) {
          const ex = side * eyeSpacing;
          ctx.save();
          ctx.translate(ex, eyeY);
          ctx.rotate((time * 0.007 + (side === 1 ? Math.PI : 0)) * side);
          ctx.beginPath();
          ctx.lineWidth = 2.6;
          ctx.strokeStyle = '#2B1810';
          for (let a = 0; a < Math.PI * 3.6; a += 0.28) {
            const r = a * 2.3;
            const sx = Math.cos(a) * r;
            const sy = Math.sin(a) * r;
            if (a === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
          }
          ctx.stroke();
          ctx.restore();
        }
      } else {
        // Comical flattened line eyes (— —)
        for (const side of [-1, 1]) {
          const ex = side * eyeSpacing;
          ctx.beginPath();
          ctx.moveTo(ex - 8, eyeY);
          ctx.lineTo(ex + 8, eyeY);
          ctx.stroke();
        }
      }
    } else if (emotion === 'STRETCHED') {
      // Surprised wide eyes "O O"
      for (const side of [-1, 1]) {
        const ex = side * eyeSpacing;
        ctx.beginPath();
        ctx.arc(ex, eyeY, 11, 0, Math.PI * 2);
        ctx.fill();

        // Big specular shine
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(ex - 3, eyeY - 3.5, 4.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2B1810';
      }
    } else if (emotion === 'SQUEEZED') {
      // Squished joyful "> <" eyes
      for (const side of [-1, 1]) {
        const ex = side * eyeSpacing;
        ctx.beginPath();
        ctx.moveTo(ex - side * 8, eyeY - 7);
        ctx.lineTo(ex + side * 7, eyeY);
        ctx.lineTo(ex - side * 8, eyeY + 7);
        ctx.stroke();
      }
    } else if (emotion === 'TWISTED') {
      // Playful spiral / wink eyes
      ctx.beginPath();
      ctx.arc(-eyeSpacing, eyeY + 3, 9, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();

      const ex = eyeSpacing;
      ctx.beginPath();
      ctx.arc(ex, eyeY, 8.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(ex - 2, eyeY - 2.5, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2B1810';
    } else if (emotion === 'BOUNCING') {
      // Joyful "^ ^" happy arcs
      for (const side of [-1, 1]) {
        const ex = side * eyeSpacing;
        ctx.beginPath();
        ctx.arc(ex, eyeY + 4, 10, Math.PI * 1.2, Math.PI * 1.8);
        ctx.stroke();
      }
    } else {
      // IDLE: blinking or big anime eyes
      if (isBlinking) {
        for (const side of [-1, 1]) {
          const ex = side * eyeSpacing;
          ctx.beginPath();
          ctx.arc(ex, eyeY + 4, 9, Math.PI * 1.2, Math.PI * 1.8);
          ctx.stroke();
        }
      } else {
        // Big sparkling kawaii eyes
        for (const side of [-1, 1]) {
          const ex = side * eyeSpacing;
          ctx.beginPath();
          ctx.ellipse(ex, eyeY, 8.5, 10.5, 0, 0, Math.PI * 2);
          ctx.fill();

          // Specular highlights
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(ex - 2.8, eyeY - 3.8, 3.8, 0, Math.PI * 2);
          ctx.arc(ex + 2.8, eyeY + 3.2, 1.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#2B1810';
        }
      }
    }

    // 3. Mouth
    const mouthY = eyeY + 15;
    ctx.strokeStyle = t.mouthColor;
    ctx.lineWidth = 3;

    if (emotion === 'FLATTENED') {
      // Dazed wavy squished line with comical tongue
      ctx.beginPath();
      ctx.moveTo(-11, mouthY);
      ctx.quadraticCurveTo(-5, mouthY - 4, 0, mouthY);
      ctx.quadraticCurveTo(5, mouthY + 4, 11, mouthY);
      ctx.stroke();

      // Comical tongue
      ctx.fillStyle = '#FF8DA1';
      ctx.beginPath();
      ctx.arc(3, mouthY + 2, 4.5, 0.1, Math.PI - 0.1);
      ctx.fill();
    } else if (emotion === 'STRETCHED') {
      ctx.fillStyle = t.mouthColor;
      ctx.beginPath();
      ctx.ellipse(0, mouthY + 1, 6, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (emotion === 'SQUEEZED') {
      ctx.beginPath();
      ctx.arc(-4, mouthY, 4.5, 0, Math.PI * 0.9);
      ctx.arc(4, mouthY, 4.5, 0.1, Math.PI);
      ctx.stroke();
    } else if (emotion === 'BOUNCING') {
      ctx.fillStyle = t.mouthColor;
      ctx.beginPath();
      ctx.arc(0, mouthY - 3, 9, 0.15, Math.PI - 0.15);
      ctx.closePath();
      ctx.fill();

      // Tongue
      ctx.fillStyle = '#FF8DA1';
      ctx.beginPath();
      ctx.arc(0, mouthY + 2, 5, 0.2, Math.PI - 0.2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(0, mouthY - 1, 7.5, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }

    ctx.restore();
  };

  // Helper: Draw orbiting cartoon dizzy stars when repeatedly struck / flat
  const drawDizzyStars = (ctx: CanvasRenderingContext2D, state: BreadPhysicsState, time: number) => {
    if (!state.isDizzy && state.flattenRatio < 0.38) return;
    const midIdx = Math.floor(state.nodes.length / 2);
    const midNode = state.nodes[midIdx];
    const vertFlatten = Math.max(0.24, 1 - state.flattenRatio * 0.72);
    const headY = midNode.y - midNode.currentRadius * vertFlatten - 24;

    ctx.save();
    const starCount = 4;
    for (let s = 0; s < starCount; s++) {
      const angle = state.dizzyTimer * 3.2 + (s * Math.PI * 2) / starCount;
      const radX = 52 + state.flattenRatio * 20;
      const radY = 16;
      const sx = midNode.x + Math.cos(angle) * radX;
      const sy = headY + Math.sin(angle) * radY;
      const depthScale = 0.75 + Math.sin(angle) * 0.35; // 3D orbit perspective

      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(depthScale, depthScale);
      ctx.rotate(time * 0.005 + s);

      // 5-point cartoon star
      ctx.fillStyle = s % 2 === 0 ? '#FFD43F' : '#FFAA29';
      ctx.strokeStyle = '#D97A1E';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let p = 0; p < 5; p++) {
        const aOut = (p * Math.PI * 2) / 5 - Math.PI / 2;
        const aIn = aOut + Math.PI / 5;
        const rOut = 9;
        const rIn = 4.2;
        if (p === 0) ctx.moveTo(Math.cos(aOut) * rOut, Math.sin(aOut) * rOut);
        else ctx.lineTo(Math.cos(aOut) * rOut, Math.sin(aOut) * rOut);
        ctx.lineTo(Math.cos(aIn) * rIn, Math.sin(aIn) * rIn);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Specular highlight dot
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(-1, -1, 1.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
    ctx.restore();
  };

  // Helper: Draw crumbs, stars, text and sparkle particles
  const drawParticles = (ctx: CanvasRenderingContext2D, dt: number) => {
    const list = particlesRef.current;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.life += 1;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.08; // gentle gravity
      p.alpha = Math.max(0, 1 - p.life / p.maxLife);

      if (p.life >= p.maxLife || p.alpha <= 0) {
        list.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;

      if (p.type === 'heart') {
        // Draw cute mini heart
        ctx.translate(p.x, p.y);
        ctx.beginPath();
        const s = p.size * 0.5;
        ctx.moveTo(0, s * 0.3);
        ctx.bezierCurveTo(-s, -s * 0.7, -s * 1.8, s * 0.6, 0, s * 1.8);
        ctx.bezierCurveTo(s * 1.8, s * 0.6, s, -s * 0.7, 0, s * 0.3);
        ctx.fill();
      } else if (p.type === 'star') {
        // Star particle from bonk impact
        ctx.translate(p.x, p.y);
        ctx.fillStyle = '#FFD13B';
        ctx.strokeStyle = '#E08018';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let k = 0; k < 5; k++) {
          const a1 = (k * Math.PI * 2) / 5 - Math.PI / 2;
          const a2 = a1 + Math.PI / 5;
          const ro = p.size;
          const ri = p.size * 0.45;
          if (k === 0) ctx.moveTo(Math.cos(a1) * ro, Math.sin(a1) * ro);
          else ctx.lineTo(Math.cos(a1) * ro, Math.sin(a1) * ro);
          ctx.lineTo(Math.cos(a2) * ri, Math.sin(a2) * ri);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (p.type === 'bonkText') {
        ctx.font = '800 17px "Outfit", "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#4A2818';
        ctx.strokeText(p.text || 'BONK!', p.x, p.y);
        ctx.fillStyle = '#FFDF59';
        ctx.fillText(p.text || 'BONK!', p.x, p.y);
      } else {
        // Sparkle or round crumb
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  };

  // Helper: Draw Toy Hammer with animated swing and impact
  const drawHammer = (ctx: CanvasRenderingContext2D, time: number) => {
    if (currentTool !== 'hammer') return;
    const isSwinging = hammerSwingRef.current.active;
    const isOver = cursorPosRef.current.isOver;
    if (!isOver && !isSwinging) return;

    const hitX = isSwinging ? hammerSwingRef.current.hitX : cursorPosRef.current.x;
    const hitY = isSwinging ? hammerSwingRef.current.hitY : cursorPosRef.current.y;

    let angle = -0.55; // ready angle (~ -31 degrees)
    let impactFlash = false;

    if (isSwinging) {
      const elapsed = time - hammerSwingRef.current.startTime;
      const p = Math.min(1, elapsed / hammerSwingRef.current.duration);
      if (p < 0.25) {
        // Wind-up back
        const wp = p / 0.25;
        angle = -0.55 - wp * 0.45;
      } else if (p < 0.65) {
        // Swift slam forward!
        const sp = (p - 0.25) / 0.4;
        angle = -1.0 + sp * 1.65; // slam to +37 deg
        if (sp > 0.75) impactFlash = true;
      } else {
        // Rebound ease
        const rp = (p - 0.65) / 0.35;
        angle = 0.65 - rp * 1.2;
      }
      if (p >= 1) {
        hammerSwingRef.current.active = false;
      }
    }

    ctx.save();
    ctx.translate(hitX, hitY);

    // Impact shockwave ring
    if (impactFlash) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 210, 60, 0.85)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 140, 40, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 36, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.rotate(angle);

    // Drop shadow
    ctx.save();
    ctx.translate(5, 7);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
    ctx.beginPath();
    ctx.roundRect(-6, -50, 12, 44, 4);
    ctx.roundRect(-22, -64, 44, 22, 6);
    ctx.fill();
    ctx.restore();

    // 1. Hammer Wooden Handle
    ctx.fillStyle = '#D99B66';
    ctx.beginPath();
    ctx.roundRect(-5, -50, 10, 48, [3, 3, 5, 5]);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#945C33';
    ctx.stroke();

    // Handle grip tape
    ctx.fillStyle = '#FFF8EE';
    for (let g = 0; g < 3; g++) {
      ctx.fillRect(-5, -24 + g * 7, 10, 3);
    }

    // Handle bottom button
    ctx.fillStyle = '#804824';
    ctx.beginPath();
    ctx.arc(0, -2, 5, 0, Math.PI * 2);
    ctx.fill();

    // 2. Toy Hammer Rubber Mallet Head (warm peach/toffee rubber)
    const headGrad = ctx.createLinearGradient(-22, -72, 22, -48);
    headGrad.addColorStop(0, '#FFA877');
    headGrad.addColorStop(0.5, '#FF8A50');
    headGrad.addColorStop(1, '#E6682E');

    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.roundRect(-22, -72, 44, 24, 8);
    ctx.fill();

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#B34515';
    ctx.stroke();

    // Silver metal band around mallet center
    ctx.fillStyle = '#E8ECEF';
    ctx.beginPath();
    ctx.roundRect(-6, -72, 12, 24, 2);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#9AA5B1';
    ctx.stroke();

    // Soft rubber impact pads
    ctx.fillStyle = '#FFE1D1';
    ctx.beginPath();
    ctx.roundRect(-24, -70, 4, 20, 2);
    ctx.roundRect(20, -70, 4, 20, 2);
    ctx.fill();

    // Cute smiley face on mallet head
    ctx.fillStyle = '#5A260F';
    ctx.beginPath();
    ctx.arc(10, -62, 1.8, 0, Math.PI * 2);
    ctx.arc(16, -62, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5A260F';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(13, -59, 2.5, 0.2, Math.PI - 0.2);
    ctx.stroke();

    ctx.restore();
  };

  // Pointer Interaction Handlers
  const handlePointerStart = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas || !stateRef.current) return;

    // Capture pointer
    canvas.setPointerCapture(e.pointerId);

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    cursorPosRef.current = { x, y, isOver: true };

    if (currentTool === 'hammer') {
      // Trigger dynamic hammer strike
      hammerSwingRef.current = {
        active: true,
        startTime: performance.now(),
        duration: 180,
        hitX: x,
        hitY: y,
      };

      const result = strikeBreadWithHammer(stateRef.current, x, y, 1.0);
      breadAudio.playHammerBonk(result.streak);

      // Particle bursts
      spawnParticles(x, y, 8, 'star');
      spawnParticles(x, y, 5, 'flour');
      const bonkLabel = result.streak > 2 ? `COMBO x${result.streak}!` : result.streak === 2 ? 'BONK x2!' : 'BONK!';
      spawnParticles(x, y, 1, 'bonkText', bonkLabel);

      if (result.isDizzy) {
        breadAudio.playFlattenedDizzyWobble();
        breadHaptics.dizzyWobble();
        setInteractionHint(`Pancake combo x${result.streak}! Bread is completely flat & dizzy! 💫`);
      } else {
        breadHaptics.hammerBonk();
        setInteractionHint('BONK! Flattened! Watch it gradually rise back up! 🥞');
      }
      onBreadInteract?.();
      return;
    }

    const hit = handlePointerDown(stateRef.current, e.pointerId, x, y);
    if (hit) {
      // Audio & haptic response on initial touch
      breadAudio.playSquish(0.45);
      breadHaptics.squish();
      spawnParticles(x, y, 4, 'flour');
      setInteractionHint('Keep squeezing or stretch it long!');
      onBreadInteract?.();
    }
  };

  const handlePointerDrag = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas || !stateRef.current) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    cursorPosRef.current = { x, y, isOver: true };

    if (currentTool === 'hammer') {
      return;
    }

    handlePointerMove(stateRef.current, e.pointerId, x, y);

    // If multiple fingers or moving fast, check for twist
    if (stateRef.current.activePointers.size > 1) {
      const pointers = Array.from(stateRef.current.activePointers.values());
      const p1 = pointers[0];
      const p2 = pointers[1];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (dist < 50) {
        // Pinching together = direct squeeze
        applySqueezeAt(stateRef.current, (p1.x + p2.x) * 0.5, (p1.y + p2.y) * 0.5, 0.4);
      }
    }
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas || !stateRef.current) return;

    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    if (currentTool === 'hammer') {
      return;
    }

    const res = handlePointerUp(stateRef.current, e.pointerId);
    if (res) {
      if (res.wasStretched || res.energy > 0.25) {
        breadAudio.playBoing(res.energy);
        breadHaptics.boing();
        const releasedNode = stateRef.current.nodes[res.releasedIndex];
        if (releasedNode) {
          spawnParticles(releasedNode.x, releasedNode.y, 8, 'sparkle');
        }
        setInteractionHint('Wobble wobble! Look at it bounce!');
      } else if (res.wasSqueezed) {
        breadAudio.playTwistSqueak();
        breadHaptics.squeak();
        setInteractionHint('Soft like a fresh warm cloud!');
      } else {
        breadAudio.playPat();
        breadHaptics.pat();
      }
    }
  };

  // Quick action buttons for convenience (Tap poke or squeak)
  const handleQuickPoke = () => {
    if (!stateRef.current) return;
    const midIdx = Math.floor(stateRef.current.nodes.length / 2);
    const node = stateRef.current.nodes[midIdx];
    node.vy += 45;
    applySqueezeAt(stateRef.current, node.x, node.y, 0.6);
    breadAudio.playSquish(0.8);
    breadHaptics.squish();
    spawnParticles(node.x, node.y, 6, 'heart');
    setInteractionHint('Squish! Cheeks puffed up with love!');
    onBreadInteract?.();
  };

  const handleQuickStretch = () => {
    if (!stateRef.current) return;
    const n = stateRef.current.nodes.length;
    stateRef.current.nodes[0].vx -= 65;
    stateRef.current.nodes[n - 1].vx += 65;
    breadAudio.playBoing(0.6);
    breadHaptics.boing();
    spawnParticles(stateRef.current.centerX, stateRef.current.centerY, 8, 'flour');
    setInteractionHint('Stretchy pull! Wheeeee!');
    onBreadInteract?.();
  };

  const handleQuickHammerBonk = () => {
    if (!stateRef.current) return;
    const midIdx = Math.floor(stateRef.current.nodes.length / 2);
    const midNode = stateRef.current.nodes[midIdx];

    hammerSwingRef.current = {
      active: true,
      startTime: performance.now(),
      duration: 180,
      hitX: midNode.x,
      hitY: midNode.y - 10,
    };
    cursorPosRef.current = { x: midNode.x, y: midNode.y - 10, isOver: true };

    const result = strikeBreadWithHammer(stateRef.current, midNode.x, midNode.y, 1.0);
    breadAudio.playHammerBonk(result.streak);

    spawnParticles(midNode.x, midNode.y, 8, 'star');
    spawnParticles(midNode.x, midNode.y, 5, 'flour');
    const bonkLabel = result.streak > 2 ? `COMBO x${result.streak}!` : result.streak === 2 ? 'BONK x2!' : 'BONK!';
    spawnParticles(midNode.x, midNode.y, 1, 'bonkText', bonkLabel);

    if (result.isDizzy) {
      breadAudio.playFlattenedDizzyWobble();
      breadHaptics.dizzyWobble();
      setInteractionHint(`Pancake combo x${result.streak}! Bread is completely flat & dizzy! 💫`);
    } else {
      breadHaptics.hammerBonk();
      setInteractionHint('BONK! Flattened into a pancake! Watch it rise back up! 🥞');
    }
    onBreadInteract?.();
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex flex-col items-center justify-center select-none touch-none overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        data-testid="squishy-bread-canvas"
        className={`w-full h-full touch-none select-none ${
          currentTool === 'hammer' ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
        }`}
        onPointerDown={handlePointerStart}
        onPointerMove={handlePointerDrag}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onPointerEnter={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          cursorPosRef.current = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            isOver: true,
          };
        }}
        onPointerLeave={() => {
          cursorPosRef.current.isOver = false;
        }}
      />

      {/* Dynamic Interaction Floating Hint */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none transition-all duration-300">
        <div className="bg-white/85 backdrop-blur-md px-4 py-1.5 rounded-full shadow-sm border border-[#F3E8DF] flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#E08D58] animate-pulse" />
          <span className="text-xs font-semibold tracking-wide text-[#6D5344] select-none whitespace-nowrap">
            {interactionHint}
          </span>
        </div>
      </div>

      {/* Floating Action Affordances at the bottom of the canvas */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-wrap items-center justify-center gap-2 z-10 px-3 max-w-full">
        {/* Tool Mode Pill Selector */}
        <div className="flex items-center bg-white/90 backdrop-blur-md p-1 rounded-full shadow-md border border-[#F3E8DF]">
          <button
            onClick={() => setTool('hand')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              currentTool === 'hand'
                ? 'bg-[#4A3B32] text-white shadow-xs'
                : 'text-[#6D5344] hover:text-[#4A3B32]'
            }`}
            aria-label="Hand Mode: Squish and stretch"
            title="Hand: Squish & Stretch"
          >
            <Hand className="w-3.5 h-3.5" />
            <span>Hand Mode</span>
          </button>
          <button
            onClick={() => setTool('hammer')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              currentTool === 'hammer'
                ? 'bg-[#E6682E] text-white shadow-xs'
                : 'text-[#6D5344] hover:text-[#E6682E]'
            }`}
            aria-label="Hammer Mode: Bonk and flatten"
            title="Hammer: Bonk & Flatten"
          >
            <Hammer className="w-3.5 h-3.5" />
            <span>Toy Mallet</span>
          </button>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleQuickHammerBonk}
            className="px-3.5 py-1.5 bg-gradient-to-r from-[#FF8A50] to-[#E6682E] hover:from-[#FF7A38] hover:to-[#D9571E] active:scale-95 transition-all text-xs font-bold text-white rounded-full shadow-md flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            title="Strike the bread with the hammer to flatten it"
            aria-label="Bonk bread with hammer"
          >
            <Hammer className="w-3.5 h-3.5" />
            <span>Bonk Flat!</span>
          </button>

          <button
            onClick={handleQuickPoke}
            className="px-3 py-1.5 bg-white/90 hover:bg-white active:scale-95 transition-all text-xs font-bold text-[#6D5344] rounded-full shadow-md border border-[#F3E8DF] flex items-center gap-1 whitespace-nowrap cursor-pointer"
            title="Poke the bread"
            aria-label="Poke bread"
          >
            <span>👆 Poke</span>
          </button>

          <button
            onClick={handleQuickStretch}
            className="px-3 py-1.5 bg-white/90 hover:bg-white active:scale-95 transition-all text-xs font-bold text-[#6D5344] rounded-full shadow-md border border-[#F3E8DF] flex items-center gap-1 whitespace-nowrap cursor-pointer"
            title="Stretch the bread"
            aria-label="Stretch bread"
          >
            <span>↔️ Stretch</span>
          </button>
        </div>
      </div>
    </div>
  );
};
