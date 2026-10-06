/**
 * Theme tokens (ink-indigo + azure). They are exposed to CSS as custom properties
 * (`--color-bg`, `--color-accent`, ...) by `themeCssVariables` and reused by the
 * PWA manifest so the installed app matches the in-app colours.
 */
export const themeTokens = {
  colorBg: '#070d1f',
  colorBgElevated: '#0e1731',
  colorSurface: '#14204a',
  colorSurfaceHigh: '#16245a',
  colorBorder: '#1d2a55',
  colorText: '#eaf0ff',
  colorTextMuted: '#8d9abf',
  colorAccent: '#5b8cff',
  colorAccentBright: '#9db8ff',
  colorAccentDeep: '#3f6fe8',
  colorAccentAlt: '#7ae0ff',
  colorOnAccent: '#06112b',
  colorCore: '#f2c14e',
  colorRotation: '#5cc8ff',
  colorSubstitute: '#a99bff',
  colorNotSelected: '#6b7a99',
  colorSuccess: '#4ade9b',
  colorDanger: '#ff6b6b',
  colorWarning: '#ffb547',
  radiusSm: '10px',
  radiusMd: '14px',
  radiusLg: '20px',
  touchTarget: '48px',
  fontFamily: "'Manrope', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  fontDisplay: "'Sora', 'Manrope', system-ui, sans-serif",
} as const;

export type ThemeTokens = typeof themeTokens;

/** Converts camelCase token names to `--kebab-case` CSS custom properties. */
export function themeCssVariables(tokens: ThemeTokens = themeTokens): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(tokens)) {
    const kebab = key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
    vars[`--${kebab}`] = value;
  }
  return vars;
}
