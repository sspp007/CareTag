/**
 * ISO 3758 Standard Laundry Symbol Registry & SVG Renderers
 * 5 Standard Families:
 * 1. Washtub (Washing)
 * 2. Triangle (Bleaching)
 * 3. Square (Drying)
 * 4. Iron (Ironing)
 * 5. Circle (Professional Care)
 */

export const SYMBOL_FAMILIES = {
  Washing: {
    name: 'Washing',
    badgeColor: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40',
    iconColor: '#38bdf8',
    description: 'Water temperature & mechanical cycle'
  },
  Bleaching: {
    name: 'Bleaching',
    badgeColor: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
    iconColor: '#fbbf24',
    description: 'Chlorine & non-chlorine bleach agents'
  },
  Drying: {
    name: 'Drying',
    badgeColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    iconColor: '#34d399',
    description: 'Tumble drying & natural line drying'
  },
  Ironing: {
    name: 'Ironing',
    badgeColor: 'bg-violet-500/15 text-violet-300 border-violet-500/40',
    iconColor: '#a78bfa',
    description: 'Soleplate temperature & steam settings'
  },
  'Professional Care': {
    name: 'Professional Care',
    badgeColor: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
    iconColor: '#f43f5e',
    description: 'Dry cleaning & wet cleaning methods'
  },
  Detected: {
    name: 'Detected',
    badgeColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    iconColor: '#34d399',
    description: 'Recognized care instruction'
  }
};

/**
 * Returns an inline SVG string for known ISO 3758 symbol IDs
 */
