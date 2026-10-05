/**
 * Theme tokens (navy + gold). They are exposed to CSS as custom properties
 * (`--color-bg`, `--color-gold`, ...) by `themeCssVariables` and reused by the
 * PWA manifest so the installed app matches the in-app colours.
 */
export const themeTokens = {
  colorBg: '#0a1630',
  colorBgElevated: '#11234a',
  colorSurface: '#162c5c',
  colorSurfaceHigh: '#1e3a74',
  colorBorder: '#2b4a8a',
  colorText: '#eef2fb',
  colorTextMuted: '#a9b6d3',
  colorGold: '#e8b73a',
  colorGoldBright: '#ffd36b',
  colorGoldDeep: '#b8871a',
  colorOnGold: '#1a1300',
  colorCore: '#e8b73a',
  colorRotation: '#4fa3ff',
  colorSubstitute: '#9b8cff',
  colorNotSelected: '#6b7a99',
  colorSuccess: '#3fcf8e',
  colorDanger: '#ff6b6b',
  colorWarning: '#ffb547',
  radiusSm: '8px',
  radiusMd: '12px',
  radiusLg: '18px',
  touchTarget: '48px',
  fontFamily:
    "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
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
