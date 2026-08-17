"use client";
import Link from "next/link";

import { useEffect, useState } from "react";
import { Form, Input, Select, Button, Alert, Radio } from "antd";
import { useRouter } from "next/navigation";

type Zone = { id: string; name: string; states: { id: string; name: string }[] };
type Sector = {
  id: string;
  name: string;
  applicableCategories: { category: string }[];
  trades: { id: string; name: string; disabled: boolean }[];
};
type CycleResponse = {
  open: boolean;
  cycle: { id: string; title: string; sectorOfferings: { sector: Sector }[] } | null;
};

const INDIVIDUAL_CATEGORIES = ["Trainee", "Instructor"];

const CATEGORY_LABELS: Record<string, string> = {
  Trainee: "Beneficiary / Trainee",
  TSP: "Training Service Provider",
  Technical_College: "Technical College",
  Instructor: "Instructor",
  Industry_Partner: "Industry Partner",
};

export default function ApplicantRegistrationPage() {
  const router = useRouter();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cycleData, setCycleData] = useState<CycleResponse | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/public/active-cycle").then((r) => r.json()),
      fetch("/api/public/zones").then((r) => r.json()),
    ])
      .then(([cycleRes, zonesRes]) => {
        setCycleData(cycleRes);
        setZones(zonesRes.zones);
      })
      .finally(() => setLoading(false));
  }, []);

  const isIndividual = selectedCategory && INDIVIDUAL_CATEGORIES.includes(selectedCategory);

  const availableSectors =
    cycleData?.cycle?.sectorOfferings
      .map((o) => o.sector)
      .filter(
        (s) =>
          s.applicableCategories.length === 0 ||
          s.applicableCategories.some((c) => c.category === selectedCategory)
      ) ?? [];

  async function handleSubmit(values: Record<string, unknown>) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/register/applicant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, cycleId: cycleData?.cycle?.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Registration failed. Please check your details and try again.");
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-grey/30">
        <p className="text-ink/50">Loading registration...</p>
      </div>
    );
  }

  if (!cycleData?.open) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-ink px-6 text-center">
        <Link href="/" className="font-display text-3xl font-bold text-white hover:opacity-80 transition-opacity cursor-pointer">Nigeria Skills Expo</Link>
        <div className="mt-8 max-w-md rounded-2xl border border-white/10 bg-white/5 p-8">
          <h1 className="font-display text-xl font-semibold text-white">
            Registration is currently closed
          </h1>
          <p className="mt-3 text-sm text-white/60">
            The Nigeria Skills Expo Excellence Awards registration window isn&apos;t open right
            now. Check back soon, or contact your local coordinator for the next cycle&apos;s
            dates.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-grey/30 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <Link href="/" className="font-display text-2xl font-bold text-primary hover:opacity-80 transition-opacity cursor-pointer">Nigeria Skills Expo</Link>
          <h1 className="mt-2 font-display text-xl font-semibold text-ink">
            {cycleData.cycle?.title}
          </h1>
          <p className="mt-1 text-sm text-ink/60">Register to take part in this cycle.</p>
        </div>

        {success ? (
          <Alert
            type="success"
            showIcon
            title="Registration successful"
            description="Redirecting you to sign in..."
            className="rounded-xl"
          />
        ) : (
          <div className="rounded-2xl border border-grey bg-white p-6 sm:p-8">
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
              <Form.Item
                label="Category"
                name="applicantCategory"
                rules={[{ required: true, message: "Select your category." }]}
              >
                <Radio.Group
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="grid grid-cols-1 gap-2 sm:grid-cols-2"
                >
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <Radio.Button
                      key={value}
                      value={value}
                      className="!h-auto !rounded-lg !py-2 text-center"
                    >
                      {label}
                    </Radio.Button>
                  ))}
                </Radio.Group>
              </Form.Item>

              {selectedCategory && (
                <>
                  {isIndividual ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Form.Item
                        label="First name"
                        name="firstName"
                        rules={[{ required: true, message: "First name is required." }]}
                      >
                        <Input placeholder="e.g. Amaka" />
                      </Form.Item>
                      <Form.Item
                        label="Last name"
                        name="lastName"
                        rules={[{ required: true, message: "Last name is required." }]}
                      >
                        <Input placeholder="e.g. Okafor" />
                      </Form.Item>
                    </div>
                  ) : (
                    <Form.Item
                      label="Organization name"
                      name="organizationName"
                      rules={[{ required: true, message: "Organization name is required." }]}
                    >
                      <Input placeholder="e.g. Lagos Skills Institute" />
                    </Form.Item>
                  )}

                  {isIndividual && (
                    <Form.Item
                      label="Gender"
                      name="gender"
                      rules={[{ required: true, message: "Gender is required." }]}
                    >
                      <Select
                        placeholder="Select gender"
                        options={[
                          { value: "Male", label: "Male" },
                          { value: "Female", label: "Female" },
                        ]}
                      />
                    </Form.Item>
                  )}

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

                  <Form.Item
                    label="Phone number"
                    name="phone"
                    rules={[{ required: false }]}
                  >
                    <Input placeholder="e.g. 08012345678" />
                  </Form.Item>

                  <Form.Item
                    label="Zone"
                    name="zoneIdDisplay"
                    rules={[{ required: true, message: "Select your zone." }]}
                  >
                    <Select
                      placeholder="Select zone"
                      options={zones.map((z) => ({ value: z.id, label: z.name }))}
                      onChange={(value) => {
                        setSelectedZone(value);
                        form.setFieldValue("stateId", undefined);
                      }}
                    />
                  </Form.Item>

                  <Form.Item
                    label="State"
                    name="stateId"
                    rules={[{ required: true, message: "Select your state." }]}
                  >
                    <Select
                      placeholder={selectedZone ? "Select state" : "Select a zone first"}
                      disabled={!selectedZone}
                      options={
                        zones
                          .find((z) => z.id === selectedZone)
                          ?.states.map((s) => ({ value: s.id, label: s.name })) ?? []
                      }
                    />
                  </Form.Item>

                  {isIndividual && (
                    <Form.Item
                      label="Trade / skill area"
                      name="tradeId"
                      rules={[{ required: true, message: "Select your trade/skill area." }]}
                      extra="This determines the questions and criteria you'll be assessed against."
                    >
                      <Select
                        placeholder="Select sector and trade"
                        options={availableSectors.map((sector) => ({
                          label: sector.name,
                          options: sector.trades
                            .filter((t) => !t.disabled)
                            .map((t) => ({ value: t.id, label: t.name })),
                        }))}
                      />
                    </Form.Item>
                  )}

                  <Form.Item
                    label="Address"
                    name="address"
                    rules={[{ required: true, message: "Address is required." }]}
                  >
                    <Input.TextArea rows={2} placeholder="Street address, city" />
                  </Form.Item>

                  <Button
                    type="primary"
                    htmlType="submit"
                    block
                    size="large"
                    loading={submitting}
                    className="mt-2"
                  >
                    Complete registration
                  </Button>
                </>
              )}
            </Form>
          </div>
        )}
      </div>
    </div>
  );
}
