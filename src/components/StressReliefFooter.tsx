/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface StressReliefFooterProps {
  squishCount: number;
}

export const StressReliefFooter: React.FC<StressReliefFooterProps> = ({ squishCount }) => {
  return (
    <footer className="w-full border-t border-[#F5EBE1] bg-[#FFFDF7]/95 px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2 select-none z-20 text-xs text-[#8A7263]">
      {/* Interaction hints */}
      <div className="flex flex-wrap items-center gap-3 text-[11px] sm:text-xs">
        <span className="flex items-center gap-1 font-medium">
          <span className="text-sm">🤏</span> Squeeze
        </span>
        <span className="text-[#DAC9BC]" aria-hidden="true">·</span>
        <span className="flex items-center gap-1 font-medium">
          <span className="text-sm">↔️</span> Stretch
        </span>
        <span className="text-[#DAC9BC]" aria-hidden="true">·</span>
        <span className="flex items-center gap-1 font-medium">
          <span className="text-sm">🔨</span> Hammer Bonk
        </span>
        <span className="text-[#DAC9BC]" aria-hidden="true">·</span>
        <span className="flex items-center gap-1 font-medium">
          <span className="text-sm">🌀</span> Twist
        </span>
        <span className="text-[#DAC9BC]" aria-hidden="true">·</span>
        <span className="flex items-center gap-1 font-medium">
          <span className="text-sm">💫</span> Release & Wobble
        </span>
      </div>

      {/* Gentle squish tally */}
      <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold text-[#6D5344] tabular-nums">
        <span>Relaxing squishes:</span>
        <span className="px-2 py-0.5 rounded-md bg-[#FFF2DE] text-[#B8681A] font-bold">
          {squishCount}
        </span>
      </div>
    </footer>
  );
};
