import type { ThemeConfig } from "antd";
import { brand } from "./brand";

/**
 * Ant Design theme override. Passed to <ConfigProvider theme={antdTheme}>
 * at the root layout so every AntD component (Table, Button, Form, etc.)
 * inherits the Nigeria Skills Expo palette instead of AntD's default blue.
 */
export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: brand.primary,
    colorInfo: brand.primary,
    colorTextBase: brand.ink,
    colorBgLayout: "#ffffff",
    colorBorderSecondary: brand.grey,
    borderRadius: 10,
    fontFamily:
      "var(--font-body), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  components: {
    Button: {
      colorPrimary: brand.primary,
      algorithm: true,
      primaryShadow: "none",
    },
    Table: {
      headerBg: brand.ink,
      headerColor: "#ffffff",
      rowHoverBg: brand.primaryAccent,
      borderColor: brand.grey,
    },
    Tag: {
      defaultBg: brand.grey,
    },
    Menu: {
      itemSelectedBg: brand.primaryAccent,
      itemSelectedColor: brand.primary,
    },
    Tabs: {
      itemSelectedColor: brand.primary,
      inkBarColor: brand.secondary,
    },
    Progress: {
      defaultColor: brand.secondary,
    },
  },
};
