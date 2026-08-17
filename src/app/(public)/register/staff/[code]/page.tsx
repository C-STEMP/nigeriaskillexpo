"use client";
import Link from "next/link";

import { useEffect, useState } from "react";
import { Form, Input, Select, Button, Alert } from "antd";
import { useParams, useRouter } from "next/navigation";

type Zone = { id: string; name: string };

export default function StaffRegistrationPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const [form] = Form.useForm();
  const [zones, setZones] = useState<Zone[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/public/zones")
      .then((r) => r.json())
      .then((data) => setZones(data.zones.map((z: Zone) => ({ id: z.id, name: z.name }))));
    form.setFieldValue("registrationCode", params.code);
  }, [params.code, form]);

  async function handleSubmit(values: Record<string, unknown>) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/register/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Registration failed.");
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-ink px-4 py-10">
      <div className="mx-auto max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="font-display text-2xl font-bold text-white hover:opacity-80 transition-opacity cursor-pointer">Nigeria Skills Expo</Link>
          <h1 className="mt-2 font-display text-lg font-semibold text-white/90">
            Staff Registration
          </h1>
          <p className="mt-1 text-sm text-white/50">
            For appointed assessors, moderators, and administrators only.
          </p>
        </div>

        {success ? (
          <Alert
            type="success"
            showIcon
            title="Registration successful"
            description="An admin will review and appoint your role shortly. Redirecting to sign in..."
            className="rounded-xl"
          />
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white p-6 sm:p-8">
            {error && (
              <Alert
                type="error"
                showIcon
                title={error}
                className="mb-5 rounded-lg"
                closable={{ onClose: () => setError(null) }}
              />
            )}

            <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Form.Item
                  label="First name"
                  name="firstName"
                  rules={[{ required: true, message: "First name is required." }]}
                >
                  <Input />
                </Form.Item>
                <Form.Item
                  label="Last name"
                  name="lastName"
                  rules={[{ required: true, message: "Last name is required." }]}
                >
                  <Input />
                </Form.Item>
              </div>

              <Form.Item
                label="Email address"
                name="email"
                rules={[
                  { required: true, message: "Email is required." },
                  { type: "email", message: "Enter a valid email address." },
                ]}
              >
                <Input placeholder="you@example.com" />
              </Form.Item>

              <Form.Item
                label="Password"
                name="password"
                rules={[
                  { required: true, message: "Password is required." },
                  { min: 8, message: "Password must be at least 8 characters." },
                ]}
              >
                <Input.Password placeholder="At least 8 characters" />
              </Form.Item>

              <Form.Item label="Phone number" name="phone">
                <Input placeholder="e.g. 08012345678" />
              </Form.Item>

              <Form.Item
                label="Zone you'll be serving"
                name="zoneId"
                rules={[{ required: true, message: "Select a zone." }]}
              >
                <Select
                  placeholder="Select zone"
                  options={zones.map((z) => ({ value: z.id, label: z.name }))}
                />
              </Form.Item>

              <Form.Item
                label="Registration code"
                name="registrationCode"
                rules={[{ required: true, message: "A registration code is required." }]}
              >
                <Input placeholder="Enter the code you were given" />
              </Form.Item>

              <Button
                type="primary"
                htmlType="submit"
                block
                size="large"
                loading={submitting}
                className="mt-2"
              >
                Register
              </Button>
            </Form>
          </div>
        )}
      </div>
    </div>
  );
}
