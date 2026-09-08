// Port of lib/flutter_flow/flutter_flow_theme.dart.
//
// The palette itself lives in css/app.css as custom properties (so it follows
// the platform theme exactly like ThemeMode.system does); this module exposes
// the same names to JS plus the typography scale.

const cssVar = (name) => `var(${name})`;

export const TH = {
  primary: cssVar('--primary'),
  secondary: cssVar('--secondary'),
  tertiary: cssVar('--tertiary'),
  alternate: cssVar('--alternate'),
  primaryText: cssVar('--primary-text'),
  secondaryText: cssVar('--secondary-text'),
  primaryBackground: cssVar('--primary-background'),
  secondaryBackground: cssVar('--secondary-background'),
  accent1: cssVar('--accent1'),
  accent2: cssVar('--accent2'),
  accent3: cssVar('--accent3'),
  accent4: cssVar('--accent4'),
  success: cssVar('--success'),
  warning: cssVar('--warning'),
  error: cssVar('--error'),
  info: cssVar('--info'),
};

const INTER_TIGHT = 'Inter Tight';
const INTER = 'Inter';

/** ThemeTypography, one entry per named style. */
const TYPOGRAPHY = {
  displayLarge: { fontFamily: INTER_TIGHT, fontWeight: 600, fontSize: 64, color: TH.primaryText },
  displayMedium: { fontFamily: INTER_TIGHT, fontWeight: 600, fontSize: 44, color: TH.primaryText },
  displaySmall: { fontFamily: INTER_TIGHT, fontWeight: 600, fontSize: 36, color: TH.primaryText },
  headlineLarge: { fontFamily: INTER_TIGHT, fontWeight: 600, fontSize: 32, color: TH.primaryText },
  headlineMedium: { fontFamily: INTER_TIGHT, fontWeight: 600, fontSize: 28, color: TH.primaryText },
  headlineSmall: { fontFamily: INTER_TIGHT, fontWeight: 600, fontSize: 24, color: TH.primaryText },
  titleLarge: { fontFamily: INTER_TIGHT, fontWeight: 600, fontSize: 20, color: TH.primaryText },
  titleMedium: { fontFamily: INTER_TIGHT, fontWeight: 600, fontSize: 18, color: TH.primaryText },
  titleSmall: { fontFamily: INTER_TIGHT, fontWeight: 600, fontSize: 16, color: TH.primaryText },
  labelLarge: { fontFamily: INTER, fontWeight: 400, fontSize: 16, color: TH.secondaryText },
  labelMedium: { fontFamily: INTER, fontWeight: 400, fontSize: 14, color: TH.secondaryText },
  labelSmall: { fontFamily: INTER, fontWeight: 400, fontSize: 12, color: TH.secondaryText },
  bodyLarge: { fontFamily: INTER, fontWeight: 400, fontSize: 16, color: TH.primaryText },
  bodyMedium: { fontFamily: INTER, fontWeight: 400, fontSize: 14, color: TH.primaryText },
  bodySmall: { fontFamily: INTER, fontWeight: 400, fontSize: 12, color: TH.primaryText },
};

/**
 * `FlutterFlowTheme.of(context).bodyMedium.override({...})`.
 * Overrides merge onto the base style, exactly like TextStyle.copyWith - an
 * omitted field keeps the base value.
 */
export function textStyle(name, overrides = {}) {
  const base = TYPOGRAPHY[name];
  if (!base) throw new Error(`unknown text style: ${name}`);
  return { ...base, ...overrides };
}

/** Shorthand: `style('bodyMedium', { fontSize: 24 })`. */
export const style = textStyle;
