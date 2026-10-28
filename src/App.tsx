/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useCallback } from 'react';
import { ControlsHeader } from './components/ControlsHeader.tsx';
import { FlavorPicker } from './components/FlavorPicker.tsx';
import { SquishyBreadCanvas } from './components/SquishyBreadCanvas.tsx';
import { StressReliefFooter } from './components/StressReliefFooter.tsx';
import { BREAD_THEMES, BreadTheme } from './types/breadTheme.ts';

export default function App() {
  const [currentTheme, setCurrentTheme] = useState<BreadTheme>(BREAD_THEMES[0]);
  const [isSoundMuted, setIsSoundMuted] = useState<boolean>(() => {
    try {
      return localStorage.getItem('squishy_bread_mute') === 'true';
    } catch {
      return false;
    }
  });
  const [isHapticsEnabled, setIsHapticsEnabled] = useState<boolean>(() => {
    try {
      const val = localStorage.getItem('squishy_bread_haptics');
      return val !== null ? val === 'true' : true;
    } catch {
      return true;
    }
  });
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const [squishCount, setSquishCount] = useState<number>(0);
  const [activeTool, setActiveTool] = useState<'hand' | 'hammer'>('hand');

  const resetRef = useRef<(() => void) | null>(null);

  const handleToggleSound = useCallback(() => {
    setIsSoundMuted((prev) => !prev);
  }, []);

  const handleToggleHaptics = useCallback(() => {
    setIsHapticsEnabled((prev) => !prev);
  }, []);

  const handleToggleReducedMotion = useCallback(() => {
    setReducedMotion((prev) => !prev);
  }, []);

  const handleResetBread = useCallback(() => {
    if (resetRef.current) {
      resetRef.current();
    }
  }, []);

  const handleBreadInteract = useCallback(() => {
    setSquishCount((c) => c + 1);
  }, []);

  return (
    <div className="relative w-screen h-screen flex flex-col justify-between overflow-hidden bg-[#FFFDF7] font-['Plus_Jakarta_Sans',sans-serif] text-[#4A3B32]">
      {/* Background Soft Table Mat Glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background: 'radial-gradient(circle at 50% 50%, #FFEFC2 0%, #FFFDF7 70%)',
        }}
        aria-hidden="true"
      />

      {/* Top Header Bar */}
      <ControlsHeader
        isSoundMuted={isSoundMuted}
        onToggleSound={handleToggleSound}
        isHapticsEnabled={isHapticsEnabled}
        onToggleHaptics={handleToggleHaptics}
        onResetBread={handleResetBread}
        reducedMotion={reducedMotion}
        onToggleReducedMotion={handleToggleReducedMotion}
        activeTool={activeTool}
        onSelectTool={setActiveTool}
      />

      {/* Bread Flavor Quick Picker */}
      <div className="w-full shrink-0 z-20 pt-1">
        <FlavorPicker
          currentTheme={currentTheme}
          onSelectTheme={setCurrentTheme}
        />
      </div>

      {/* Main Interactive Play Surface */}
      <main className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden touch-none select-none">
        <SquishyBreadCanvas
          theme={currentTheme}
          isSoundMuted={isSoundMuted}
          isHapticsEnabled={isHapticsEnabled}
          reducedMotion={reducedMotion}
          onResetRef={resetRef}
          onBreadInteract={handleBreadInteract}
          activeTool={activeTool}
          onSelectTool={setActiveTool}
        />
      </main>

      {/* Peaceful Status Footer */}
      <StressReliefFooter squishCount={squishCount} />
    </div>
  );
}
