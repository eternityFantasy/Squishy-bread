/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class HapticsManager {
  private enabled: boolean = true;

  constructor() {
    try {
      const saved = localStorage.getItem('squishy_bread_haptics');
      if (saved !== null) {
        this.enabled = saved === 'true';
      }
    } catch {
      // ignore
    }
  }

  public setEnabled(val: boolean): void {
    this.enabled = val;
    try {
      localStorage.setItem('squishy_bread_haptics', String(val));
    } catch {
      // ignore
    }
  }

  public getEnabled(): boolean {
    return this.enabled;
  }

  public toggle(): boolean {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  private trigger(pattern: number | number[]): void {
    if (!this.enabled) return;
    if (typeof window !== 'undefined' && 'navigator' in window && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(pattern);
      } catch {
        // unsupported or permissions policy block
      }
    }
  }

  /**
   * Soft vibration on squish
   */
  public squish(): void {
    this.trigger(12);
  }

  /**
   * Stretchy incremental tick
   */
  public stretchTick(): void {
    this.trigger(8);
  }

  /**
   * Playful squeak pulse
   */
  public squeak(): void {
    this.trigger([10, 20, 10]);
  }

  /**
   * Satisfying bouncy spring release
   */
  public boing(): void {
    this.trigger([15, 30, 25]);
  }

  /**
   * Gentle pet / pat
   */
  public pat(): void {
    this.trigger(6);
  }

  /**
   * Crisp energetic hammer impact
   */
  public hammerBonk(): void {
    this.trigger([25, 30, 20]);
  }

  /**
   * Playful comic dizzy wobble vibration
   */
  public dizzyWobble(): void {
    this.trigger([12, 18, 12, 18, 12]);
  }
}

export const breadHaptics = new HapticsManager();
