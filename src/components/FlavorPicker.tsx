/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BreadTheme, BREAD_THEMES } from '../types/breadTheme.ts';

interface FlavorPickerProps {
  currentTheme: BreadTheme;
  onSelectTheme: (theme: BreadTheme) => void;
}

export const FlavorPicker: React.FC<FlavorPickerProps> = ({
  currentTheme,
  onSelectTheme,
}) => {
  return (
    <div className="w-full flex items-center justify-center gap-2 px-4 py-2 select-none overflow-x-auto no-scrollbar">
      {BREAD_THEMES.map((theme) => {
        const isSelected = theme.id === currentTheme.id;
        return (
          <button
            key={theme.id}
            onClick={() => onSelectTheme(theme)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              isSelected
                ? 'bg-white border-[#D9822B] text-[#4A3B32] shadow-sm scale-102 ring-2 ring-[#FCE8CC]'
                : 'bg-white/70 hover:bg-white border-[#EDE4DB] text-[#7A6455] hover:text-[#4A3B32]'
            }`}
            aria-pressed={isSelected}
            aria-label={`Select ${theme.name} flavor`}
          >
            {/* Color swatch circle */}
            <span
              className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0"
              style={{ backgroundColor: theme.bodyColor }}
            />
            <span>{theme.name}</span>
          </button>
        );
      })}
    </div>
  );
};
