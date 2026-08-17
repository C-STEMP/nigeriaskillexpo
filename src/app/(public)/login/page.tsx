"use client";

import { useState } from "react";
import { Form, Input, Button, Alert } from "antd";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { CloseOutlined } from "@ant-design/icons";

export default function LoginPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(values: { email: string; password: string }) {
    setSubmitting(true);
    setError(null);
    const result = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    });
    setSubmitting(false);
    if (result?.error) {
      setError("Incorrect email or password. Please try again.");
      return;
    }
    router.push("/dashboard");
  }

  return (
    <div className="flex min-h-screen">
      {/* Left column — brand panel, md+ only */}
      <div className="hidden md:flex md:w-1/2 flex-col items-center justify-center bg-primary px-12 relative overflow-hidden">
        {/* Decorative rings */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full border border-white/10" />
        <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full border border-white/10" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-white/5" />

        <div className="relative z-10 text-center">
          <Image
            src="/logo.png"
            alt="Nigeria Skills Expo"
            width={120}
            height={60}
            className="mx-auto mb-8 h-16 w-auto"
          />
          <h2 className="font-display text-3xl font-bold text-white leading-tight">
            Skills Excellence<br />Awards Platform
          </h2>
          <p className="mt-4 text-white/70 text-sm leading-relaxed max-w-xs mx-auto">
            Connecting trainees, training providers, colleges, instructors, and industry
            partners in a transparent, sector-by-sector national assessment.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-4 text-left">
            {[
              { label: "Zones covered", value: "6" },
              { label: "States + FCT", value: "37" },
              { label: "Skill sectors", value: "10+" },
              { label: "Award categories", value: "19" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl bg-white/10 px-4 py-3">
                <div className="font-display text-2xl font-bold text-white">{stat.value}</div>
                <div className="text-xs text-white/60 mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right column — form */}
      <div className="flex w-full md:w-1/2 flex-col bg-grey/20">
        {/* Close / back button */}
        <div className="flex justify-end p-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-full border border-grey bg-white px-4 py-1.5 text-sm text-ink/70 hover:text-ink hover:border-ink/30 transition-colors cursor-pointer"
          >
            <CloseOutlined style={{ fontSize: 12 }} />
            Back to home
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 pb-12">
          <div className="w-full max-w-sm">
            {/* Mobile brand (only on small screens where left column is hidden) */}
            <div className="mb-8 text-center md:hidden">
              <Link href="/">
                <Image src="/logo.png" alt="Nigeria Skills Expo" width={100} height={50} className="mx-auto h-12 w-auto" />
              </Link>
            </div>

            <div className="mb-8">
              <h1 className="font-display text-2xl font-bold text-ink">Welcome back</h1>
              <p className="mt-1 text-sm text-ink/60">Sign in to your Nigeria Skills Expo account</p>
            </div>

            <div className="rounded-2xl border border-grey bg-white p-6 shadow-sm">
              {error && (
                <Alert
                  type="error"
                  showIcon
                  title={error}
                  className="mb-5 rounded-lg"
                  closable={{ onClose: () => setError(null) }}
                />
              )}

              <Form layout="vertical" onFinish={handleSubmit} requiredMark={false}>
                <Form.Item
                  label="Email address"
                  name="email"
                  rules={[
                    { required: true, message: "Email is required." },
                    { type: "email", message: "Enter a valid email address." },
                  ]}
                >
                  <Input placeholder="you@example.com" autoFocus size="large" />
                </Form.Item>

                <Form.Item
                  label="Password"
                  name="password"
                  rules={[{ required: true, message: "Password is required." }]}
                >
                  <Input.Password placeholder="Your password" size="large" />
                </Form.Item>

                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  size="large"
                  loading={submitting}
                  className="cursor-pointer mt-2"
                >
                  Sign in
                </Button>
              </Form>
            </div>

            <p className="mt-6 text-center text-sm text-ink/50">
              Not registered yet?{" "}
              <Link href="/register/applicant" className="text-primary hover:underline cursor-pointer">
                Register to take part
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
