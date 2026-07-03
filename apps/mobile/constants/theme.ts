/** Central design tokens so screens stay visually consistent. */
export const theme = {
  colors: {
    bg: '#0B0E1A',
    surface: '#151A2E',
    surfaceAlt: '#1E2540',
    border: '#2A3255',
    text: '#F2F4FF',
    textDim: '#8A93B8',
    accent: '#F5A524', // eurobasket orange
    accentAlt: '#3B82F6',
    win: '#22C55E',
    loss: '#EF4444',
  },
  spacing: (n: number) => n * 8,
  radius: 14,
} as const;

export type Theme = typeof theme;
