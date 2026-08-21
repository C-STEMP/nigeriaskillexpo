"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MenuFoldOutlined, MenuUnfoldOutlined } from "@ant-design/icons";
import type { NavItem } from "./nav-config";

const siderStyle: React.CSSProperties = {
  overflow: 'auto',
  height: '100vh',
  position: 'sticky',
  insetInlineStart: 0,
  top: 0,
  bottom: 0,
  scrollbarWidth: 'thin',
  scrollbarGutter: 'stable',
};

export function Sidebar({ items }: { items: NavItem[] }) {
  const [expanded, setExpanded] = useState(false);
  const pathname = usePathname();

  return (
    <aside
      style={siderStyle}
      className={`flex flex-col bg-primary text-white transition-[width] duration-200 ${expanded ? "w-60" : "w-16"
        }`}
    >
      {/* Toggle button */}
      <button
        onClick={() => setExpanded((e) => !e)}
        aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
        className="flex h-14 cursor-pointer items-center justify-center text-white/90 hover:text-white hover:bg-white/10 transition-colors"
      >
        {expanded ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
      </button>

      <nav className="flex-1 overflow-y-auto py-2">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.key}
              href={item.href}
              className={`group flex cursor-pointer items-center gap-3 px-5 py-3 text-sm transition-colors relative ${isActive
                  ? "text-white bg-white/20"
                  : "text-white/90 hover:text-white hover:bg-white/10"
                }`}
              title={expanded ? undefined : item.label}
            >
              {isActive && (
                <span className="absolute left-0 top-0 h-full w-1 bg-secondary" />
              )}
              <Icon />
              <span
                className={`whitespace-nowrap overflow-hidden transition-[max-width,opacity] duration-200 ${expanded ? "max-w-[160px] opacity-100" : "max-w-0 opacity-0"
                  }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Nigeria Skills Expo home link at the bottom when expanded */}
      {expanded && (
        <Link
          href="/"
          className="flex items-center justify-center py-4 text-xs text-white/50 hover:text-white/80 transition-colors cursor-pointer"
        >
          ← Back to homepage
        </Link>
      )}
    </aside>
  );
}
