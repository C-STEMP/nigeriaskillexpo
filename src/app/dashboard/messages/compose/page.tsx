"use client";

import { useEffect, useState } from "react";
import { Form, Input, Select, Button, Alert, Radio, Spin } from "antd";
import { useRouter } from "next/navigation";

type Zone = { id: string; name: string };
type Contact = { id: string; name: string };

const ROLE_OPTIONS = [
  { value: "Trainee", label: "Trainees" },
  { value: "TSP", label: "Training Service Providers" },
  { value: "Technical_College", label: "Technical Colleges" },
  { value: "Instructor", label: "Instructors" },
  { value: "Industry_Partner", label: "Industry Partners" },
  { value: "Zonal_Admin", label: "Zonal Admins" },
  { value: "Zonal_Assessor", label: "Zonal Assessors" },
  { value: "Zonal_Moderator", label: "Zonal Moderators" },
];

export default function ComposeBroadcastPage() {
  const router = useRouter();
  const [form] = Form.useForm();
  const [zones, setZones] = useState<Zone[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [mode, setMode] = useState<"broadcast" | "direct" | null>(null);
  const [canBroadcastEverywhere, setCanBroadcastEverywhere] = useState(false);
  const [targetType, setTargetType] = useState<string>("Everyone");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/messages/contacts").then((r) => r.json()),
      fetch("/api/public/zones").then((r) => r.json()),
    ])
      .then(([contactsRes, zonesRes]) => {
        setMode(contactsRes.mode);
        setCanBroadcastEverywhere(Boolean(contactsRes.canBroadcastEverywhere));
        setContacts(contactsRes.contacts ?? []);
        setZones(zonesRes.zones ?? []);
        // Zonal_Admin (broadcast mode, but not full reach) can't target
        // "Everyone" — default them to a sensible starting option instead.
        if (contactsRes.mode === "broadcast" && !contactsRes.canBroadcastEverywhere) {
          setTargetType("Specific_Zone");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleDirectSubmit(values: { recipientId: string; body: string; subject?: string }) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not send message.");
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push("/dashboard/messages"), 1500);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleBroadcastSubmit(values: {
    subject?: string;
    body: string;
    role?: string;
    zoneId?: string;
  }) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: values.subject,
          body: values.body,
          target: { type: targetType, role: values.role, zoneId: values.zoneId },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not send broadcast.");
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push("/dashboard/messages"), 1500);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spin />
      </div>
    );
  }

  if (mode === "direct") {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">New message</h1>
          <p className="text-sm text-ink/60">
            You can message your Zonal Admin directly from here.
          </p>
        </div>

        {success && <Alert type="success" showIcon title="Message sent." className="rounded-lg" />}
        {error && (
          <Alert type="error" showIcon title={error} className="rounded-lg" closable={{ onClose: () => setError(null) }} />
        )}

        {contacts.length === 0 ? (
          <Alert
            type="info"
            showIcon
            title="No contact available"
            description="There is currently no Zonal Admin assigned for your zone to message."
            className="rounded-lg"
          />
        ) : (
          <Form layout="vertical" onFinish={handleDirectSubmit} requiredMark={false}>
            <Form.Item
              label="To"
              name="recipientId"
              rules={[{ required: true, message: "Select a recipient." }]}
            >
              <Select
                placeholder="Select recipient"
                options={contacts.map((c) => ({ value: c.id, label: c.name }))}
              />
            </Form.Item>
            <Form.Item label="Subject (optional)" name="subject">
              <Input placeholder="What's this about?" />
            </Form.Item>
            <Form.Item
              label="Message"
              name="body"
              rules={[{ required: true, message: "Message cannot be empty." }]}
            >
              <Input.TextArea rows={5} placeholder="Write your message..." />
            </Form.Item>
            <Button type="primary" htmlType="submit" block size="large" loading={submitting}>
              Send message
            </Button>
          </Form>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold text-ink">Send a broadcast</h1>
        <p className="text-sm text-ink/60">
          {canBroadcastEverywhere
            ? "Reach everyone, a specific role, a zone, or a role within one zone."
            : "Reach your zone, or a specific role within your zone."}
        </p>
      </div>

      {success && <Alert type="success" showIcon title="Broadcast sent." className="rounded-lg" />}
      {error && (
        <Alert type="error" showIcon title={error} className="rounded-lg" closable={{ onClose: () => setError(null) }} />
      )}

      <Form form={form} layout="vertical" onFinish={handleBroadcastSubmit} requiredMark={false}>
        <Form.Item label="Audience">
          <Radio.Group
            value={targetType}
            onChange={(e) => setTargetType(e.target.value)}
            className="grid grid-cols-2 gap-2"
          >
            {canBroadcastEverywhere && <Radio.Button value="Everyone">Everyone</Radio.Button>}
            {canBroadcastEverywhere && (
              <Radio.Button value="Specific_Role">A specific role</Radio.Button>
            )}
            <Radio.Button value="Specific_Zone">
              {canBroadcastEverywhere ? "A specific zone" : "My zone"}
            </Radio.Button>
            <Radio.Button value="Specific_Role_In_Zone">
              {canBroadcastEverywhere ? "Role within a zone" : "A role in my zone"}
            </Radio.Button>
          </Radio.Group>
        </Form.Item>

        {(targetType === "Specific_Role" || targetType === "Specific_Role_In_Zone") && (
          <Form.Item
            label="Role"
            name="role"
            rules={[{ required: true, message: "Select a role." }]}
          >
            <Select options={ROLE_OPTIONS} placeholder="Select role" />
          </Form.Item>
        )}

        {(targetType === "Specific_Zone" || targetType === "Specific_Role_In_Zone") && (
          <Form.Item
            label="Zone"
            name="zoneId"
            rules={[{ required: true, message: "Select a zone." }]}
          >
            <Select
              options={zones.map((z) => ({ value: z.id, label: z.name }))}
              placeholder="Select zone"
            />
          </Form.Item>
        )}

        <Form.Item label="Subject (optional)" name="subject">
          <Input placeholder="e.g. Update on assessment timelines" />
        </Form.Item>

        <Form.Item
          label="Message"
          name="body"
          rules={[{ required: true, message: "Message cannot be empty." }]}
        >
          <Input.TextArea rows={5} placeholder="Write your message..." />
        </Form.Item>

        <Button type="primary" htmlType="submit" block size="large" loading={submitting}>
          Send broadcast
        </Button>
      </Form>
    </div>
  );
}
