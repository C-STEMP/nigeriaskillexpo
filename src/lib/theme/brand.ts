/**
 * Nigeria Skills Expo brand tokens — single source of truth.
 * Both tailwind.config.ts and the AntD ConfigProvider (src/lib/theme/antd-theme.ts)
 * import from here, so the brand only ever needs to change in one place.
 */
export const brand = {
  primary: "#aa1d3f", // Nigeria Skills Expo maroon
  primaryAccent: "#f8eaeb", // pale accent of primary, used for soft backgrounds/badges
  secondary: "#f9a825", // amber/gold — matches logo dots
  ink: "#1d293d", // "black" — body text, headers
  grey: "#ededf0", // supporting neutral surface
} as const;

export type BrandColor = keyof typeof brand;
