"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge, Popover, List, Typography, Empty, Spin } from "antd";
import { BellOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import { resolveNotificationLink } from "@/lib/notifications/resolve-link";
import type { NotificationLinkType, NotificationType } from "@prisma/client";

type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  linkType: NotificationLinkType | null;
  linkId: string | null;
  readAt: string | null;
  createdAt: string;
};

const POLL_INTERVAL_MS = 30_000;

export function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.notifications);
      setUnreadCount(data.unreadCount);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  async function handleClick(item: NotificationItem) {
    if (!item.readAt) {
      // Optimistic update so the badge count drops immediately.
      setItems((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      fetch(`/api/notifications/${item.id}/read`, { method: "POST" }).catch(() => {});
    }

    const destination = resolveNotificationLink(item.linkType, item.linkId);
    setOpen(false);
    if (destination) {
      router.push(destination);
    }
  }

  const content = (
    <div style={{ width: 360, maxHeight: 420, overflowY: "auto" }}>
      {loading ? (
        <div style={{ padding: 24, textAlign: "center" }}>
          <Spin size="small" />
        </div>
      ) : items.length === 0 ? (
        <Empty
          description="No notifications yet"
          style={{ padding: 24 }}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <List
          dataSource={items}
          itemLayout="horizontal"
          renderItem={(item) => (
            <List.Item
              onClick={() => handleClick(item)}
              style={{
                cursor: "pointer",
                padding: "12px 16px",
                background: item.readAt ? "transparent" : "var(--color-primary-accent)",
                borderLeft: item.readAt
                  ? "3px solid transparent"
                  : "3px solid var(--color-primary)",
              }}
            >
              <List.Item.Meta
                title={
                  <Typography.Text strong={!item.readAt} style={{ fontSize: 13.5 }}>
                    {item.title}
                  </Typography.Text>
                }
                description={
                  <div>
                    <Typography.Text
                      type="secondary"
                      style={{ fontSize: 12.5, display: "block" }}
                    >
                      {item.body}
                    </Typography.Text>
                    <Typography.Text
                      type="secondary"
                      style={{ fontSize: 11, opacity: 0.7 }}
                    >
                      {new Date(item.createdAt).toLocaleString("en-GB", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Typography.Text>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      )}
    </div>
  );

  return (
    <Popover
      content={content}
      title="Notifications"
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement="bottomRight"
    >
      <Badge count={unreadCount} size="small" offset={[-2, 2]}>
        <button
          aria-label="Notifications"
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink transition-colors hover:bg-grey"
        >
          <BellOutlined style={{ fontSize: 18 }} />
        </button>
      </Badge>
    </Popover>
  );
}
