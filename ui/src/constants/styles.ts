/**
 * Shared UI style constants
 */

// Button styles
export const BUTTON_BASE_STYLES = `
  min-h-[44px] px-3 py-2 sm:min-h-0 sm:px-4 sm:py-1.5
  bg-bg-secondary border border-neon-cyan/50 text-neon-cyan
  rounded-md text-xs sm:text-sm font-medium
  hover:bg-neon-cyan/10 hover:border-neon-cyan
  hover:shadow-[0_0_10px_rgba(0,255,255,0.3)]
  active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed
  touch-manipulation transition-all duration-300
`;

export const BUTTON_SECONDARY_STYLES = `
  flex-1 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg
  border border-white/20 transition-all duration-200
  min-h-[44px] sm:min-h-0 touch-manipulation
  bg-white/5 text-white hover:bg-white/10 hover:border-white/30
`;

export const BUTTON_PRIMARY_STYLES = `
  flex-1 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg
  border border-neon-cyan/30 transition-all duration-200
  min-h-[44px] sm:min-h-0 touch-manipulation
  bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20 hover:border-neon-cyan/50
`;
