/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Volume2, VolumeX, Smartphone, RotateCcw, Sliders, Check, Hammer, Hand } from 'lucide-react';

interface ControlsHeaderProps {
  isSoundMuted: boolean;
  onToggleSound: () => void;
  isHapticsEnabled: boolean;
  onToggleHaptics: () => void;
  onResetBread: () => void;
  reducedMotion: boolean;
  onToggleReducedMotion: () => void;
  activeTool?: 'hand' | 'hammer';
  onSelectTool?: (tool: 'hand' | 'hammer') => void;
}

export const ControlsHeader: React.FC<ControlsHeaderProps> = ({
  isSoundMuted,
  onToggleSound,
  isHapticsEnabled,
  onToggleHaptics,
  onResetBread,
  reducedMotion,
  onToggleReducedMotion,
  activeTool = 'hand',
  onSelectTool,
}) => {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      <header className="w-full flex items-center justify-between gap-4 px-5 py-3.5 border-b border-[#F5EBE1] bg-[#FFFDF7]/95 backdrop-blur-md z-30 select-none">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-2">
          <span className="text-xl" role="img" aria-label="bread icon">🍞</span>
          <h1 className="text-base sm:text-lg font-bold tracking-tight text-[#4A3B32] whitespace-nowrap">
            Squishy Bread
          </h1>
          <span className="hidden sm:inline-block text-xs font-medium text-[#A68A78] ml-1">
            · Stress-Relief Toy
          </span>
        </div>

        {/* Zone 2 & 3: Controls */}
        <div className="flex items-center gap-2">
          {/* Tool Mode Quick Switcher */}
          {onSelectTool && (
            <button
              onClick={() => onSelectTool(activeTool === 'hammer' ? 'hand' : 'hammer')}
              className={`min-h-[44px] px-3 py-2 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
                activeTool === 'hammer'
                  ? 'bg-[#FFF2EB] text-[#E6682E] border-[#FFCDB2] shadow-xs'
                  : 'bg-white text-[#6D5344] border-[#EDE4DB] hover:bg-[#FFF8F2]'
              }`}
              aria-label={activeTool === 'hammer' ? 'Switch to Hand Squish mode' : 'Switch to Toy Hammer mode'}
              title={activeTool === 'hammer' ? 'Active: Toy Hammer (Click for Hand Mode)' : 'Active: Hand (Click for Toy Hammer)'}
            >
              {activeTool === 'hammer' ? (
                <>
                  <Hammer className="w-4 h-4 text-[#E6682E]" />
                  <span className="hidden sm:inline">Toy Hammer</span>
                </>
              ) : (
                <>
                  <Hand className="w-4 h-4 text-[#8A7263]" />
                  <span className="hidden sm:inline">Hand Mode</span>
                </>
              )}
            </button>
          )}
          {/* Sound Toggle */}
          <button
            onClick={onToggleSound}
            className={`min-h-[44px] min-w-[44px] p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-center ${
              !isSoundMuted
                ? 'bg-[#FFF7E6] text-[#D9822B] border-[#F2DEB6] shadow-xs hover:bg-[#FFEFD1]'
                : 'bg-white text-[#9C8577] border-[#EDE4DB] hover:text-[#5C4537]'
            }`}
            aria-label={isSoundMuted ? 'Unmute sound effects' : 'Mute sound effects'}
            title={isSoundMuted ? 'Sound: Muted (Click to Unmute)' : 'Sound: Playing'}
          >
            {isSoundMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>

          {/* Haptics Toggle */}
          <button
            onClick={onToggleHaptics}
            className={`min-h-[44px] min-w-[44px] p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-center ${
              isHapticsEnabled
                ? 'bg-[#FFF7E6] text-[#D9822B] border-[#F2DEB6] shadow-xs hover:bg-[#FFEFD1]'
                : 'bg-white text-[#9C8577] border-[#EDE4DB] hover:text-[#5C4537]'
            }`}
            aria-label={isHapticsEnabled ? 'Disable vibrations' : 'Enable vibrations'}
            title={isHapticsEnabled ? 'Vibration: Enabled' : 'Vibration: Disabled'}
          >
            <Smartphone className="w-5 h-5" />
          </button>

          {/* Reset Bread */}
          <button
            onClick={onResetBread}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white hover:bg-[#FFF8F2] active:scale-95 text-[#6D5344] font-semibold text-xs border border-[#EDE4DB] shadow-xs transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
            aria-label="Reset bread shape"
            title="Reset to fresh shape"
          >
            <RotateCcw className="w-4 h-4 text-[#D9822B]" />
            <span className="hidden xs:inline">Reset</span>
          </button>

          {/* Extra Preferences / Accessibility */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl bg-white hover:bg-[#FFF8F2] text-[#6D5344] border border-[#EDE4DB] shadow-xs transition-all cursor-pointer flex items-center justify-center"
            aria-label="Toy preferences and accessibility"
            title="Preferences"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Preferences Dialog / Modal */}
      {showSettings && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-xs p-4 select-none"
          onClick={() => setShowSettings(false)}
        >
          <div
            className="w-full max-w-sm bg-[#FFFDF7] rounded-3xl p-6 shadow-xl border border-[#F2DEB6] space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#F5EBE1] pb-3">
              <h2 className="text-base font-bold text-[#4A3B32]">Toy Settings & Comfort</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="w-8 h-8 rounded-full bg-[#F5EBE1] hover:bg-[#EBE0D5] flex items-center justify-center text-sm font-bold text-[#6D5344] cursor-pointer"
                aria-label="Close settings"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-sm text-[#5C4537]">
              {/* Sound Option */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-[#4A3B32]">Sound Effects</div>
                  <div className="text-xs text-[#9C8577]">Procedural squish and boing audio</div>
                </div>
                <button
                  onClick={onToggleSound}
                  className={`w-12 h-7 rounded-full p-1 transition-colors cursor-pointer ${
                    !isSoundMuted ? 'bg-[#D9822B]' : 'bg-[#E0D5CB]'
                  }`}
                  aria-label="Toggle Sound"
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      !isSoundMuted ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Haptic Option */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-[#4A3B32]">Haptic Vibrations</div>
                  <div className="text-xs text-[#9C8577]">Gentle tactile response on touch</div>
                </div>
                <button
                  onClick={onToggleHaptics}
                  className={`w-12 h-7 rounded-full p-1 transition-colors cursor-pointer ${
                    isHapticsEnabled ? 'bg-[#D9822B]' : 'bg-[#E0D5CB]'
                  }`}
                  aria-label="Toggle Haptics"
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      isHapticsEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Accessibility: Reduced Motion */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-[#4A3B32]">Reduced Animations</div>
                  <div className="text-xs text-[#9C8577]">Calmer physics and no floating particles</div>
                </div>
                <button
                  onClick={onToggleReducedMotion}
                  className={`w-12 h-7 rounded-full p-1 transition-colors cursor-pointer ${
                    reducedMotion ? 'bg-[#D9822B]' : 'bg-[#E0D5CB]'
                  }`}
                  aria-label="Toggle Reduced Motion"
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      reducedMotion ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-[#F5EBE1]">
              <button
                onClick={() => setShowSettings(false)}
                className="w-full py-2.5 rounded-xl bg-[#D9822B] text-white font-bold text-xs hover:bg-[#C27120] active:scale-98 transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
