"use client";

import { Dropdown, Avatar } from "antd";
import { UserOutlined, LogoutOutlined, SettingOutlined } from "@ant-design/icons";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { NotificationBell } from "@/components/ui/notification-bell";

export function DashboardHeader({
  userName,
  roleLabel,
  scopeLabel,
}: {
  userName: string;
  roleLabel: string;
  scopeLabel?: string;
}) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-grey bg-white px-4 sm:px-6">
      <div className="flex items-center gap-3">
        {/* Nigeria Skills Expo as clickable link back to homepage */}
        <Link
          href="/"
          className="font-display text-lg font-bold text-primary hover:text-primary/80 transition-colors cursor-pointer"
        >
          Nigeria Skills Expo
        </Link>
        {scopeLabel && (
          <span className="hidden sm:inline-flex rounded-full bg-primary-accent px-3 py-1 text-xs font-medium text-primary">
            {scopeLabel}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <NotificationBell />
        <Dropdown
          menu={{
            items: [
              {
                key: "settings",
                icon: <SettingOutlined />,
                label: "Profile settings",
              },
              {
                key: "logout",
                icon: <LogoutOutlined />,
                label: "Sign out",
                onClick: () => signOut({ callbackUrl: "/login" }),
              },
            ],
          }}
          trigger={["click"]}
        >
          <button className="flex cursor-pointer items-center gap-2 rounded-full pl-1 pr-2 sm:pr-3 py-1 hover:bg-grey transition-colors">
            <Avatar size={28} icon={<UserOutlined />} style={{ backgroundColor: "#aa1d3f" }} />
            {/* Name + role only visible from sm: upward */}
            <span className="hidden sm:block text-sm text-left leading-tight">
              <span className="block font-medium text-ink">{userName}</span>
              <span className="block text-xs text-ink/60">{roleLabel}</span>
            </span>
          </button>
        </Dropdown>
      </div>
    </header>
  );
}