export function getSymbolSvg(symbolId, size = 36) {
  const stroke = 'currentColor';
  const strokeWidth = '2';

  switch (symbolId) {
    // --- WASHING (WASHTUB) ---
    case 'washtub_30':
      return `
        <svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
          <path d="M7 16h34l-3.2 18.2a4 4 0 0 1-3.9 3.3H14.1a4 4 0 0 1-3.9-3.3L7 16Z"/>
          <path d="M7 21c3.5 1.5 6.5 1.5 10 0s6.5-1.5 10 0 6.5 1.5 10 0 3-1 4-1"/>
          <text x="24" y="32" font-size="10" font-weight="bold" fill="${stroke}" stroke="none" text-anchor="middle" font-family="monospace">30°</text>
        </svg>`;
    
    case 'washtub_40':
      return `
        <svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
          <path d="M7 16h34l-3.2 18.2a4 4 0 0 1-3.9 3.3H14.1a4 4 0 0 1-3.9-3.3L7 16Z"/>
          <path d="M7 21c3.5 1.5 6.5 1.5 10 0s6.5-1.5 10 0 6.5 1.5 10 0 3-1 4-1"/>
          <text x="24" y="32" font-size="10" font-weight="bold" fill="${stroke}" stroke="none" text-anchor="middle" font-family="monospace">40°</text>
        </svg>`;

    case 'washtub_60':
      return `
        <svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
          <path d="M7 16h34l-3.2 18.2a4 4 0 0 1-3.9 3.3H14.1a4 4 0 0 1-3.9-3.3L7 16Z"/>
          <path d="M7 21c3.5 1.5 6.5 1.5 10 0s6.5-1.5 10 0 6.5 1.5 10 0 3-1 4-1"/>
          <text x="24" y="32" font-size="10" font-weight="bold" fill="${stroke}" stroke="none" text-anchor="middle" font-family="monospace">60°</text>
        </svg>`;

    case 'washtub_95':
      return `
        <svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
          <path d="M7 16h34l-3.2 18.2a4 4 0 0 1-3.9 3.3H14.1a4 4 0 0 1-3.9-3.3L7 16Z"/>
          <path d="M7 21c3.5 1.5 6.5 1.5 10 0s6.5-1.5 10 0 6.5 1.5 10 0 3-1 4-1"/>
          <text x="24" y="32" font-size="10" font-weight="bold" fill="${stroke}" stroke="none" text-anchor="middle" font-family="monospace">95°</text>
        </svg>`;

    case 'washtub_hand':
      return `
        <svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
          <path d="M7 18h34l-3.2 17.2a4 4 0 0 1-3.9 3.3H14.1a4 4 0 0 1-3.9-3.3L7 18Z"/>
          <path d="M7 23c3.5 1.5 6.5 1.5 10 0s6.5-1.5 10 0 6.5 1.5 10 0"/>
          <path d="M24 10v7M21 12v5M27 12v5M24 19a2 2 0 0 0 2-2V8a1 1 0 0 0-2 0v2"/>
        </svg>`;

    case 'washtub_crossed':
      return `
        <svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
          <path d="M7 18h34l-3.2 17.2a4 4 0 0 1-3.9 3.3H14.1a4 4 0 0 1-3.9-3.3L7 18Z"/>
          <line x1="10" y1="12" x2="38" y2="38" stroke-width="2.5" />
          <line x1="38" y1="12" x2="10" y2="38" stroke-width="2.5" />
        </svg>`;

    // --- BLEACHING (TRIANGLE) ---
    case 'triangle_crossed':
      return `
        <svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="24,8 41,38 7,38" />
          <line x1="12" y1="14" x2="36" y2="38" stroke-width="2.5" />
          <line x1="36" y1="14" x2="12" y2="38" stroke-width="2.5" />
        </svg>`;

    case 'triangle_any':
      return `
        <svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="24,8 41,38 7,38" />
        </svg>`;

    // --- DRYING (SQUARE / TUMBLE DRY) ---
    case 'square_circle_1dot':
      return `
        <svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
          <rect x="8" y="8" width="32" height="32" rx="3" />
          <circle cx="24" cy="24" r="12" />
          <circle cx="24" cy="24" r="2.5" fill="${stroke}" stroke="none" />
        </svg>`;

    case 'square_circle_2dots':
      return `
        <svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
          <rect x="8" y="8" width="32" height="32" rx="3" />
          <circle cx="24" cy="24" r="12" />
          <circle cx="20" cy="24" r="2" fill="${stroke}" stroke="none" />
          <circle cx="28" cy="24" r="2" fill="${stroke}" stroke="none" />
        </svg>`;

    case 'square_crossed':
      return `
        <svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
          <rect x="8" y="8" width="32" height="32" rx="3" />
          <circle cx="24" cy="24" r="12" />
          <line x1="10" y1="10" x2="38" y2="38" stroke-width="2.5" />
          <line x1="38" y1="10" x2="10" y2="38" stroke-width="2.5" />
        </svg>`;

    // --- IRONING (IRON) ---
    case 'iron_1dot':
      return `
        <svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 32h30a4 4 0 0 0 4-4c0-5-5-12-14-12H8v16Z" />
          <path d="M12 16V12h14" />
          <circle cx="24" cy="26" r="2" fill="${stroke}" stroke="none" />
        </svg>`;

    case 'iron_2dots':
      return `
        <svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 32h30a4 4 0 0 0 4-4c0-5-5-12-14-12H8v16Z" />
          <path d="M12 16V12h14" />
          <circle cx="20" cy="26" r="2" fill="${stroke}" stroke="none" />
          <circle cx="28" cy="26" r="2" fill="${stroke}" stroke="none" />
        </svg>`;

    case 'iron_3dots':
      return `
        <svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 32h30a4 4 0 0 0 4-4c0-5-5-12-14-12H8v16Z" />
          <path d="M12 16V12h14" />
          <circle cx="17" cy="26" r="2" fill="${stroke}" stroke="none" />
          <circle cx="24" cy="26" r="2" fill="${stroke}" stroke="none" />
          <circle cx="31" cy="26" r="2" fill="${stroke}" stroke="none" />
        </svg>`;

    case 'iron_crossed':
      return `
        <svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 32h30a4 4 0 0 0 4-4c0-5-5-12-14-12H8v16Z" />
          <path d="M12 16V12h14" />
          <line x1="10" y1="10" x2="38" y2="38" stroke-width="2.5" />
          <line x1="38" y1="10" x2="10" y2="38" stroke-width="2.5" />
        </svg>`;

    // --- PROFESSIONAL CARE (CIRCLE) ---
    case 'circle_p':
      return `
        <svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="24" cy="24" r="15" />
          <text x="24" y="30" font-size="16" font-weight="bold" fill="${stroke}" stroke="none" text-anchor="middle" font-family="sans-serif">P</text>
        </svg>`;

    case 'circle_crossed':
      return `
        <svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="24" cy="24" r="15" />
          <line x1="10" y1="10" x2="38" y2="38" stroke-width="2.5" />
          <line x1="38" y1="10" x2="10" y2="38" stroke-width="2.5" />
        </svg>`;

    default:
      return `
        <svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
          <rect x="10" y="10" width="28" height="28" rx="6" stroke-dasharray="4 2" />
          <circle cx="24" cy="24" r="4" />
        </svg>`;
  }
}
