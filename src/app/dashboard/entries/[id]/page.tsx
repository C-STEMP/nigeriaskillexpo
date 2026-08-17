"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import {
  Form,
  InputNumber,
  Input,
  Select,
  Button,
  Alert,
  Spin,
  Tag,
  Divider,
} from "antd";
import { LockOutlined } from "@ant-design/icons";

type EvidenceType =
  | "Certificates"
  | "Portfolios"
  | "Employment_Records"
  | "Business_Registration_Documents"
  | "Business_Performance_Records"
  | "Project_Photographs"
  | "Videos"
  | "References"
  | "Testimonials";

type Criterion = {
  id: string;
  text: string;
  maxScore: string;
  isLocked: boolean;
  lockReason?: string;
  allowedEvidenceTypes: { evidenceType: { name: EvidenceType } }[];
};

type EntryInfo = {
  trade: { name: string };
  sector: { name: string };
  state: { name: string };
  applicant: {
    firstName: string | null;
    lastName: string | null;
    organizationName: string | null;
  };
};

const EVIDENCE_LABELS: Record<EvidenceType, string> = {
  Certificates: "Certificates",
  Portfolios: "Portfolios",
  Employment_Records: "Employment records",
  Business_Registration_Documents: "Business registration documents",
  Business_Performance_Records: "Business performance records",
  Project_Photographs: "Project photographs",
  Videos: "Videos",
  References: "References",
  Testimonials: "Testimonials",
};

export default function ScoreEntryPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [form] = Form.useForm();
  const { data, isLoading } = useSWR<{ criteria: Criterion[]; entry: EntryInfo }>(
    `/api/zonal/state-trade-entries/${params.id}/criteria`,
    fetcher
  );
  const criteria = data?.criteria ?? [];
  const entry = data?.entry ?? null;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(values: Record<string, unknown>) {
    setSubmitting(true);
    setError(null);

    const scores = criteria
      .filter((c) => !c.isLocked)
      .map((c) => ({
        criterionId: c.id,
        value: Number(values[`value_${c.id}`]),
        comment: (values[`comment_${c.id}`] as string) || undefined,
        evidenceTypeObserved: (values[`evidence_${c.id}`] as EvidenceType) || undefined,
        evidenceNote: (values[`evidenceNote_${c.id}`] as string) || undefined,
      }));

    try {
      const res = await fetch("/api/scoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stateTradeEntryId: params.id, scores }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not submit scores.");
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push("/dashboard/my-tasks"), 1500);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spin />
      </div>
    );
  }

  const allLocked = criteria.length > 0 && criteria.every((c) => c.isLocked);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold text-ink">
          {entry
            ? entry.applicant.organizationName ??
              `${entry.applicant.firstName ?? ""} ${entry.applicant.lastName ?? ""}`.trim()
            : "Assessment"}
        </h1>
        <p className="text-sm text-ink/60">
          {entry ? `${entry.trade.name} — ${entry.sector.name} · ${entry.state.name}` : ""}
        </p>
      </div>

      {success && (
        <Alert
          type="success"
          showIcon
          title="Scores submitted successfully."
          className="rounded-lg"
        />
      )}
      {error && (
        <Alert
          type="error"
          showIcon
          title={error}
          className="rounded-lg"
          closable={{ onClose: () => setError(null) }}
        />
      )}
      {allLocked && (
        <Alert
          type="warning"
          showIcon
          icon={<LockOutlined />}
          message="Scoring is currently locked"
          description="All criteria for this assessment stage are locked. You cannot submit or edit scores right now."
          className="rounded-lg"
        />
      )}

      {criteria.length === 0 ? (
        <Alert
          type="info"
          showIcon
          title="No criteria have been configured yet for this trade/sector at this stage."
          className="rounded-lg"
        />
      ) : (
        <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false}>
          {criteria.map((criterion, index) => (
            <div
              key={criterion.id}
              className={`mb-4 rounded-xl border p-5 ${
                criterion.isLocked ? "border-grey bg-grey/20 opacity-60" : "border-grey bg-white"
              }`}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-ink">
                  {index + 1}. {criterion.text}
                </p>
                {criterion.isLocked ? (
                  <Tag icon={<LockOutlined />} color="default">
                    Locked
                  </Tag>
                ) : (
                  <Tag color="default">Max {Number(criterion.maxScore)}</Tag>
                )}
              </div>

              <Form.Item
                label="Score"
                name={`value_${criterion.id}`}
                rules={
                  criterion.isLocked
                    ? []
                    : [
                        { required: true, message: "Enter a score." },
                        {
                          type: "number",
                          max: Number(criterion.maxScore),
                          min: 0,
                          message: `Score must be between 0 and ${criterion.maxScore}.`,
                        },
                      ]
                }
              >
                <InputNumber
                  min={0}
                  max={Number(criterion.maxScore)}
                  className="w-full"
                  disabled={criterion.isLocked}
                />
              </Form.Item>

              <Form.Item
                label="Evidence observed"
                name={`evidence_${criterion.id}`}
                extra="What kind of evidence did you observe, even if not uploaded to the platform."
              >
                <Select
                  placeholder="Select evidence type"
                  disabled={criterion.isLocked}
                  allowClear
                  options={criterion.allowedEvidenceTypes.map((et) => ({
                    value: et.evidenceType.name,
                    label: EVIDENCE_LABELS[et.evidenceType.name],
                  }))}
                />
              </Form.Item>

              <Form.Item label="Evidence note" name={`evidenceNote_${criterion.id}`}>
                <Input
                  placeholder="Brief note on what was observed (optional)"
                  disabled={criterion.isLocked}
                />
              </Form.Item>

              <Form.Item
                label="Comment"
                name={`comment_${criterion.id}`}
                extra="Explain your reasoning — visible to moderators and higher-level reviewers."
              >
                <Input.TextArea
                  rows={2}
                  placeholder="Why did you award this score? (optional but recommended)"
                  disabled={criterion.isLocked}
                />
              </Form.Item>
            </div>
          ))}

          <Divider />

          <Button
            type="primary"
            htmlType="submit"
            size="large"
            block
            loading={submitting}
            disabled={allLocked}
          >
            Submit scores
          </Button>
        </Form>
      )}
    </div>
  );
}
