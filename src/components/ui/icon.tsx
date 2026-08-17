"use client";

import {
  TeamOutlined,
  GlobalOutlined,
  ApartmentOutlined,
  SafetyCertificateOutlined,
  ClockCircleOutlined,
  TrophyOutlined,
  BulbOutlined,
  CheckSquareOutlined,
} from "@ant-design/icons";

/**
 * AntD icon components internally rely on React Context (for theme/size
 * inheritance), which requires Client Component semantics. Importing them
 * directly into a Server Component (e.g. a page that does `await auth()`
 * or Prisma calls with no "use client") causes a
 * "createContext is not a function" crash at runtime, because nothing in
 * that module tree opted into client rendering.
 *
 * Fix: centralize every icon used by Server Components behind this one
 * "use client" module, keyed by name. Server Components pass a STRING key
 * (e.g. iconName="TeamOutlined") instead of constructing the icon element
 * directly — the actual <TeamOutlined /> JSX only ever gets created here,
 * inside a Client Component boundary.
 */
const ICONS = {
  TeamOutlined,
  GlobalOutlined,
  ApartmentOutlined,
  SafetyCertificateOutlined,
  ClockCircleOutlined,
  TrophyOutlined,
  BulbOutlined,
  CheckSquareOutlined,
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, className }: { name: IconName; className?: string }) {
  const Component = ICONS[name];
  return <Component className={className} />;
}
