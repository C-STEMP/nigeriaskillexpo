"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { fetcher } from "@/lib/fetcher";
import { List, Input, Button, Empty, Spin, Avatar, Tag } from "antd";
import { SendOutlined, UserOutlined, SoundOutlined, EditOutlined } from "@ant-design/icons";
import Link from "next/link";

type Participant = { userId: string; user: { id: string; firstName: string | null; lastName: string | null; organizationName: string | null } };
type Message = { id: string; senderId: string; body: string; createdAt: string; sender: { firstName: string | null; lastName: string | null; organizationName: string | null } };
type Conversation = {
  id: string;
  kind: "Direct" | "Broadcast";
  subject: string | null;
  participants: Participant[];
  messages: Message[];
};

function displayName(p: { firstName: string | null; lastName: string | null; organizationName: string | null } | undefined) {
  if (!p) return "Unknown";
  if(p.organizationName) return p.organizationName.trim()
  return `${p.firstName?.trim()} ${p.lastName?.trim()}` || "Unknown";
}

export default function MessagesPage() {
  const { data: convData, isLoading } = useSWR<{ conversations: Conversation[] }>("/api/messages", fetcher);
  const conversations = convData?.conversations ?? [];

  const [activeId, setActiveId] = useState<string | null>(null);
  const { data: threadData, mutate: mutateThread } = useSWR<{ conversation: Conversation }>(
    activeId ? `/api/messages/${activeId}` : null,
    fetcher
  );
  const thread = threadData?.conversation ?? null;

  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  async function handleReply() {
    if (!activeId || !replyText.trim()) return;
    setSending(true);
    try {
      await fetch(`/api/messages/${activeId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: replyText }),
      });
      setReplyText("");
      mutateThread();
      mutate("/api/messages");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem-3rem)] gap-4">
      <div className="w-72 shrink-0 rounded-xl border border-grey bg-white">
        <div className="flex items-center justify-between border-b border-grey px-4 py-3">
          <h2 className="font-display text-sm font-semibold text-ink">Messages</h2>
          <Link href="/dashboard/messages/compose">
            <Button size="small" icon={<EditOutlined />} type="text" className="cursor-pointer" />
          </Link>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spin size="small" />
          </div>
        ) : conversations.length === 0 ? (
          <Empty description="No conversations yet" className="py-8" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <List
            dataSource={conversations}
            renderItem={(c) => {
              const lastMessage = c.messages[0];
              return (
                <List.Item
                  onClick={() => setActiveId(c.id)}
                  className={`cursor-pointer px-4 py-3 ${activeId === c.id ? "bg-primary-accent" : "hover:bg-grey/40"}`}
                >
                  <List.Item.Meta
                    avatar={
                      <Avatar
                        size={32}
                        icon={c.kind === "Broadcast" ? <SoundOutlined /> : <UserOutlined />}
                        style={{ backgroundColor: c.kind === "Broadcast" ? "#f9a825" : "#aa1d3f" }}
                      />
                    }
                    title={
                      <span className="text-sm font-medium text-ink">
                        {c.subject ?? (c.kind === "Broadcast" ? "Broadcast" : "Direct message")}
                      </span>
                    }
                    description={
                      <span className="line-clamp-1 text-xs text-ink/50">
                        {lastMessage?.body ?? "No messages yet"}
                      </span>
                    }
                  />
                </List.Item>
              );
            }}
          />
        )}
      </div>

      <div className="flex flex-1 flex-col rounded-xl border border-grey bg-white">
        {!thread ? (
          <Empty description="Select a conversation" className="m-auto" />
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-grey px-5 py-3">
              <h2 className="font-display text-sm font-semibold text-ink">
                {thread.subject ?? "Conversation"}
              </h2>
              {thread.kind === "Broadcast" && <Tag color="gold">Broadcast</Tag>}
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {thread.messages.map((m) => (
                <div key={m.id} className="max-w-md rounded-xl border border-grey bg-grey/20 p-3">
                  <p className="text-xs font-medium text-primary">{displayName(m.sender)}</p>
                  <p className="mt-1 text-sm text-ink/80">{m.body}</p>
                  <p className="mt-1 text-[11px] text-ink/40">
                    {new Date(m.createdAt).toLocaleString("en-GB", {
                      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex gap-2 border-t border-grey p-4">
              <Input.TextArea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a reply..."
                autoSize={{ minRows: 1, maxRows: 4 }}
                onPressEnter={(e) => {
                  if (!e.shiftKey) {
                    e.preventDefault();
                    handleReply();
                  }
                }}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                className="cursor-pointer"
                onClick={handleReply}
                loading={sending}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
